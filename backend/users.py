import json
import logging
import os
import threading
from datetime import datetime, timezone

import storage

logger = logging.getLogger("arvo.users")

# Held across each read-modify-write so two updates at once can't undo each other.
_lock = threading.RLock()


def users_file() -> str:
    return os.path.join(storage.data_dir(), "users.json")


def load_users() -> dict:
    with _lock:
        path = users_file()
        if not os.path.exists(path):
            return {}
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
            return data if isinstance(data, dict) else {}
        except (OSError, ValueError) as exc:
            logger.error("Could not read %s: %s", path, exc)
            return {}


def save_users(users: dict) -> None:
    with _lock:
        storage.write_json_atomic(users_file(), users)


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
    with _lock:
        return _upsert_locked(email, plan, note, source, stripe_customer_id, stripe_subscription_id)


def _upsert_locked(email, plan, note, source, stripe_customer_id, stripe_subscription_id) -> dict:
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
    with _lock:
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
