# Attendance API (FastAPI backend)

Production backend for the Face + GPS attendance system.
See [../PRODUCTION_REQUIREMENTS.md](../PRODUCTION_REQUIREMENTS.md) and
[../IMPLEMENTATION_PLAN.md](../IMPLEMENTATION_PLAN.md).

## Setup

```bash
# from the repo root, using the existing venv
backend/                     # cd here
../.venv/Scripts/python.exe -m pip install -r requirements.txt
```

Configure `backend/.env` (copy from `.env.example`). Set `DATABASE_URL` to your
Neon connection string; leave it blank to use a local SQLite dev DB.

## Run

```bash
cd backend
../.venv/Scripts/python.exe -m uvicorn app.main:app --reload --port 8000
```

- API base: `http://localhost:8000`
- Interactive docs (Swagger): `http://localhost:8000/docs`
- Health: `GET /api/health`

On first startup the app creates all tables and seeds one admin from
`ADMIN_EMAIL` / `ADMIN_PASSWORD` (default `admin@attendance.local` / `admin123`).

## Status — Phase 1 complete

Implemented & verified against Neon (20/20 smoke checks):

- JWT auth, bcrypt hashing, login by **email or registration number**
- Role guards (`admin` / `teacher` / `student`)
- Admin CRUD: users, classes, subjects, teacher→class/subject assignment
- Self-service: `/me`, profile update, change password
- Admin password reset; soft-deactivate (also disables face embeddings)

## Next phases

3. Attendance sessions · 4. GPS radius check · 5. Face recognition ·
6. Reports / manual attendance / approvals. (Phase 2 is the React frontend.)
