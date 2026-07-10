# Face + GPS Attendance System

A zero-cost, web-based attendance system: teachers open GPS-restricted attendance
sessions; students mark attendance with **face recognition + browser GPS**. The backend
verifies location radius, face identity, session time, and duplicates before saving.

**Stack:** React (Vite) · FastAPI · Neon PostgreSQL · JWT · ArcFace + YuNet (ONNX Runtime)

- Requirements: [PRODUCTION_REQUIREMENTS.md](PRODUCTION_REQUIREMENTS.md)
- Build plan & architecture: [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md)

> The original Flask/SQLite MVP still lives in the repo root (`app.py`, `templates/`,
> `static/`). The production system is the new `backend/` + `frontend/`.

---

## Prerequisites

- Python 3.11+ (a `.venv` already exists in the repo) and Node.js 18+
- A Neon PostgreSQL connection string (already set in `backend/.env`)

## 1. Backend (FastAPI)

```bash
cd backend
../.venv/Scripts/python.exe -m pip install -r requirements.txt   # first time only
../.venv/Scripts/python.exe -m uvicorn app.main:app --reload --port 8000
```

- API: http://localhost:8000  ·  Docs: http://localhost:8000/docs
- On first start it creates all tables in Neon and seeds an admin from `backend/.env`
  (`ADMIN_EMAIL` / `ADMIN_PASSWORD`, default `admin@attendance.local` / `admin123`).

## 2. Frontend (React)

```bash
cd frontend
npm install          # first time only
npm run dev          # http://localhost:5173
```

The dev server proxies `/api` to the backend on :8000, so run both together.

## First-run walkthrough

1. Log in as **admin** → create a **class**, a **subject**, a **teacher**, and a
   **student** (assign the student to the class); then **assign** the teacher to the
   class + subject.
2. Log in as the **student** → **Face Registration** → capture a few photos.
3. Log in as the **teacher** → **Sessions** → create a session (use *my location* +
   radius, and a time window that is open now).
4. Back as the **student** → **Mark Attendance** → confirm location, then capture face.
5. **Attendance / Reports** (admin or teacher) → filter and **Export CSV**; approve/reject
   pending records; add **manual** attendance.

## Feature map (spec → build)

| Spec area | Where |
|---|---|
| 3-role JWT auth, admin CRUD | `backend/app/routers/{auth,users,classes,subjects,teacher_classes}.py` |
| Sessions + time windows (§6, §15) | `routers/sessions.py`, `services/time_rules.py` |
| GPS geofence (§9) | `services/gps.py`, `routers/records.py:check-location` |
| Face embeddings + identity match (§10) | `ml/embedder.py`, `services/face_service.py`, `routers/face.py` |
| 11-check mark pipeline (§8) | `routers/records.py:mark-face` |
| Manual / approve-reject (§13, §14) | `routers/records.py` |
| Reports + CSV (§16, §25) | `routers/reports.py`, `services/reports.py` |
| Dashboards (§17) | `routers/dashboard.py` |
| Activity logs (§26) | `routers/activity.py` |

## Camera & guided face capture

- Face registration and marking use a **guided auto-capture** flow powered by MediaPipe
  FaceLandmarker (in-browser): a green ring fills as you hold each pose (look ahead →
  right → left for registration; look ahead for marking), then it captures automatically.
- The detector's model + wasm are **self-hosted** in `frontend/public/` (`models/`,
  `mediapipe/`) so it works offline — no CDN.
- `getUserMedia` requires a **secure context**: `localhost` works in dev; a deployed
  frontend must be served over **HTTPS**.
- Every capture screen also has a **"Capture manually"** fallback, so attendance never
  blocks if auto-detection misbehaves on a given device.

## Notes

- Face recognition uses ONNX Runtime (YuNet + ArcFace); models load on the first face request, then are fast. CPU-only, ~200–300 MB RAM (fits free tiers).
- Face verification compares a capture only against the **logged-in** student's own
  embeddings, so one student can't mark using another's face.
- Secrets live only in `backend/.env` (gitignored) — no credentials in code.
