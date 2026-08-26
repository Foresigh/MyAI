# Deploying MyAI

Architecture for a public MyAI site:

- **Backend + Ollama** run on your Windows PC at home (needs the GPU/CPU for inference).
- **Cloudflare Tunnel** exposes that backend publicly over HTTPS — no router port-forwarding needed.
- **Frontend** is a static build hosted on Cloudflare Pages (free), auto-deployed from this GitHub repo.

The site is only reachable while that PC and Ollama are running.

## 1. Prepare the backend PC

1. Install [Ollama](https://ollama.com) and pull the models you plan to serve:
   ```powershell
   ollama pull qwen3:8b
   ollama pull qwen3:14b   # for Hobby
   ollama pull qwen3:32b   # for Pro/Max/Premium/Premium+
   ```
   Any tier whose model isn't pulled automatically falls back to `qwen3:8b`.
2. Clone the repo and install dependencies:
   ```powershell
   git clone https://github.com/Foresigh/MyAI.git
   cd MyAI\backend
   pip install -r requirements.txt
   ```
3. Set these as permanent environment variables (System Properties → Environment Variables, or your process manager's config):
   - `ADMIN_KEY` — a long random string you choose; keep it private.
   - `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` — from your Stripe Dashboard.
   - `STRIPE_PRICE_HOBBY`, `STRIPE_PRICE_PRO`, `STRIPE_PRICE_MAX`, `STRIPE_PRICE_PREMIUM`, `STRIPE_PRICE_PREMIUM_PLUS` — run `python scripts/stripe_setup.py` (with `STRIPE_SECRET_KEY` set) to create these and print the values.
   - `FRONTEND_URL` — your Cloudflare Pages URL, e.g. `https://myai.pages.dev`.
   - `ALLOWED_ORIGINS` — the same URL (comma-separate if you add a custom domain too).
4. Run it persistently. Simplest option — [NSSM](https://nssm.cc/) as a Windows service:
   ```powershell
   nssm install MyAIBackend "C:\Path\To\python.exe" "-m uvicorn main:app --host 127.0.0.1 --port 8000"
   nssm set MyAIBackend AppDirectory "C:\Path\To\MyAI\backend"
   nssm start MyAIBackend
   ```
   Keep it bound to `127.0.0.1` — only the tunnel (running on the same machine) needs to reach it, so it never needs to be open to your LAN or the internet directly.

## 2. Expose it with Cloudflare Tunnel

1. Create a free Cloudflare account and add a domain (Cloudflare's registrar or transfer an existing one).
2. Install `cloudflared` on the same PC, then:
   ```powershell
   cloudflared tunnel login
   cloudflared tunnel create myai-backend
   cloudflared tunnel route dns myai-backend api.yourdomain.com
   ```
3. Create `config.yml` next to `cloudflared.exe`:
   ```yaml
   tunnel: myai-backend
   credentials-file: C:\Users\<you>\.cloudflared\<tunnel-id>.json
   ingress:
     - hostname: api.yourdomain.com
       service: http://localhost:8000
     - service: http_status:404
   ```
4. Run it as a service so it survives reboots:
   ```powershell
   cloudflared service install
   ```
   `https://api.yourdomain.com` now reaches your backend.

## 3. Deploy the frontend to Cloudflare Pages

1. Cloudflare Dashboard → Pages → Create project → connect this GitHub repo.
2. Build settings:
   - Root directory: `frontend`
   - Build command: `npm run build`
   - Output directory: `dist`
3. Environment variable: `VITE_API_URL = https://api.yourdomain.com`
4. Deploy. Pages gives you `https://<project>.pages.dev` (attach a custom domain if you like).

## 4. Point Stripe at production

1. Stripe Dashboard → Developers → Webhooks → Add endpoint:
   `https://api.yourdomain.com/billing/webhook`
   Listen for: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`.
2. Copy the endpoint's signing secret into `STRIPE_WEBHOOK_SECRET` on the backend PC and restart the service.
3. Make a real low-value test purchase yourself once live to confirm the full loop (checkout → webhook → plan grant) before announcing the site.

## Notes

- In-memory daily message counters reset if the backend restarts — fine at personal/small scale; move to a real database if you outgrow it.
- `backend/data/users.json` holds plan grants (admin + Stripe) and is gitignored — back it up if it matters to you.
- To update the live site after a code change: push to GitHub (Pages redeploys the frontend automatically), and pull + restart the `MyAIBackend` service on the PC for backend changes.
