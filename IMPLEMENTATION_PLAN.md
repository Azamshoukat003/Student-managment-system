# Implementation Plan — Face + GPS Attendance System (Production)

> **Status: All 6 phases built and verified against Neon.** See [README.md](README.md)
> to run it. Phases 0–1 (auth/data model), 2 (React app), 3 (sessions), 4 (GPS),
> 5 (face recognition — verified with real faces at 0.96 match), 6 (reports/manual/
> approvals/CSV/activity) are complete. Each phase was smoke-tested end-to-end.

**Goal:** Migrate the current Flask/SQLite/Jinja MVP to the spec's target stack —
**React (Vite) + FastAPI + Neon PostgreSQL + JWT** — while reusing the existing
FaceNet/MTCNN face-recognition pipeline.

**Source of truth:** [PRODUCTION_REQUIREMENTS.md](PRODUCTION_REQUIREMENTS.md).
This document maps that spec to concrete files, schema, endpoints, and build phases.

---

## 1. Target architecture

```
React SPA (Vite)  ──HTTP + JWT──►  FastAPI  ──SQLAlchemy──►  Neon PostgreSQL
  camera/GPS capture               validation                users, sessions,
  role-based routing               JWT auth                  records, embeddings
  dashboards/charts                face + gps services
                                        │
                                   FaceNet + MTCNN (reused ML)
```

### Repository layout (new)

```
attendance_app/
├─ backend/
│  ├─ app/
│  │  ├─ main.py                 # FastAPI app, CORS, router mounting, startup
│  │  ├─ config.py               # pydantic-settings: DATABASE_URL, JWT_SECRET…
│  │  ├─ database.py             # SQLAlchemy engine + SessionLocal + Base
│  │  ├─ core/
│  │  │  ├─ security.py          # bcrypt hashing, JWT encode/decode
│  │  │  └─ deps.py              # get_db, get_current_user, require_role(...)
│  │  ├─ models/                 # SQLAlchemy ORM (one file per table)
│  │  ├─ schemas/                # Pydantic v2 request/response models
│  │  ├─ services/
│  │  │  ├─ face_service.py      # embed / register / verify-identity
│  │  │  ├─ gps_service.py       # haversine + accuracy checks
│  │  │  ├─ attendance_service.py# the 11-check pipeline + status calc
│  │  │  └─ report_service.py    # CSV export + filters
│  │  ├─ routers/                # auth, users, classes, subjects, face,
│  │  │                          #   sessions, records, reports, dashboard
│  │  └─ ml/                     # recognize.py, train.py (reused/adapted)
│  ├─ alembic/                   # DB migrations
│  ├─ requirements.txt
│  └─ .env.example
├─ frontend/
│  ├─ src/
│  │  ├─ api/client.js           # axios + JWT interceptor
│  │  ├─ auth/                    # AuthContext, ProtectedRoute, RoleRoute
│  │  ├─ components/              # Camera, GpsCapture, tables, charts, forms
│  │  ├─ pages/{admin,teacher,student}/
│  │  ├─ routes.jsx
│  │  └─ main.jsx
│  ├─ package.json
│  └─ .env                        # VITE_API_BASE_URL
└─ PRODUCTION_REQUIREMENTS.md
```

The existing MVP (`app.py`, `database.py`, `templates/`, `static/`) stays untouched
until the new stack reaches parity, then is archived.

---

## 2. Technology decisions

