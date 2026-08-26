import json
import os
import threading
from datetime import datetime, timezone

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
USERS_FILE = os.path.join(DATA_DIR, "users.json")
_lock = threading.Lock()


def _ensure_file() -> None:
    os.makedirs(DATA_DIR, exist_ok=True)
    if not os.path.exists(USERS_FILE):
        with open(USERS_FILE, "w") as f:
            json.dump({}, f)


def load_users() -> dict:
    _ensure_file()
    with _lock:
        with open(USERS_FILE, "r") as f:
            return json.load(f)


def save_users(users: dict) -> None:
    _ensure_file()
    with _lock:
        with open(USERS_FILE, "w") as f:
            json.dump(users, f, indent=2)


def get_plan(email: str) -> str:
    if not email:
        return "free"
    users = load_users()
    entry = users.get(email.lower())
    if entry and entry.get("plan"):
        return entry["plan"]
    return "free"


def upsert_user(
    email: str,
    plan: str,
    note: str = "",
    source: str = "admin",
    stripe_customer_id: str | None = None,
    stripe_subscription_id: str | None = None,
) -> dict:
    users = load_users()
    key = email.lower()
    existing = users.get(key, {})
    entry = {
        "email": email,
        "plan": plan,
        "note": note,
        "source": source,
        "stripeCustomerId": stripe_customer_id or existing.get("stripeCustomerId"),
        "stripeSubscriptionId": stripe_subscription_id or existing.get("stripeSubscriptionId"),
        "addedAt": existing.get("addedAt", datetime.now(timezone.utc).isoformat()),
    }
    users[key] = entry
    save_users(users)
    return entry


def delete_user(email: str) -> None:
    users = load_users()
    users.pop(email.lower(), None)
    save_users(users)


def list_users() -> list:
    users = load_users()
    return sorted(users.values(), key=lambda u: u.get("addedAt", ""), reverse=True)


def find_by_customer_id(customer_id: str) -> dict | None:
    users = load_users()
    for entry in users.values():
        if entry.get("stripeCustomerId") == customer_id:
            return entry
    return None


def find_by_subscription_id(subscription_id: str) -> dict | None:
    users = load_users()
    for entry in users.values():
        if entry.get("stripeSubscriptionId") == subscription_id:
            return entry
    return None
