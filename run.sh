#!/usr/bin/env bash
# One-command launcher for macOS / Linux — sets up (if needed) and runs both servers.
set -e
cd "$(dirname "$0")"

echo "=== AI-Powered Smart Attendance System — Launcher ==="

command -v python3 >/dev/null 2>&1 || { echo "[ERROR] Install Python 3.11+ first."; exit 1; }
command -v node    >/dev/null 2>&1 || { echo "[ERROR] Install Node.js 18+ first."; exit 1; }

# Backend: virtual environment
[ -d .venv ] || { echo "[setup] Creating virtual environment..."; python3 -m venv .venv; }

# Backend: install deps if missing
if ! .venv/bin/python -c "import fastapi, onnxruntime, cv2" >/dev/null 2>&1; then
  echo "[setup] Installing backend dependencies (first run only)..."
  .venv/bin/python -m pip install --upgrade pip
  .venv/bin/python -m pip install -r backend/requirements.txt
fi

# Backend: .env (falls back to local SQLite if DATABASE_URL is empty)
[ -f backend/.env ] || { cp backend/.env.example backend/.env; echo "[setup] Created backend/.env — set DATABASE_URL for Neon, or leave blank for local SQLite."; }

# Frontend: install node modules if missing
[ -d frontend/node_modules ] || { echo "[setup] Installing frontend dependencies (first run only)..."; ( cd frontend && npm install ); }

echo "[run] Backend  -> http://localhost:8000/docs"
( cd backend && ../.venv/bin/python -m uvicorn app.main:app --port 8000 ) &
BACK=$!
echo "[run] Frontend -> http://localhost:5173"
( cd frontend && npm run dev ) &
FRONT=$!

trap "echo; echo 'Stopping...'; kill $BACK $FRONT 2>/dev/null" EXIT INT TERM
echo "=== Both servers running. Press Ctrl+C to stop. ==="
wait
