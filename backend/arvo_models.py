import os
import time

import requests

GROQ_MODELS_URL = "https://api.groq.com/openai/v1/models"
DEFAULT_ID = "arvo-1.0"

ARVO_MODELS = [
    {"id": "arvo-1.0", "name": "Arvo 1.0", "description": "Fast everyday assistant. Quick answers and general chat.", "groq": "openai/gpt-oss-20b", "license": "Apache-2.0", "enabled": True, "extra": {}},
    {"id": "arvo-1.1", "name": "Arvo 1.1", "description": "Balanced. Good reasoning and writing. Can read pictures.", "groq": "qwen/qwen3.8-27b", "license": "Apache-2.0", "enabled": True, "extra": {"reasoning_format": "hidden"}, "vision": True},
    {"id": "arvo-1.2", "name": "Arvo 1.2", "description": "Most capable. Best for coding and hard problems.", "groq": "openai/gpt-oss-120b", "license": "Apache-2.0", "enabled": True, "extra": {}},
    {"id": "arvo-1.3", "name": "Arvo 1.3", "description": "Strong all-rounder for long answers.", "groq": "llama-3.3-70b-versatile", "license": "Llama community license", "enabled": False, "extra": {}},
]


_cache = {"ids": None, "at": 0.0}


def _available_ids():
    if _cache["ids"] is not None and time.time() - _cache["at"] < 300:
        return _cache["ids"]
    key = os.environ.get("GROQ_API_KEY")
    if not key:
        return None
    try:
        r = requests.get(GROQ_MODELS_URL, headers={"Authorization": f"Bearer {key}"}, timeout=10)
        r.raise_for_status()
        ids = {m["id"] for m in r.json().get("data", [])}
        _cache["ids"] = ids
        _cache["at"] = time.time()
        return ids
    except requests.RequestException:
        return _cache["ids"]


def _live_models():
    available = _available_ids()
    out = []
    for m in ARVO_MODELS:
        if not m["enabled"]:
            continue
        if available is not None and m["groq"] not in available:
            continue
        out.append(m)
    return out


def public_models():
    return [{"id": m["id"], "name": m["name"], "description": m["description"]} for m in _live_models()]



def vision_model_id():
    """Id of a live model that can read images, or None."""
    for m in _live_models():
        if m.get("vision"):
            return m["id"]
    return None


def supports_vision(model_id):
    return any(m["id"] == model_id and m.get("vision") for m in _live_models())


def lookup(model_id):
    live = _live_models()
    for m in live:
        if m["id"] == model_id:
            return m
    for m in live:
        if m["id"] == DEFAULT_ID:
            return m
    if live:
        return live[0]
    return {"groq": os.environ.get("GROQ_MODEL", ""), "extra": {}}


# When a model hits Groq's rate limit, the coding agent moves on to the next
# one here. Each model has its own limits, so this multiplies what Arvo can
# do before it has to wait. All of these can call tools.
AGENT_FALLBACK_ORDER = ["arvo-1.0", "arvo-1.2", "arvo-1.1"]


def agent_models(model_id):
    """The chosen model first, then the others to try when it is rate limited."""
    first = lookup(model_id)
    live = {m["id"]: m for m in _live_models()}
    out = [first]
    for fallback_id in AGENT_FALLBACK_ORDER:
        m = live.get(fallback_id)
        if m and m["groq"] != first.get("groq"):
            out.append(m)
    return out
