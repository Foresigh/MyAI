# Deploying Arvo

Both the backend (bundled with Ollama) and the frontend run as two separate services in one [Railway](https://railway.app) project.

## Before you deploy: understand the tradeoffs

Ollama needs real RAM and CPU (or GPU) to run a model. Railway's compute is CPU-only and billed by usage:

- `qwen3:8b` (the Free-tier model) needs roughly 6–8GB RAM to run comfortably and will respond noticeably slower on Railway's shared CPU than it did on your own machine during testing.
- The bigger models used by paid tiers (`qwen3:14b`/`32b`) need much more RAM — likely more than a small Railway plan gives you. Until you provision enough RAM to pull them, Arvo's existing fallback logic quietly serves everyone `qwen3:8b`; paid tiers still get real value from higher message limits and priority, just not a bigger model yet.
- A model running continuously consumes compute-hours continuously. Pick a Railway plan with a RAM allocation you're comfortable paying for, and watch usage for the first few days.

Start with just `qwen3:8b` on a modest plan, confirm it works and feels acceptable, then scale RAM up if you want to enable bigger models for paid tiers.

## 1. Deploy the backend service

1. Railway dashboard → **New Project → Deploy from GitHub repo** → select `MyAI`.
2. In that service's **Settings**, set **Root Directory** to `backend`. Railway detects `backend/Dockerfile` and `backend/railway.json` automatically.
3. Add two **Volumes** (Settings → search "volume" in the filter box):
   - Mount Path `/root/.ollama` — persists the pulled model across deploys/restarts so it isn't re-downloaded every time.
   - Mount Path `/app/data` — persists plan grants (admin + Stripe) across deploys. Skip this only if you're fine with grants resetting on every redeploy.
4. In **Variables**, add:
   - `ADMIN_KEY` — a long random string you choose; keep it private.
   - `MODEL_NAME` — `qwen3:8b` to start.
   - `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` — from your Stripe Dashboard (webhook secret comes in step 4 below — fill it in later).
   - `STRIPE_PRICE_HOBBY`, `STRIPE_PRICE_PRO`, `STRIPE_PRICE_MAX`, `STRIPE_PRICE_PREMIUM`, `STRIPE_PRICE_PREMIUM_PLUS` — run `python backend/scripts/stripe_setup.py` locally (with `STRIPE_SECRET_KEY` set in your shell) to create these and print the values.
   - `FRONTEND_URL` and `ALLOWED_ORIGINS` — leave blank for now, you'll fill these in after step 2 below.
   - Railway sets `PORT` automatically — `start.sh` already reads it, don't override it.
5. Deploy. First boot pulls the model, which can take several minutes — the healthcheck has a generous timeout for this. Watch the deploy logs; you should see "Ollama is up" then the model pull progress.
6. Once healthy, go to **Settings → Networking → Generate Domain**. You get a URL like `https://myai-backend-production.up.railway.app`. Confirm it works:
   ```
   curl https://myai-backend-production.up.railway.app/health
   ```

## 2. Deploy the frontend service

1. In the **same Railway project**, click **New → GitHub Repo** and select `MyAI` again (a second service in the same project, not a new project).
2. In that service's **Settings**, set **Root Directory** to `frontend`. Railway detects `frontend/Dockerfile` and `frontend/railway.json`.
3. In **Variables**, add `VITE_API_URL` = the backend URL from step 1.6. This gets baked into the build (Vite reads it at build time), so if you ever change it, redeploy this service afterward.
4. Deploy. Once healthy, go to **Settings → Networking → Generate Domain** to get your public site URL, e.g. `https://myai-frontend-production.up.railway.app`.

## 3. Wire the two services together

1. Go back to the **backend service's Variables** and set `FRONTEND_URL` and `ALLOWED_ORIGINS` to the frontend URL from step 2.4. Railway redeploys the backend automatically when you save a variable.
2. Visit the frontend URL and confirm the chat actually reaches the backend (check the status dot in the top bar — it should say "My AI 1.0 online", not "backend offline").

## 4. Point Stripe at production

1. Stripe Dashboard → Developers → Webhooks → Add endpoint:
   `<your backend URL>/billing/webhook`
   Listen for: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`.
2. Copy the endpoint's signing secret into the backend's `STRIPE_WEBHOOK_SECRET` variable and let it redeploy.
3. Make one real low-value test purchase yourself once live to confirm the full loop (checkout → webhook → plan grant) before announcing the site — you're using live Stripe keys, so this is a real charge to your own card.

## Updating the live site

Push to GitHub — both Railway services redeploy automatically. The Ollama volume persists, so the backend won't re-pull the model unless you change `MODEL_NAME`.

## Notes

- In-memory daily message counters reset on backend restart — fine at personal/small scale; move to a real database if you outgrow it.
- `backend/data/users.json` holds plan grants (admin + Stripe) and is gitignored. It's written to `/app/data` in the container — a **different path** from the Ollama volume at `/root/.ollama`, so it will NOT persist across redeploys unless you added the second Volume in step 1.3. Without that, every redeploy wipes all plan grants back to Free.
- `ADMIN_KEY` is your only gate on `/admin` — treat it like a password.
- Running frontend + backend as two services in the same Railway project means one bill, one dashboard, and you can see both services' logs side by side when debugging.
