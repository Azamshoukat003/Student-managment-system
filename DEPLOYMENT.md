# Deployment

Three parts: **Database** (Neon — already hosted), **Backend** (FastAPI + TensorFlow),
**Frontend** (static React). Both backend and frontend must be served over **HTTPS** —
camera + GPS require a secure context, and an HTTPS page can't call an HTTP API.

## The one constraint — RAM for TensorFlow

Face recognition loads FaceNet (TensorFlow), which needs **~1–2 GB RAM** at inference.
The 512 MB free tiers (Render/Railway/Koyeb free) will **OOM on the first face request**.
Pick a backend host accordingly:

| Path | Backend host | Cost | Notes |
|---|---|---|---|
| **A** (recommended, free) | Hugging Face Spaces (Docker) | Free, ~16 GB RAM | Best free fit for the ML backend |
| **B** | Render / Railway (Docker) | Free may OOM; ~$7/mo "Starter" is safe | Simple GitHub deploys |
| **C** (demo) | Your PC + Cloudflare Tunnel | Free | Backend runs locally, public HTTPS URL |

Frontend goes on **Vercel** (free, static) in every path.

Files added for deployment: `backend/Dockerfile`, `backend/.dockerignore`, `frontend/vercel.json`.

---

## 1. Database (Neon) — nothing to do
Already hosted. From the Neon dashboard copy the **connection string**; you'll set it as
`DATABASE_URL` on the backend host. No migrations — the app creates tables and seeds an
admin (`ADMIN_EMAIL` / `ADMIN_PASSWORD`) on startup.

## 2. Backend

**Env vars to set on the host (all paths):**

| Var | Value |
|---|---|
| `DATABASE_URL` | your Neon connection string (mark secret) |
| `JWT_SECRET` | a long random string (mark secret) |
| `CORS_ORIGINS` | your frontend URL, e.g. `https://iub-attendance.vercel.app` |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | first admin login |

### Path A — Hugging Face Spaces (free, enough RAM)
1. huggingface.co → **New Space** → SDK **Docker** → Blank.
2. Put the **contents of `backend/`** into the Space repo (the `Dockerfile` must be at the
   Space repo root). Easiest: `git clone` the Space, copy `backend/*` in, commit, push.
3. Space **Settings → Variables and secrets**: add the env vars above.
4. In the Space `README.md` front-matter, set `app_port: 7860`.
5. Build finishes → API at `https://<user>-<space>.hf.space` (docs at `/docs`).

### Path B — Render (Docker, from GitHub)
1. render.com → **New → Web Service** → connect your repo.
2. **Root Directory:** `backend` · **Runtime:** Docker (uses `backend/Dockerfile`).
3. Add the env vars above. Render injects `$PORT` (the Dockerfile handles it).
4. If face requests 502/OOM on Free, switch the instance to **Starter**.
5. URL like `https://xxx.onrender.com` (docs at `/docs`).

### Path C — Local backend + Cloudflare Tunnel (for a live demo)
1. `cd backend && ../.venv/Scripts/python.exe -m uvicorn app.main:app --port 8000`
2. `cloudflared tunnel --url http://localhost:8000` → gives a public **https** URL.
3. Use that URL + `/api` as the frontend's API base; set `CORS_ORIGINS` to your Vercel URL in `backend/.env`.

## 3. Frontend (Vercel)
1. vercel.com → **New Project** → import your GitHub repo.
2. **Root Directory:** `frontend` · Framework: **Vite** (auto) · Build `npm run build` · Output `dist`.
3. Env var: `VITE_API_BASE_URL = https://<your-backend-url>/api`
4. Deploy → `https://<project>.vercel.app`. (`vercel.json` handles SPA deep links.)

## 4. Wire them together
- Backend `CORS_ORIGINS` = the exact Vercel URL (no trailing slash) → redeploy backend.
- Frontend `VITE_API_BASE_URL` = backend URL + `/api` → redeploy frontend if changed.
- Confirm both are **HTTPS**.

## 5. First run
1. Log in with `ADMIN_EMAIL` / `ADMIN_PASSWORD`, then change the password.
2. Create classes/subjects/teachers/students; assign teachers.
3. First face request loads the FaceNet model (a few seconds; the Docker build pre-warms it).

## Post-deploy checklist
- [ ] `GET /api/health` returns `{"status":"ok"}`
- [ ] Login works from the deployed frontend (CORS OK)
- [ ] Face register/mark works (no 502/OOM → RAM OK)
- [ ] Map tiles load; camera + GPS prompt (HTTPS OK)
