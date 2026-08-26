"""
One-time setup: creates the MyAI subscription Products + Prices in your Stripe
account and prints the environment variables to add to your backend config.

Usage:
    Set STRIPE_SECRET_KEY in your shell environment first (never paste it into
    a script or commit it), then run:

        cd backend
        python scripts/stripe_setup.py

Safe to re-run — it looks up existing MyAI products by name before creating
new ones, so it won't create duplicates on a second run.
"""

import os
import sys

import stripe

STRIPE_SECRET_KEY = os.environ.get("STRIPE_SECRET_KEY")
if not STRIPE_SECRET_KEY:
    print("STRIPE_SECRET_KEY is not set in this shell. Set it first, e.g.:")
    print('  $env:STRIPE_SECRET_KEY = "sk_live_..."   (PowerShell)')
    print('  export STRIPE_SECRET_KEY="sk_live_..."   (bash)')
    sys.exit(1)

stripe.api_key = STRIPE_SECRET_KEY

PLANS = [
    {"id": "hobby", "name": "MyAI Hobby", "amount": 1800, "env": "STRIPE_PRICE_HOBBY"},
    {"id": "pro", "name": "MyAI Pro", "amount": 3000, "env": "STRIPE_PRICE_PRO"},
    {"id": "max", "name": "MyAI Max", "amount": 6000, "env": "STRIPE_PRICE_MAX"},
    {"id": "premium", "name": "MyAI Premium", "amount": 10000, "env": "STRIPE_PRICE_PREMIUM"},
    {"id": "premiumPlus", "name": "MyAI Premium+", "amount": 20000, "env": "STRIPE_PRICE_PREMIUM_PLUS"},
]


def find_existing_product(name: str):
    for product in stripe.Product.list(active=True, limit=100).auto_paging_iter():
        if product.name == name:
            return product
    return None


def main():
    print(f"Using Stripe account in {'LIVE' if STRIPE_SECRET_KEY.startswith('sk_live') else 'TEST'} mode.\n")
    env_lines = []

    for plan in PLANS:
        product = find_existing_product(plan["name"])
        if product:
            print(f"Found existing product '{plan['name']}' ({product.id})")
        else:
            product = stripe.Product.create(name=plan["name"])
            print(f"Created product '{plan['name']}' ({product.id})")

        prices = stripe.Price.list(product=product.id, active=True, limit=10)
        price = next(
            (
                p
                for p in prices.data
                if p.unit_amount == plan["amount"] and p.recurring and p.recurring.interval == "month"
            ),
            None,
        )
        if price:
            print(f"  Using existing price {price.id} (${plan['amount'] / 100:.2f}/month)")
        else:
            price = stripe.Price.create(
                product=product.id,
                unit_amount=plan["amount"],
                currency="usd",
                recurring={"interval": "month"},
            )
            print(f"  Created price {price.id} (${plan['amount'] / 100:.2f}/month)")

        env_lines.append(f"{plan['env']}={price.id}")

    print("\nAdd these to your backend environment (.env or your host's config):\n")
    for line in env_lines:
        print(f"  {line}")
    print("\nAlso set STRIPE_WEBHOOK_SECRET after creating a webhook endpoint in the")
    print("Stripe Dashboard (Developers -> Webhooks) pointing to:")
    print("  <your-backend-url>/billing/webhook")
    print("Listen for: checkout.session.completed, customer.subscription.updated, customer.subscription.deleted")


if __name__ == "__main__":
    main()