| Concern | Choice | Rationale |
|---|---|---|
| Backend | **FastAPI + Uvicorn** | Spec §20; auto OpenAPI docs, typed. |
| DB access | **SQLAlchemy 2.0 (sync) + psycopg** | Sync keeps it simple; FastAPI runs sync routes in a threadpool. ML is CPU-bound anyway. |
| Migrations | **Alembic** | Versioned schema for Neon. |
| Validation | **Pydantic v2** | Request/response contracts. |
| Auth | **PyJWT + passlib[bcrypt]** | JWT access tokens; bcrypt hashing (replaces MVP's plain SHA-256). Spec §24. |
| Face | **keras-facenet + mtcnn + opencv** (reused) | Already working; swap the global SVM for per-student embedding match (§4). |
| Similarity | **numpy cosine** | Only compare to the logged-in student's embedding — no classifier/retrain needed. |
| Frontend | **React 18 + Vite + react-router v6 + axios** | Spec §21. |
| Charts | **Recharts** | Lightweight dashboards (§17). |
| CSV | **Python csv / StreamingResponse** | Spec §16/§25. |
| Config | **pydantic-settings + .env** | No hardcoded Neon creds (§24). |

**Key ML change:** drop `model.pkl` / `scaler.pkl` / `encoder.pkl` (global SVM). Instead store each
student's 512-d embedding(s) in `face_embeddings` and, at attendance time, compare the captured
face's embedding **only against the logged-in student's** stored embedding. This directly implements
the spec's identity rule (§10: "recognized face must match the logged-in student's account") and
removes the retrain step.

---

## 3. Database schema (Neon PostgreSQL)

Field-level design derived from spec §18–19, with types and constraints made concrete.

### `users` — admin, teacher, student in one table
```
id                SERIAL PK
full_name         TEXT NOT NULL
email             TEXT UNIQUE NOT NULL
password_hash     TEXT NOT NULL
role              TEXT NOT NULL CHECK (role IN ('admin','teacher','student'))
registration_number TEXT UNIQUE            -- students only
department        TEXT                     -- teachers only
class_id          INT REFERENCES classes(id)   -- students only
semester          INT                      -- students only
phone             TEXT
profile_image     TEXT
is_active         BOOLEAN NOT NULL DEFAULT TRUE
face_registered   BOOLEAN NOT NULL DEFAULT FALSE
created_at        TIMESTAMPTZ DEFAULT now()
updated_at        TIMESTAMPTZ DEFAULT now()
```

### `classes`
```
id, name, program, semester, created_at, updated_at
```

### `subjects`
```
id, name, code, class_id → classes(id), created_at, updated_at
```

### `teacher_classes` — assignment (spec §3.1 "assign teachers to classes/subjects")
```
id, teacher_id → users(id), class_id → classes(id), subject_id → subjects(id), created_at
UNIQUE(teacher_id, class_id, subject_id)
```

### `face_embeddings`
```
id, student_id → users(id), embedding (JSONB or BYTEA, 512-d),
image_path, is_active BOOLEAN DEFAULT TRUE, created_at, updated_at
```

### `attendance_sessions`
```
id, teacher_id, class_id, subject_id, session_date DATE,
start_time TIME, end_time TIME, late_cutoff_time TIME NULL,
latitude DOUBLE PRECISION, longitude DOUBLE PRECISION,
allowed_radius_meters INT DEFAULT 100,
status TEXT CHECK (status IN ('open','closed','cancelled')) DEFAULT 'open',
created_at, updated_at
```

### `attendance_records`
```
id, session_id → attendance_sessions(id), student_id → users(id),
status TEXT CHECK (status IN ('present','late','absent','pending','rejected')),
method TEXT CHECK (method IN ('face','manual')),
confidence_score FLOAT, latitude, longitude, gps_accuracy FLOAT,
distance_from_session FLOAT,
approval_status TEXT CHECK (approval_status IN ('approved','pending','rejected')) DEFAULT 'approved',
marked_by INT REFERENCES users(id) NULL,   -- teacher for manual
reason TEXT, marked_at TIMESTAMPTZ, created_at, updated_at,
UNIQUE(session_id, student_id)             -- enforces "one mark per session"
```

### `activity_logs` (optional, spec §26)
```
id, user_id, action, detail, created_at
```

---

## 4. Face recognition redesign

**Registration** (`POST /api/face/register`, student):
1. Frontend captures N frames (spec §10 "multiple face samples").
2. Backend: MTCNN detect → crop → FaceNet embed each frame → keep valid 512-d vectors.
3. Store as `face_embeddings` rows (or one averaged embedding + keep sample images at `image_path`).
4. Set `users.face_registered = TRUE`.

**Verification at attendance** (inside mark-face flow):
1. Frontend captures 1 frame.
2. Backend embeds it, loads the **logged-in student's** active embedding(s).
3. `cosine_similarity(captured, stored)` → `confidence_score`.
4. If `>= FACE_MATCH_THRESHOLD` → identity confirmed; else reject (or → `pending` if borderline, §14).

**Deactivation rule (§4.5):** set `face_embeddings.is_active = FALSE` (and `users.is_active = FALSE`)
so deactivated students are never matched.

No global retrain, no `.pkl` model files.

---

## 5. Attendance engine (the heart of the system)

### 5.1 GPS logic (spec §9) — `gps_service.py`
- `haversine(lat1,lon1,lat2,lon2) -> meters`.
- Reject if `gps_accuracy > MAX_GPS_ACCURACY (100 m)` → ask retry.
- Compute `distance_from_session`; if `distance > allowed_radius_meters` → reject.

### 5.2 Status by time (spec §15) — computed at mark time against the session
```
now < start_time                 → rejected ("session not started")
start_time ≤ now ≤ end_time       → present
end_time  < now ≤ late_cutoff     → late
now > late_cutoff (or end_time)   → rejected ("session closed")
```

### 5.3 Validation pipeline (spec §8) — `attendance_service.mark_face()`
Run in order; first failure returns a clear message, nothing saved:
1. Student authenticated (JWT) ✔
2. `users.is_active` ✔
3. Student's `class_id` == session `class_id` ✔
4. Session `status == 'open'` ✔
5. Current time inside window (§5.2) ✔
6. GPS coords present ✔
7. `gps_accuracy` acceptable ✔
8. Inside radius (§5.1) ✔
9. Face detected ✔
10. Face matches logged-in student (§4) ✔
11. No existing record for `(session_id, student_id)` ✔ (also enforced by UNIQUE)

On success → insert `attendance_records` with computed status/method=`face`/approval=`approved`
(or `pending` for borderline face/GPS per §14).

### 5.4 Manual attendance (spec §13) — teacher only
Fields: session, student, status(present/late/absent), reason(**required**), marked_by, marked_at.
Students blocked from marking their own manually. Records tagged `method='manual'`.

### 5.5 Approve / reject (spec §14) — teacher/admin
Endpoints to move `pending` → `approved`/`rejected` with a comment.

---

## 6. API surface (spec §22)

`Auth` column: 🔓 public · 🔑 any logged-in · A/T/S = role required.

| Method & path | Auth | Purpose |
|---|---|---|
| `POST /api/auth/login` | 🔓 | Login by email **or** reg number → JWT |
| `POST /api/auth/logout` | 🔑 | Client-side token discard / server note |
| `GET  /api/auth/me` | 🔑 | Current user profile |
| `PUT  /api/auth/password` | 🔑 | Change own password (§4.3 step 4) |
| `POST /api/users` | A | Create student/teacher |
| `GET  /api/users` | A | List/filter users |
| `PUT  /api/users/{id}` | A | Edit user |
| `DELETE /api/users/{id}` | A | Deactivate (soft, §4.5) |
| `POST /api/users/{id}/reset-password` | A | Admin temp password (§4.3) |
| `GET/POST /api/classes`, `PUT/DELETE /api/classes/{id}` | A | Class mgmt |
| `GET/POST /api/subjects`, `PUT/DELETE /api/subjects/{id}` | A | Subject mgmt |
| `POST /api/teacher-classes` | A | Assign teacher↔class↔subject |
| `POST /api/face/register` | S | Register embeddings |
| `POST /api/attendance-sessions` | T | Create session (loc/radius/time) |
| `GET  /api/attendance-sessions/active` | S/T | Open session for student's class |
| `GET  /api/attendance-sessions` | T/A | List (filters) |
| `PUT  /api/attendance-sessions/{id}/close` | T | Close session |
| `POST /api/attendance-records/mark-face` | S | The §8 pipeline |
| `POST /api/attendance-records/manual` | T | Manual mark (§13) |
| `PUT  /api/attendance-records/{id}/approve` | T/A | §14 |
| `PUT  /api/attendance-records/{id}/reject` | T/A | §14 |
| `GET  /api/attendance-records` | role-scoped | Student=own, Teacher=classes, Admin=all |
| `GET  /api/reports/attendance` | role-scoped | Filters: date range/class/subject/student/status |
| `GET  /api/reports/attendance/export` | role-scoped | CSV (§16/§25) |
| `GET  /api/dashboard/summary` | role-scoped | Counts per role (§17) |

---

## 7. Frontend pages & routing (spec §21)

Role-based routing via `AuthContext` + `RoleRoute`. After login, redirect by role.

- **Shared:** `Login`, `Profile` (name/phone/image/password), `404`.
- **Admin:** `Dashboard` (totals/charts), `Users`, `Classes`, `Subjects`,
  `TeacherAssignments`, `AttendanceRecords`, `Reports` (+CSV).
- **Teacher:** `Dashboard`, `Sessions` (create w/ "use my location"/manual lat-lng),
  `ClassAttendance`, `ManualAttendance`, `PendingApprovals`, `Reports`.
- **Student:** `Dashboard` (attendance %), `FaceRegistration` (camera),
  `MarkAttendance` (camera + GPS), `MyAttendance`.

Reusable components: `<CameraCapture>` (getUserMedia), `<GpsCapture>` (navigator.geolocation
→ lat/lng/accuracy), `<StatCard>`, `<AttendanceTable>`, `<FilterBar>`, Recharts wrappers.

---

## 8. Build phases (maps spec §27)

Each phase ends in a runnable, demoable state.

**Phase 0 — Scaffolding**
FastAPI + Vite skeletons, Neon connection via `.env`, health check, CORS, Alembic init.
*Done when:* `GET /api/health` returns OK and React dev server calls it.

**Phase 1 — Data model + auth + roles + admin mgmt** *(spec Phase 1)*
All tables + Alembic migration; JWT login (email/reg-no); `require_role`; seed admin;
users/classes/subjects/teacher-assignment CRUD.
*Done when:* admin logs in, creates a teacher, a class, a subject, a student, assigns teacher.

**Phase 2 — React shell + dashboards** *(spec Phase 2)*
Auth context, role routing, three dashboards with real counts, admin management UIs, Profile.
*Done when:* all three roles log in and land on their dashboard.

**Phase 3 — Attendance sessions** *(spec Phase 3)*
Teacher create/close session with location+radius+time; student sees active session.
*Done when:* teacher opens a session, student's page detects it.

**Phase 4 — GPS radius check** *(spec Phase 4)*
`<GpsCapture>`, Haversine + accuracy validation, store distance/accuracy on record.
*Done when:* attendance rejected outside radius / poor accuracy, accepted inside.

**Phase 5 — Face recognition** *(spec Phase 5)*
Face registration → embeddings; mark-face runs the full §8 pipeline (GPS + identity + time + dup).
*Done when:* a registered student marks attendance end-to-end; wrong face rejected.

**Phase 6 — Reports & polish** *(spec Phase 6)*
5 report types + CSV export + filters; manual attendance; approve/reject; profile update;
dashboard charts; activity logs (optional).
*Done when:* CSV exports with filters; manual + approval flows work.

---

## 9. Data migration & seeding

- Fresh Neon schema via Alembic (no schema carry-over from SQLite).
- Optional one-off script to import existing `students` rows from `attendance.db` as `role='student'`
  users (face images can be re-registered under the new embedding model).
- Seed one admin from env (`ADMIN_EMAIL`, `ADMIN_PASSWORD`) — no hardcoded credentials.

## 10. Security checklist (spec §24)

- [ ] bcrypt password hashing (upgrade from SHA-256)
- [ ] JWT with expiry + `JWT_SECRET` from env
- [ ] Role guards on every non-public route
- [ ] File-upload validation (image type/size on face frames)
- [ ] Inactive users cannot log in; deactivated students not recognized
- [ ] `DATABASE_URL` / secrets only in env, never committed (`.env` gitignored)
- [ ] CORS locked to the frontend origin

## 11. Zero-cost hosting (spec §23)

- DB: Neon free tier. Backend: Render/Railway free (or run locally for demo).
  Frontend: Vercel/Netlify free. GitHub for source.

## 12. Open decisions before/while building

1. **Embedding storage:** one averaged vector per student vs. multiple samples? *(Recommend: keep
   multiple, compare against best match — more robust.)*
2. **pgvector vs JSONB:** Neon supports `pgvector`; but since we only compare to one student we can
   store JSONB and compute cosine in Python. *(Recommend: JSONB now, pgvector later if needed.)*
3. **Liveness (§11):** include blink detection in Phase 5 or defer to future? *(Recommend: defer;
   ship face+GPS first.)*
4. **Session auto-close:** cron/background job vs. compute status lazily from time. *(Recommend:
   lazy — no scheduler needed for a zero-cost FYP.)*
```
