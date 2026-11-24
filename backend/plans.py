import os

PlanId = str

PLAN_ORDER: list[PlanId] = ["free", "hobby", "pro", "max", "premium", "premiumPlus"]

PLAN_NAMES: dict[PlanId, str] = {
    "free": "Free",
    "hobby": "Hobby",
    "pro": "Pro",
    "max": "Max",
    "premium": "Premium",
    "premiumPlus": "Premium+",
}

PLAN_DAILY_LIMITS: dict[PlanId, int] = {
    "free": int(os.environ.get("FREE_DAILY_LIMIT", "40")),
    "hobby": int(os.environ.get("HOBBY_DAILY_LIMIT", "500")),
    "pro": int(os.environ.get("PRO_DAILY_LIMIT", "1500")),
    "max": int(os.environ.get("MAX_DAILY_LIMIT", "4000")),
    "premium": int(os.environ.get("PREMIUM_DAILY_LIMIT", "4000")),
    "premiumPlus": int(os.environ.get("PREMIUM_PLUS_DAILY_LIMIT", "10000")),
}

# Arvo model ids each plan may use; None means every model. This matches the
# pricing cards: model switching (and picture reading, which needs Arvo 1.1)
# starts at Pro.
PLAN_MODEL_ACCESS: dict[PlanId, set[str] | None] = {
    "free": {"arvo-1.0"},
    "hobby": {"arvo-1.0"},
    "pro": None,
    "max": None,
    "premium": None,
    "premiumPlus": None,
}


def normalize_plan(plan: str | None) -> PlanId:
    if plan in PLAN_DAILY_LIMITS:
        return plan
    return "free"


def can_use_model(plan: PlanId, model_id: str) -> bool:
    access = PLAN_MODEL_ACCESS.get(plan, PLAN_MODEL_ACCESS["free"])
    return access is None or model_id in access


def required_plan_for_model(model_id: str) -> PlanId:
    """Cheapest plan that includes this model."""
    for plan in PLAN_ORDER:
        if can_use_model(plan, model_id):
            return plan
    return PLAN_ORDER[-1]
