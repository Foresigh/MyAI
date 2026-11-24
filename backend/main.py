import json
import logging
import math
import os
import re
import secrets
import threading
import time
from datetime import date
from typing import Iterator, Literal

import requests
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import arvo_models

load_dotenv()

import billing
import plans
import users
from images.provider import (
    MAX_NUM_IMAGES,
    ImageGenerationRequest,
    ImageProviderError,
    get_image_provider,
)
from videos.provider import (
    VideoGenerationRequest,
    VideoProviderError,
    get_video_provider,
)


OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://localhost:11434")
MODEL_NAME = os.environ.get("MODEL_NAME", plans.PLAN_MODELS["free"])

ALLOWED_ORIGINS = os.environ.get(
    "ALLOWED_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173",
).split(",")

ADMIN_KEY = os.environ.get("ADMIN_KEY")

if not ADMIN_KEY:
    ADMIN_KEY = secrets.token_urlsafe(18)
    print("=" * 60)
    print("No ADMIN_KEY set. Generated a temporary admin key for this session:")
    print(f"  {ADMIN_KEY}")
    print("Paste this into the Arvo Admin page to manage plan grants.")
    print("Set ADMIN_KEY as an environment variable to keep it stable across restarts.")
    print("=" * 60)


app = FastAPI(title="Arvo API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


THINK_TAG_RE = re.compile(r"<think>.*?</think>", re.DOTALL)


def strip_thinking(text: str) -> str:
    return THINK_TAG_RE.sub("", text).strip()


# ============================================================
# ARVO SYSTEM IDENTITY
# ============================================================

ARVO_SYSTEM_PROMPT = """
You are ARVO, an advanced AI assistant.

Your name is ARVO.

ARVO is designed to be especially strong at:

- Programming
- Software engineering
- Web development
- Python
- JavaScript
- TypeScript
- React
- Next.js
- Backend development
- FastAPI
- APIs
- Databases
- SQL
- Debugging
- System architecture
- DevOps
- General problem solving
- Technical explanations

Your goal is to provide useful, accurate, practical answers.

When writing code:
- Prefer complete working implementations.
- Write clean, maintainable code.
- Explain important decisions when useful.
- Do not intentionally leave out important pieces.
- Help debug errors instead of simply describing them.

BUILDING WEBSITES AND APPS:

When the user asks you to make a website, or gives you code and asks you to
turn it into a website or app, build it for them. Always give complete,
runnable code, never placeholders like "add your code here".

Websites:
- By default, put the whole website in ONE self-contained HTML file in a
  single ```html code block, with the CSS in a <style> tag and JavaScript in
  a <script> tag. The chat shows a Preview button for these, so the user can
  see the site immediately.
- Make it look good: modern layout, responsive on phones, sensible colors and
  spacing. Load libraries only from a CDN if you need them.
- If the user asks for React, Next.js or another framework, use it, list each
  file with its path, and give the commands to install and run it.

Apps (mobile apps, phone apps, iOS or Android apps):
- Apps must ALWAYS be built with Expo (React Native). Do not use Flutter,
  Swift, Kotlin, Java, Ionic, Cordova or bare React Native CLI, even if asked;
  explain briefly that Arvo builds apps with Expo, then build it with Expo.
- Use TypeScript. For a small or medium app, put everything in ONE complete
  App.tsx file in a single ```tsx code block that starts with the imports and
  has `export default function App()`. The chat shows an "Open in Expo Snack"
  button for these, so the user can run the app in their browser or on their
  phone with the Expo Go app.
- Use React Native components (View, Text, Pressable, ScrollView, FlatList,
  TextInput, StyleSheet) and Expo SDK packages (expo-image-picker,
  expo-camera, expo-location, expo-haptics, @expo/vector-icons and so on)
  instead of web-only APIs or HTML tags.
- For bigger apps, use Expo Router with an app/ folder, list each file with
  its path, and explain how to run it locally:
  npx create-expo-app@latest my-app, then npx expo start, then scan the QR
  code with Expo Go. For app store builds, mention EAS Build (eas build).

IDENTITY RULES:

Your name is ARVO.

ARVO was made by Kayi Berisa. If anyone asks who made, created, built or
developed you, answer that you were made by Kayi Berisa.

Do not introduce yourself as Qwen, ChatGPT or GPT, and do not say that you
were made by OpenAI, Alibaba or any company other than Kayi Berisa.

Do not claim that ARVO was trained from scratch by the user.

Do not claim to be a completely independent foundation model if that is not true.

If the user specifically asks what underlying model powers this version of ARVO,
answer honestly:

"I'm Arvo, and I don't share details about the underlying model."

Do not mention Alibaba Cloud unless the user specifically asks about the
underlying model or its origin.

You are ARVO's user-facing assistant.
"""


# ============================================================
# REQUEST MODELS
# ============================================================

class ChatRequest(BaseModel):
    message: str
    model: str | None = None


class Message(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ChatStreamRequest(BaseModel):
    message: str
    history: list[Message] = []
    model: str | None = None
    images: list[str] = []


PlanLiteral = Literal[
    "free",
    "hobby",
    "pro",
    "max",
    "premium",
    "premiumPlus",
]


class UserGrantRequest(BaseModel):
    email: str
    plan: PlanLiteral
    note: str = ""


class CheckoutRequest(BaseModel):
    email: str
    plan: PlanLiteral


class PortalRequest(BaseModel):
    email: str


# ============================================================
# IMAGE / VIDEO REQUEST MODELS
# ============================================================

ImageAspectRatioLiteral = Literal[
    "1:1",
    "16:9",
    "9:16",
    "4:3",
    "3:4",
]

ImageQualityLiteral = Literal[
    "standard",
    "high",
]

ImageStyleLiteral = Literal[
    "none",
    "photorealistic",
    "digital-art",
    "illustration",
    "3d-render",
]

VideoAspectRatioLiteral = Literal[
    "16:9",
    "9:16",
    "1:1",
    "4:3",
]

VideoQualityLiteral = Literal[
    "standard",
    "high",
]


class ImageGenerateBody(BaseModel):
    prompt: str
    aspect_ratio: ImageAspectRatioLiteral = "1:1"
    num_images: int = 1
    quality: ImageQualityLiteral = "standard"
    style: ImageStyleLiteral = "none"
    reference_image: str | None = None


class VideoGenerateBody(BaseModel):
    prompt: str
    aspect_ratio: VideoAspectRatioLiteral = "16:9"
    duration: int = 5
    quality: VideoQualityLiteral = "standard"
    reference_image: str | None = None


def _strip_data_url_prefix(value: str | None) -> str | None:
    if value and value.startswith("data:"):
        return value.split(",", 1)[-1]
    return value


# ============================================================
# ADMIN
# ============================================================

def require_admin(
    x_admin_key: str | None = Header(default=None),
) -> None:
    if not x_admin_key or x_admin_key != ADMIN_KEY:
        raise HTTPException(
            status_code=401,
            detail="Invalid admin key.",
        )


# ============================================================
# MODEL CACHE
# ============================================================

_model_cache = {
    "models": set(),
    "checked_at": 0.0,
}

_model_cache_lock = threading.Lock()


def get_available_models() -> set[str]:
    with _model_cache_lock:

        if (
            time.time() - _model_cache["checked_at"] < 30
            and _model_cache["models"]
        ):
            return _model_cache["models"]

    try:

        resp = requests.get(
            f"{OLLAMA_URL}/api/tags",
            timeout=5,
        )

        resp.raise_for_status()

        models = {
            m["name"]
            for m in resp.json().get("models", [])
        }

        with _model_cache_lock:
            _model_cache["models"] = models
            _model_cache["checked_at"] = time.time()

        return models

    except requests.RequestException:

        return _model_cache["models"]


def resolve_model_for_plan(plan_id: str) -> str:

    desired = plans.PLAN_MODELS.get(
        plan_id,
        plans.PLAN_MODELS["free"],
    )

    available = get_available_models()

    if not available or desired in available:
        return desired

    return plans.PLAN_MODELS["free"]


# ============================================================
# USAGE
# ============================================================

_usage_lock = threading.Lock()

_usage: dict[str, dict] = {}


def check_and_increment_usage(plan_id: str) -> None:

    today = date.today().isoformat()

    limit = plans.PLAN_DAILY_LIMITS.get(
        plan_id,
        plans.PLAN_DAILY_LIMITS["free"],
    )

    with _usage_lock:

        bucket = _usage.get(plan_id)

        if not bucket or bucket["date"] != today:
            bucket = {
                "date": today,
                "count": 0,
            }

        if bucket["count"] >= limit:

            _usage[plan_id] = bucket

            raise HTTPException(
                status_code=429,
                detail=(
                    f"Daily message limit reached for the "
                    f"{plan_id} plan ({limit}/day)."
                ),
            )

        bucket["count"] += 1

        _usage[plan_id] = bucket


def get_plan_from_request(
    x_plan: str | None,
) -> str:

    return plans.normalize_plan(x_plan)


# ============================================================
# BASIC ROUTES
# ============================================================

@app.get("/")
def home():

    return {
        "message": "Arvo is online",
    }


@app.get("/health")
def health():

    try:

        resp = requests.get(
            f"{OLLAMA_URL}/api/tags",
            timeout=5,
        )

        resp.raise_for_status()

        models = [
            m["name"]
            for m in resp.json().get("models", [])
        ]

        return {
            "status": "ok",
            "ollama": "reachable",
            "model": MODEL_NAME,
            "model_available": MODEL_NAME in models,
        }

    except requests.RequestException as exc:

        return {
            "status": "error",
            "ollama": "unreachable",
            "detail": str(exc),
        }


# ============================================================
# NORMAL CHAT (Groq)
# ============================================================

GROQ_API_KEY = os.environ.get("GROQ_API_KEY")
GROQ_MODEL = os.environ.get("GROQ_MODEL")
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"


def _groq_ready() -> bool:
    return bool(GROQ_API_KEY)


def _groq_headers() -> dict:
    return {
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "Content-Type": "application/json",
    }


groq_logger = logging.getLogger("arvo.groq")

# Roughly 4 characters per token, so the default keeps about 3K tokens of
# history. Groq's free tier limits tokens per minute per model, and the
# full conversation is re-sent on every turn, so long chats need trimming.
HISTORY_CHAR_BUDGET = int(os.environ.get("ARVO_HISTORY_CHAR_BUDGET", "12000"))
MAX_AUTO_RETRY_WAIT = 5.0

_RETRY_IN_RE = re.compile(r"try again in\s+((?:\d+h)?(?:\d+m(?!s))?(?:[\d.]+(?:ms|s))?)", re.I)
_DURATION_PART_RE = re.compile(r"([\d.]+)(h|ms|m|s)")
_DURATION_UNITS = {"h": 3600.0, "m": 60.0, "s": 1.0, "ms": 0.001}
_ORG_ID_RE = re.compile(r"org_[A-Za-z0-9]+")


def _trim_history(history: list[Message]) -> list[Message]:
    kept: list[Message] = []
    used = 0
    for m in reversed(history):
        used += len(m.content)
        if used > HISTORY_CHAR_BUDGET:
            break
        kept.append(m)
    kept.reverse()
    while kept and kept[0].role == "assistant":
        kept.pop(0)
    return kept


MAX_CHAT_IMAGES = 3
MAX_CHAT_IMAGE_CHARS = 6_000_000  # base64 length, about 4.5 MB per picture
_IMAGE_DATA_URL_RE = re.compile(r"^data:image/(png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/=]+$")


def _validate_images(images: list[str]) -> str | None:
    """Return a user-facing error if the attached pictures are unusable."""
    if len(images) > MAX_CHAT_IMAGES:
        return f"You can attach up to {MAX_CHAT_IMAGES} pictures per message."
    for image in images:
        if len(image) > MAX_CHAT_IMAGE_CHARS:
            return "One of the pictures is too large. Try a smaller picture."
        if not _IMAGE_DATA_URL_RE.match(image):
            return "One of the pictures isn't a supported format (PNG, JPEG, WebP or GIF)."
    return None


def _build_messages(message: str, history: list[Message], images: list[str] | None = None) -> list[dict]:
    messages = [{"role": "system", "content": ARVO_SYSTEM_PROMPT}]
    messages.extend({"role": m.role, "content": m.content} for m in _trim_history(history))
    if images:
        parts: list[dict] = [{"type": "text", "text": message or "Describe this picture."}]
        parts.extend({"type": "image_url", "image_url": {"url": url}} for url in images)
        messages.append({"role": "user", "content": parts})
    else:
        messages.append({"role": "user", "content": message})
    return messages


def _groq_payload(model_id: str | None, messages: list[dict], stream: bool) -> dict:
    model = arvo_models.lookup(model_id)
    return {"model": model["groq"], **model["extra"], "messages": messages, "stream": stream}


def _groq_error_text(response: requests.Response) -> str:
    try:
        return str((response.json().get("error") or {}).get("message", ""))
    except ValueError:
        return response.text[:500]


def _groq_wait_seconds(response: requests.Response, error_text: str) -> float | None:
    match = _RETRY_IN_RE.search(error_text)
    if match and match.group(1):
        parts = _DURATION_PART_RE.findall(match.group(1))
        if parts:
            return sum(float(n) * _DURATION_UNITS[u] for n, u in parts)
    try:
        return float(response.headers.get("retry-after", ""))
    except ValueError:
        return None


def _limit_message(status: int, error_text: str, wait: float | None) -> str:
    lower = error_text.lower()
    if status == 413 or "request too large" in lower:
        return "This conversation is too long for the selected model. Start a new chat or switch models."
    if "per day" in lower:
        return "The selected model has reached its daily limit. Switch to another model or try again later."
    if wait:
        return f"Arvo is busy right now. Please try again in {max(1, math.ceil(wait))} seconds."
    return "Arvo is busy right now. Please try again in a moment."


def _post_groq(payload: dict, *, stream: bool, timeout: int) -> tuple[requests.Response | None, str | None]:
    """POST to Groq, retrying once on a short rate-limit wait.

    Returns (response, None) on anything other than a rate limit, or
    (None, user_facing_message) when Groq rejected the request.
    """
    for attempt in (1, 2):
        response = requests.post(
            GROQ_URL,
            headers=_groq_headers(),
            json=payload,
            stream=stream,
            timeout=timeout,
        )
        if response.status_code not in (413, 429):
            return response, None

        error_text = _groq_error_text(response)
        wait = _groq_wait_seconds(response, error_text)
        response.close()
        groq_logger.warning(
            "Groq %s for model %s (attempt %d, %d messages): %s",
            response.status_code,
            payload.get("model"),
            attempt,
            len(payload.get("messages", [])),
            _ORG_ID_RE.sub("org_***", error_text),
        )

        retryable = (
            response.status_code == 429
            and attempt == 1
            and wait is not None
            and wait <= MAX_AUTO_RETRY_WAIT
            and "per day" not in error_text.lower()
        )
        if retryable:
            time.sleep(wait + 0.25)
            continue
        return None, _limit_message(response.status_code, error_text, wait)

    return None, _limit_message(429, "", None)


@app.get("/models")
def list_models():
    return {"default": arvo_models.DEFAULT_ID, "models": arvo_models.public_models()}


@app.post("/chat")
def chat(
    request: ChatRequest,
    x_plan: str | None = Header(default=None),
):

    plan_id = get_plan_from_request(x_plan)

    check_and_increment_usage(plan_id)

    if not _groq_ready():
        raise HTTPException(
            status_code=500,
            detail="GROQ_API_KEY must be set.",
        )

    try:
        response, limit_error = _post_groq(
            _groq_payload(request.model, _build_messages(request.message, []), stream=False),
            stream=False,
            timeout=60,
        )
        if limit_error:
            raise HTTPException(status_code=429, detail=limit_error)
        response.raise_for_status()

    except requests.RequestException as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Could not reach Groq: {exc}",
        ) from exc

    data = response.json()

    return {
        "response": strip_thinking(
            data["choices"][0]["message"]["content"]
        )
    }


# ============================================================
# STREAMING CHAT (Groq)
# ============================================================

def stream_groq_chat(
    message: str,
    history: list[Message],
    model_id: str | None = None,
    images: list[str] | None = None,
) -> Iterator[str]:

    if not _groq_ready():
        yield "data: " + json.dumps(
            {"error": "GROQ_API_KEY must be set."}
        ) + "\n\n"
        return

    if images:
        image_error = _validate_images(images)
        if not image_error and not arvo_models.supports_vision(model_id or arvo_models.DEFAULT_ID):
            # Only some models can read pictures; switch to one for this message.
            model_id = arvo_models.vision_model_id()
            if model_id is None:
                image_error = "Reading pictures isn't available right now. Please try again later."
        if image_error:
            yield "data: " + json.dumps({"error": image_error}) + "\n\n"
            return

    try:

        response, limit_error = _post_groq(
            _groq_payload(model_id, _build_messages(message, history, images), stream=True),
            stream=True,
            timeout=120,
        )

        if limit_error:
            yield "data: " + json.dumps({"error": limit_error}) + "\n\n"
            return

        with response:

            response.raise_for_status()
            response.encoding = "utf-8"

            for raw in response.iter_lines(decode_unicode=True):

                if not raw or not raw.startswith("data:"):
                    continue

                payload = raw[5:].strip()

                if payload == "[DONE]":
                    break

                try:
                    chunk = json.loads(payload)
                except json.JSONDecodeError:
                    continue

                choices = chunk.get("choices") or []
                if not choices:
                    continue

                content = (choices[0].get("delta") or {}).get("content")

                if content:
                    yield "data: " + json.dumps({"content": content}) + "\n\n"

            yield "data: " + json.dumps({"done": True}) + "\n\n"

    except requests.RequestException as exc:

        yield "data: " + json.dumps({"error": str(exc)}) + "\n\n"


@app.post("/chat/stream")
def chat_stream(
    request: ChatStreamRequest,
    x_plan: str | None = Header(default=None),
):

    plan_id = get_plan_from_request(x_plan)

    check_and_increment_usage(plan_id)

    return StreamingResponse(

        stream_groq_chat(
            request.message,
            request.history,
            request.model,
            request.images,
        ),

        media_type="text/event-stream",

        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


# ============================================================
# USER / PLAN
# ============================================================

@app.get("/users/me/plan")
def get_my_plan(
    email: str = "",
):

    return {
        "plan": users.get_plan(email),
    }


# ============================================================
# ADMIN USERS
# ============================================================

@app.get(
    "/admin/users",
    dependencies=[Depends(require_admin)],
)
def admin_list_users():

    return users.list_users()


@app.post(
    "/admin/users",
    dependencies=[Depends(require_admin)],
)
def admin_upsert_user(
    grant: UserGrantRequest,
):

    return users.upsert_user(
        grant.email,
        grant.plan,
        grant.note,
    )


@app.delete(
    "/admin/users/{email}",
    dependencies=[Depends(require_admin)],
)
def admin_delete_user(
    email: str,
):

    users.delete_user(email)

    return {
        "deleted": email,
    }


# ============================================================
# BILLING
# ============================================================

@app.get("/billing/prices")
def billing_prices():

    return billing.get_live_prices()


@app.post("/billing/checkout")
def billing_checkout(
    request: CheckoutRequest,
):

    try:

        url = billing.create_checkout_session(
            request.plan,
            request.email,
        )

    except billing.BillingError as exc:

        raise HTTPException(
            status_code=400,
            detail=str(exc),
        ) from exc

    return {
        "url": url,
    }


@app.post("/billing/portal")
def billing_portal(
    request: PortalRequest,
):

    try:

        url = billing.create_billing_portal_session(
            request.email,
        )

    except billing.BillingError as exc:

        raise HTTPException(
            status_code=400,
            detail=str(exc),
        ) from exc

    return {
        "url": url,
    }


@app.post("/billing/webhook")
async def billing_webhook(
    request: Request,
    stripe_signature: str | None = Header(default=None),
):

    payload = await request.body()

    try:

        event = billing.construct_webhook_event(
            payload,
            stripe_signature or "",
        )

    except (
        billing.BillingError,
        ValueError,
    ) as exc:

        raise HTTPException(
            status_code=400,
            detail=str(exc),
        ) from exc

    except Exception as exc:

        raise HTTPException(
            status_code=400,
            detail=f"Invalid webhook signature: {exc}",
        ) from exc

    billing.handle_webhook_event(event)

    return {
        "received": True,
    }


# ============================================================
# IMAGE GENERATION
# ============================================================

@app.post("/generate-image")
def generate_image(
    request: ImageGenerateBody,
):

    if not request.prompt.strip():

        raise HTTPException(
            status_code=400,
            detail="A prompt is required.",
        )

    if not (
        1
        <= request.num_images
        <= MAX_NUM_IMAGES
    ):

        raise HTTPException(
            status_code=400,
            detail=(
                f"num_images must be between "
                f"1 and {MAX_NUM_IMAGES}."
            ),
        )

    provider = get_image_provider()

    try:

        images = provider.generate(

            ImageGenerationRequest(

                prompt=request.prompt,

                aspect_ratio=request.aspect_ratio,

                num_images=request.num_images,

                quality=request.quality,

                style=request.style,

                reference_image_b64=(
                    _strip_data_url_prefix(
                        request.reference_image
                    )
                ),
            )
        )

    except ImageProviderError as exc:

        raise HTTPException(
            status_code=400,
            detail=str(exc),
        ) from exc

    return {
        "images": [
            {
                "data": img.base64_data,
                "mime_type": img.mime_type,
            }
            for img in images
        ],
    }


# ============================================================
# VIDEO GENERATION
# ============================================================

@app.post("/generate-video")
def generate_video(
    request: VideoGenerateBody,
):

    if not request.prompt.strip():

        raise HTTPException(
            status_code=400,
            detail="A prompt is required.",
        )

    provider = get_video_provider()

    try:

        job = provider.start(

            VideoGenerationRequest(

                prompt=request.prompt,

                aspect_ratio=request.aspect_ratio,

                duration=request.duration,

                quality=request.quality,

                reference_image_b64=(
                    _strip_data_url_prefix(
                        request.reference_image
                    )
                ),
            )
        )

    except VideoProviderError as exc:

        raise HTTPException(
            status_code=400,
            detail=str(exc),
        ) from exc

    return {
        "job_id": job.id,
        "status": job.status.value,
        "video_url": job.video_url,
        "progress": job.progress,
    }


@app.get("/generate-video/{job_id}")
def get_video_job(
    job_id: str,
):

    provider = get_video_provider()

    try:

        job = provider.poll(job_id)

    except VideoProviderError as exc:

        raise HTTPException(
            status_code=400,
            detail=str(exc),
        ) from exc

    return {
        "job_id": job.id,
        "status": job.status.value,
        "video_url": job.video_url,
        "thumbnail_url": job.thumbnail_url,
        "progress": job.progress,
        "error": job.error,
    }



