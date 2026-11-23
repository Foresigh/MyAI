import json
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

IDENTITY RULES:

Your name is ARVO.

Do not introduce yourself as Qwen.

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


def _build_messages(message: str, history: list[Message]) -> list[dict]:
    messages = [{"role": "system", "content": ARVO_SYSTEM_PROMPT}]
    messages.extend({"role": m.role, "content": m.content} for m in history)
    messages.append({"role": "user", "content": message})
    return messages


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
        response = requests.post(
            GROQ_URL,
            headers=_groq_headers(),
            json={
                "model": arvo_models.lookup(request.model)["groq"],
                **arvo_models.lookup(request.model)["extra"],
                "messages": _build_messages(request.message, []),
                "stream": False,
            },
            timeout=60,
        )
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
) -> Iterator[str]:

    if not _groq_ready():
        yield "data: " + json.dumps(
            {"error": "GROQ_API_KEY must be set."}
        ) + "\n\n"
        return

    try:

        with requests.post(
            GROQ_URL,
            headers=_groq_headers(),
            json={
                "model": arvo_models.lookup(model_id)["groq"],
                **arvo_models.lookup(model_id)["extra"],
                "messages": _build_messages(message, history),
                "stream": True,
            },
            stream=True,
            timeout=120,
        ) as response:

            if response.status_code == 429:
                yield "data: " + json.dumps(
                    {"error": "Rate limit reached. Please try again in a moment."}
                ) + "\n\n"
                return

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



