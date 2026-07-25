# Student Management System

A web-based **Student Management System** (per the SRS/SDD in [docs/](docs/)) built with
**Python Flask**, extended with **face + GPS verified attendance**: admins manage student
records (add, update, search, filter, reports); teachers open GPS-restricted attendance
sessions; students mark attendance with **face recognition + browser GPS**.

**Stack:** Flask (Python) · React (Vite) UI · SQLite / PostgreSQL (SQLAlchemy) · JWT ·
ArcFace + YuNet (ONNX Runtime)

- Requirements docs: [docs/SRS](docs/) · [docs/SDD](docs/)
- Build plan & architecture: [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md)

---

## Prerequisites

- **Python 3.11+** and **Node.js 18+** installed and on PATH.
- (Optional) A PostgreSQL connection string (e.g. Neon). Without one, the app runs on a
  local SQLite database automatically — matching the SDD's SQLite (dev) / SQL (prod) split.

## Quick start (one click)

On a fresh PC, after cloning the repo:

- **Windows:** double-click **`start.bat`**
- **macOS / Linux:** run **`./run.sh`**

The launcher automatically creates the Python virtual environment, installs backend and
frontend dependencies **only if they're missing**, creates `backend/.env` from the example,
and starts both servers — then opens the app in your browser.

- App: http://localhost:5173
- API health: http://localhost:8000/api/health

To use PostgreSQL instead of local SQLite, put your connection string in `DATABASE_URL`
inside `backend/.env`.

The manual steps below do the same thing by hand.

## 1. Backend (Flask)

```bash
cd backend
../.venv/Scripts/python.exe -m pip install -r requirements.txt   # first time only
../.venv/Scripts/python.exe -m app.main                          # dev server on :8000
# production-style: ../.venv/Scripts/python.exe -m waitress --listen=127.0.0.1:8000 app.main:app
```

- On first start it creates all tables and seeds an admin from `backend/.env`
  (`ADMIN_EMAIL` / `ADMIN_PASSWORD`, default `admin@attendance.local` / `admin123`).

## 2. Frontend (React)

```bash
cd frontend
npm install          # first time only
npm run dev          # http://localhost:5173
```

The dev server proxies `/api` to the backend on :8000, so run both together.

## First-run walkthrough

1. Log in as **admin** → **Students** → add student records (roll no, father name,
   program, semester, section, class, address); search/filter, open a student's
   detail, **Export CSV** or **Print** the list.
2. Create a **class**, a **subject**, and a **teacher** (Users page); **assign** the
   teacher to the class + subject.
3. Log in as the **student** → **Face Registration** → capture a few photos.
4. Log in as the **teacher** → **Sessions** → create a session (use *my location* +
   radius, and a time window that is open now).
5. Back as the **student** → **Mark Attendance** → confirm location, then capture face.
6. **Attendance / Reports** (admin or teacher) → filter and **Export CSV**; approve/reject
   pending records; add **manual** attendance.

## Feature map (docs → build)

| Docs area | Where |
|---|---|
| Login / logout, role-based access (UC-01, UC-09) | `backend/app/routers/auth.py`, `core/deps.py` |
| Student records CRUD (UC-02…UC-05) | `routers/users.py`, `frontend/src/pages/admin/Students.jsx` |
| Search / filter students (UC-06) | Students page toolbar + `/api/users` query params |
| Generate reports, print/export (UC-07) | Students page CSV/print, `routers/reports.py` |
| Manage user accounts (UC-08) | `routers/users.py`, Users page |
| Sessions + time windows | `routers/sessions.py`, `services/time_rules.py` |
| GPS geofence | `services/gps.py`, `routers/records.py:check-location` |
| Face embeddings + identity match | `ml/embedder.py`, `services/face_service.py`, `routers/face.py` |
| Attendance mark pipeline | `routers/records.py:mark-face` |
| Dashboards | `routers/dashboard.py` |
| Activity logs | `routers/activity.py` |

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

- Backend is **Flask** (per the docs' framework constraint) with SQLAlchemy ORM;
  passwords are hashed (bcrypt via Werkzeug-compatible passlib), and admin-only routes
  are protected with role decorators — as specified in SDD §4.7.
- Face recognition uses ONNX Runtime (YuNet + ArcFace); models load on the first face
  request, then are fast. CPU-only, ~200–300 MB RAM.
- Face verification compares a capture only against the **logged-in** student's own
  embeddings, so one student can't mark using another's face.
- Secrets live only in `backend/.env` (gitignored) — no credentials in code.
