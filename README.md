# Arvo

A local, Qwen-powered AI coding assistant with a Claude-quality chat interface — FastAPI + Ollama backend, React/TypeScript frontend.

## Quick start

**Backend** (needs [Ollama](https://ollama.com) running locally with `qwen3:8b` pulled):
```powershell
cd backend
pip install -r requirements.txt
python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```
An `ADMIN_KEY` is auto-generated and printed on first run if you don't set one — use it to access `/admin`.

**Frontend**:
```powershell
cd frontend
npm install
npm run dev
```
Open http://localhost:5173.

## What's here

- `backend/` — FastAPI app: streaming chat (`/chat/stream`), plan-based model routing and rate limits, an admin-gated user/plan registry, and Stripe billing (checkout + webhooks).
- `frontend/` — React + TypeScript + Vite: sidebar with conversation history, streaming markdown/code rendering, file attachments, a pricing page, and settings.
- `training/` — an unrelated small PyTorch experiment, not wired into the app.

## Plans

Free, Hobby ($18/mo), Pro ($30/mo), Max ($60/mo), Premium ($100/mo), Premium+ ($200/mo) — see `frontend/src/types/plans.ts` for what each tier includes. Paid plans bill through Stripe; run `backend/scripts/stripe_setup.py` once (with `STRIPE_SECRET_KEY` set) to create the products/prices.

## Deploying it publicly

See [DEPLOYMENT.md](DEPLOYMENT.md) for running both the backend (bundled with Ollama) and the frontend as two services on Railway.
