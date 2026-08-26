import json
import os
import re
import secrets
import threading
import time
from datetime import date
from typing import Iterator, Literal

import requests
from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

import billing
import plans
import users

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


class ChatRequest(BaseModel):
    message: str


class Message(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ChatStreamRequest(BaseModel):
    message: str
    history: list[Message] = []


PlanLiteral = Literal["free", "hobby", "pro", "max", "premium", "premiumPlus"]


class UserGrantRequest(BaseModel):
    email: str
    plan: PlanLiteral
    note: str = ""


class CheckoutRequest(BaseModel):
    email: str
    plan: PlanLiteral


class PortalRequest(BaseModel):
    email: str


def require_admin(x_admin_key: str | None = Header(default=None)) -> None:
    if not x_admin_key or x_admin_key != ADMIN_KEY:
        raise HTTPException(status_code=401, detail="Invalid admin key.")


# --- available-model cache, used to gracefully fall back if a plan's model isn't pulled ---
_model_cache = {"models": set(), "checked_at": 0.0}
_model_cache_lock = threading.Lock()


def get_available_models() -> set[str]:
    with _model_cache_lock:
        if time.time() - _model_cache["checked_at"] < 30 and _model_cache["models"]:
            return _model_cache["models"]
    try:
        resp = requests.get(f"{OLLAMA_URL}/api/tags", timeout=5)
        resp.raise_for_status()
        models = {m["name"] for m in resp.json().get("models", [])}
        with _model_cache_lock:
            _model_cache["models"] = models
            _model_cache["checked_at"] = time.time()
        return models
    except requests.RequestException:
        return _model_cache["models"]


def resolve_model_for_plan(plan_id: str) -> str:
    desired = plans.PLAN_MODELS.get(plan_id, plans.PLAN_MODELS["free"])
    available = get_available_models()
    if not available or desired in available:
        return desired
    return plans.PLAN_MODELS["free"]


# --- simple in-memory per-plan daily usage counters (demo-grade, no persistence/auth yet) ---
_usage_lock = threading.Lock()
_usage: dict[str, dict] = {}


def check_and_increment_usage(plan_id: str) -> None:
    today = date.today().isoformat()
    limit = plans.PLAN_DAILY_LIMITS.get(plan_id, plans.PLAN_DAILY_LIMITS["free"])
    with _usage_lock:
        bucket = _usage.get(plan_id)
        if not bucket or bucket["date"] != today:
            bucket = {"date": today, "count": 0}
        if bucket["count"] >= limit:
            _usage[plan_id] = bucket
            raise HTTPException(
                status_code=429,
                detail=f"Daily message limit reached for the {plan_id} plan ({limit}/day).",
            )
        bucket["count"] += 1
        _usage[plan_id] = bucket


def get_plan_from_request(x_plan: str | None) -> str:
    return plans.normalize_plan(x_plan)


@app.get("/")
def home():
    return {"message": "Arvo is online"}


@app.get("/health")
def health():
    try:
        resp = requests.get(f"{OLLAMA_URL}/api/tags", timeout=5)
        resp.raise_for_status()
        models = [m["name"] for m in resp.json().get("models", [])]
        return {
            "status": "ok",
            "ollama": "reachable",
            "model": MODEL_NAME,
            "model_available": MODEL_NAME in models,
        }
    except requests.RequestException as exc:
        return {"status": "error", "ollama": "unreachable", "detail": str(exc)}


@app.post("/chat")
def chat(request: ChatRequest, x_plan: str | None = Header(default=None)):
    plan_id = get_plan_from_request(x_plan)
    check_and_increment_usage(plan_id)
    model = resolve_model_for_plan(plan_id)

    try:
        response = requests.post(
            f"{OLLAMA_URL}/api/generate",
            json={
                "model": model,
                "prompt": request.message,
                "stream": False,
                "think": False,
            },
            timeout=120,
        )
        response.raise_for_status()
    except requests.RequestException as exc:
        raise HTTPException(
            status_code=502, detail=f"Could not reach Ollama: {exc}"
        ) from exc

    data = response.json()
    return {"response": strip_thinking(data["response"])}


def stream_ollama_chat(message: str, history: list[Message], model: str) -> Iterator[str]:
    messages = [{"role": m.role, "content": m.content} for m in history]
    messages.append({"role": "user", "content": message})

    try:
        with requests.post(
            f"{OLLAMA_URL}/api/chat",
            json={
                "model": model,
                "messages": messages,
                "stream": True,
                "think": False,
            },
            stream=True,
            timeout=300,
        ) as response:
            response.raise_for_status()
            for line in response.iter_lines():
                if not line:
                    continue
                chunk = json.loads(line)
                content = chunk.get("message", {}).get("content", "")
                if content:
                    yield f"data: {json.dumps({'content': content})}\n\n"
                if chunk.get("done"):
                    yield f"data: {json.dumps({'done': True})}\n\n"
                    break
    except requests.RequestException as exc:
        yield f"data: {json.dumps({'error': str(exc)})}\n\n"


@app.post("/chat/stream")
def chat_stream(request: ChatStreamRequest, x_plan: str | None = Header(default=None)):
    plan_id = get_plan_from_request(x_plan)
    check_and_increment_usage(plan_id)
    model = resolve_model_for_plan(plan_id)

    return StreamingResponse(
        stream_ollama_chat(request.message, request.history, model),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@app.get("/users/me/plan")
def get_my_plan(email: str = ""):
    return {"plan": users.get_plan(email)}


@app.get("/admin/users", dependencies=[Depends(require_admin)])
def admin_list_users():
    return users.list_users()


@app.post("/admin/users", dependencies=[Depends(require_admin)])
def admin_upsert_user(grant: UserGrantRequest):
    return users.upsert_user(grant.email, grant.plan, grant.note)


@app.delete("/admin/users/{email}", dependencies=[Depends(require_admin)])
def admin_delete_user(email: str):
    users.delete_user(email)
    return {"deleted": email}


@app.post("/billing/checkout")
def billing_checkout(request: CheckoutRequest):
    try:
        url = billing.create_checkout_session(request.plan, request.email)
    except billing.BillingError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"url": url}


@app.post("/billing/portal")
def billing_portal(request: PortalRequest):
    try:
        url = billing.create_billing_portal_session(request.email)
    except billing.BillingError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"url": url}


@app.post("/billing/webhook")
async def billing_webhook(request: Request, stripe_signature: str | None = Header(default=None)):
    payload = await request.body()
    try:
        event = billing.construct_webhook_event(payload, stripe_signature or "")
    except (billing.BillingError, ValueError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # signature verification failure
        raise HTTPException(status_code=400, detail=f"Invalid webhook signature: {exc}") from exc

    billing.handle_webhook_event(event)
    return {"received": True}
