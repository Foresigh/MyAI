import os

PlanId = str

PLAN_MODELS: dict[PlanId, str] = {
    "free": os.environ.get("FREE_MODEL_NAME", "qwen3:8b"),
    "hobby": os.environ.get("HOBBY_MODEL_NAME", "qwen3:14b"),
    "pro": os.environ.get("PRO_MODEL_NAME", "qwen3:32b"),
    "max": os.environ.get("MAX_MODEL_NAME", "qwen3:32b"),
    "premium": os.environ.get("PREMIUM_MODEL_NAME", "qwen3:32b"),
    "premiumPlus": os.environ.get("PREMIUM_PLUS_MODEL_NAME", "qwen3:32b"),
}

PLAN_DAILY_LIMITS: dict[PlanId, int] = {
    "free": int(os.environ.get("FREE_DAILY_LIMIT", "40")),
    "hobby": int(os.environ.get("HOBBY_DAILY_LIMIT", "500")),
    "pro": int(os.environ.get("PRO_DAILY_LIMIT", "1500")),
    "max": int(os.environ.get("MAX_DAILY_LIMIT", "4000")),
    "premium": int(os.environ.get("PREMIUM_DAILY_LIMIT", "4000")),
    "premiumPlus": int(os.environ.get("PREMIUM_PLUS_DAILY_LIMIT", "10000")),
}


def normalize_plan(plan: str | None) -> PlanId:
    if plan in PLAN_MODELS:
        return plan
    return "free"
