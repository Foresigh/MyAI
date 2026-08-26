# Deploying MyAI

- **Backend + Ollama** run together in one container on [Railway](https://railway.app).
- **Frontend** is a static build hosted on [Vercel](https://vercel.com) (free, auto-deploys from this GitHub repo).

## Before you deploy: understand the tradeoffs

Ollama needs real RAM and CPU (or GPU) to run a model. Railway's compute is CPU-only and billed by usage:

- `qwen3:8b` (the Free-tier model) needs roughly 6–8GB RAM to run comfortably and will respond noticeably slower on Railway's shared CPU than it did on your own machine during testing.
- The bigger models used by paid tiers (`qwen3:14b`/`32b`) need much more RAM — likely more than a small Railway plan gives you. Until you provision enough RAM to pull them, MyAI's existing fallback logic quietly serves everyone `qwen3:8b`; paid tiers still get real value from higher message limits and priority, just not a bigger model yet.
- A model running continuously consumes compute-hours continuously. Pick a Railway plan with a RAM allocation you're comfortable paying for, and watch usage for the first few days.

Start with just `qwen3:8b` on a modest plan, confirm it works and feels acceptable, then scale RAM up if you want to enable bigger models for paid tiers.

## 1. Deploy the backend to Railway

1. Push to GitHub (already done) — Railway deploys straight from the repo.
2. Railway dashboard → New Project → Deploy from GitHub repo → select `MyAI`.
3. In the service settings, set **Root Directory** to `backend`. Railway will detect `backend/Dockerfile` and `backend/railway.json` automatically.
4. Add two **Volumes**:
   - Mounted at `/root/.ollama` — persists the pulled model across deploys/restarts so it isn't re-downloaded every time.
   - Mounted at `/app/data` — persists plan grants (admin + Stripe) across deploys. Skip this only if you're fine with grants resetting on every redeploy.
5. Set environment variables on the service:
   - `ADMIN_KEY` — a long random string you choose; keep it private.
   - `MODEL_NAME` — `qwen3:8b` to start.
   - `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` — from your Stripe Dashboard.
   - `STRIPE_PRICE_HOBBY`, `STRIPE_PRICE_PRO`, `STRIPE_PRICE_MAX`, `STRIPE_PRICE_PREMIUM`, `STRIPE_PRICE_PREMIUM_PLUS` — run `python backend/scripts/stripe_setup.py` locally (with `STRIPE_SECRET_KEY` set in your shell) to create these and print the values.
   - `FRONTEND_URL` — your Vercel URL, e.g. `https://myai.vercel.app` (set after step 2 below; update and redeploy once you have it).
   - `ALLOWED_ORIGINS` — same as `FRONTEND_URL`.
   - Railway sets `PORT` automatically — `start.sh` already reads it, don't override it.
6. Deploy. First boot pulls the model, which can take several minutes — the healthcheck is configured with a generous timeout for this. Watch the deploy logs; you should see "Ollama is up" then the model pull progress.
7. Once healthy, Railway gives you a public URL like `https://myai-backend.up.railway.app`. Confirm it works:
   ```
   curl https://myai-backend.up.railway.app/health
   ```

## 2. Deploy the frontend to Vercel

1. Vercel dashboard → Add New → Project → import the `MyAI` GitHub repo.
2. Framework preset: Vite. Root directory: `frontend`.
3. Environment variable: `VITE_API_URL = https://myai-backend.up.railway.app` (your Railway URL from step 1.7).
4. Deploy. Vercel gives you `https://<project>.vercel.app`.
5. Go back to Railway and set `FRONTEND_URL` and `ALLOWED_ORIGINS` to this Vercel URL, then redeploy the backend so CORS and Stripe redirect URLs are correct.

## 3. Point Stripe at production

1. Stripe Dashboard → Developers → Webhooks → Add endpoint:
   `https://myai-backend.up.railway.app/billing/webhook`
   Listen for: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`.
2. Copy the endpoint's signing secret into `STRIPE_WEBHOOK_SECRET` on Railway and redeploy.
3. Make one real low-value test purchase yourself once live to confirm the full loop (checkout → webhook → plan grant) before announcing the site — you're using live Stripe keys, so this is a real charge to your own card.

## Updating the live site

- Push to GitHub → Vercel redeploys the frontend automatically.
- Push to GitHub → Railway redeploys the backend automatically (the Ollama volume persists, so it won't re-pull the model unless you change `MODEL_NAME`).

## Notes

- In-memory daily message counters reset on backend restart — fine at personal/small scale; move to a real database if you outgrow it.
- `backend/data/users.json` holds plan grants (admin + Stripe) and is gitignored. It's written to `/app/data` in the container — a **different path** from the Ollama volume at `/root/.ollama`, so it will NOT persist across redeploys unless you add a second Railway Volume mounted at `/app/data`. Without that, every redeploy wipes all plan grants back to Free. Add it now if you're taking real payments.
- `ADMIN_KEY` is your only gate on `/admin` — treat it like a password.
