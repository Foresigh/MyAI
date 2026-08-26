import os

import stripe

import users

STRIPE_SECRET_KEY = os.environ.get("STRIPE_SECRET_KEY")
STRIPE_WEBHOOK_SECRET = os.environ.get("STRIPE_WEBHOOK_SECRET")
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:5173")

if STRIPE_SECRET_KEY:
    stripe.api_key = STRIPE_SECRET_KEY

PRICE_ENV_VARS = {
    "hobby": "STRIPE_PRICE_HOBBY",
    "pro": "STRIPE_PRICE_PRO",
    "max": "STRIPE_PRICE_MAX",
    "premium": "STRIPE_PRICE_PREMIUM",
    "premiumPlus": "STRIPE_PRICE_PREMIUM_PLUS",
}


class BillingError(Exception):
    pass


def is_configured() -> bool:
    return bool(STRIPE_SECRET_KEY)


def get_price_id(plan: str) -> str:
    env_var = PRICE_ENV_VARS.get(plan)
    if not env_var:
        raise BillingError(f"'{plan}' is not a paid plan.")
    price_id = os.environ.get(env_var)
    if not price_id:
        raise BillingError(
            f"No Stripe price configured for '{plan}'. Set the {env_var} environment variable "
            "(see backend/scripts/stripe_setup.py to create it)."
        )
    return price_id


def _plan_for_price_id(price_id: str) -> str | None:
    for plan, env_var in PRICE_ENV_VARS.items():
        if os.environ.get(env_var) == price_id:
            return plan
    return None


def create_checkout_session(plan: str, email: str) -> str:
    if not is_configured():
        raise BillingError("Stripe is not configured on this server.")
    if not email:
        raise BillingError("An email is required to start checkout.")

    price_id = get_price_id(plan)
    session = stripe.checkout.Session.create(
        mode="subscription",
        line_items=[{"price": price_id, "quantity": 1}],
        customer_email=email,
        success_url=f"{FRONTEND_URL}/pricing?checkout=success",
        cancel_url=f"{FRONTEND_URL}/pricing?checkout=cancel",
        metadata={"plan": plan, "email": email},
        subscription_data={"metadata": {"plan": plan, "email": email}},
    )
    return session.url


def create_billing_portal_session(email: str) -> str:
    if not is_configured():
        raise BillingError("Stripe is not configured on this server.")

    entry = users.load_users().get(email.lower())
    customer_id = entry.get("stripeCustomerId") if entry else None
    if not customer_id:
        raise BillingError("No billing account found for this email.")

    session = stripe.billing_portal.Session.create(
        customer=customer_id,
        return_url=f"{FRONTEND_URL}/pricing",
    )
    return session.url


def construct_webhook_event(payload: bytes, sig_header: str):
    if not STRIPE_WEBHOOK_SECRET:
        raise BillingError("STRIPE_WEBHOOK_SECRET is not configured on this server.")
    return stripe.Webhook.construct_event(payload, sig_header, STRIPE_WEBHOOK_SECRET)


def handle_webhook_event(event) -> None:
    event_type = event["type"]
    data = event["data"]["object"]

    if event_type == "checkout.session.completed":
        email = data.get("customer_details", {}).get("email") or data.get("metadata", {}).get("email")
        plan = data.get("metadata", {}).get("plan")
        customer_id = data.get("customer")
        subscription_id = data.get("subscription")
        if email and plan:
            users.upsert_user(
                email,
                plan,
                note="Stripe subscription",
                source="stripe",
                stripe_customer_id=customer_id,
                stripe_subscription_id=subscription_id,
            )

    elif event_type == "customer.subscription.updated":
        subscription_id = data.get("id")
        customer_id = data.get("customer")
        status = data.get("status")
        entry = users.find_by_subscription_id(subscription_id) or users.find_by_customer_id(customer_id)
        if not entry:
            return
        if status in ("active", "trialing"):
            price_id = data["items"]["data"][0]["price"]["id"]
            plan = _plan_for_price_id(price_id)
            if plan:
                users.upsert_user(
                    entry["email"],
                    plan,
                    note="Stripe subscription",
                    source="stripe",
                    stripe_customer_id=customer_id,
                    stripe_subscription_id=subscription_id,
                )
        elif status in ("canceled", "unpaid", "incomplete_expired", "past_due"):
            users.upsert_user(
                entry["email"],
                "free",
                note="Stripe subscription lapsed",
                source="stripe",
                stripe_customer_id=customer_id,
                stripe_subscription_id=subscription_id,
            )

    elif event_type == "customer.subscription.deleted":
        subscription_id = data.get("id")
        customer_id = data.get("customer")
        entry = users.find_by_subscription_id(subscription_id) or users.find_by_customer_id(customer_id)
        if entry:
            users.upsert_user(
                entry["email"],
                "free",
                note="Stripe subscription canceled",
                source="stripe",
                stripe_customer_id=customer_id,
                stripe_subscription_id=subscription_id,
            )
