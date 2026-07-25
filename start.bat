@echo off
setlocal EnableExtensions
cd /d "%~dp0"

echo ============================================================
echo    Student Management System  -  Launcher
echo ============================================================
echo.

REM ---- Check prerequisites -------------------------------------------------
where python >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Python is not installed or not on PATH.
  echo         Install Python 3.11+ from https://www.python.org/downloads/
  echo         ^(tick "Add Python to PATH" during install^), then re-run this file.
  echo.
  pause
  exit /b 1
)
where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js is not installed or not on PATH.
  echo         Install Node.js 18+ from https://nodejs.org/ , then re-run this file.
  echo.
  pause
  exit /b 1
)

REM ---- Backend: virtual environment ---------------------------------------
if not exist ".venv\Scripts\python.exe" (
  echo [setup] Creating Python virtual environment ^(.venv^) ...
  python -m venv .venv
  if errorlevel 1 ( echo [ERROR] Could not create venv. & pause & exit /b 1 )
)

REM ---- Backend: install dependencies if missing ---------------------------
.venv\Scripts\python -c "import flask, waitress, onnxruntime, cv2" >nul 2>nul
if errorlevel 1 (
  echo [setup] Installing backend dependencies ^(first run only, a few minutes^) ...
  .venv\Scripts\python -m pip install --upgrade pip
  .venv\Scripts\python -m pip install -r backend\requirements.txt
  if errorlevel 1 ( echo [ERROR] Backend dependency install failed. & pause & exit /b 1 )
)

REM ---- Backend: .env (falls back to local SQLite if DATABASE_URL empty) ----
if not exist "backend\.env" (
  echo [setup] Creating backend\.env from example ...
  copy /y "backend\.env.example" "backend\.env" >nul
  echo         Using a local database by default. To use Neon PostgreSQL,
  echo         set DATABASE_URL inside backend\.env
)

REM ---- Frontend: install node modules if missing --------------------------
if not exist "frontend\node_modules" (
  echo [setup] Installing frontend dependencies ^(first run only^) ...
  pushd frontend
  call npm install
  popd
  if errorlevel 1 ( echo [ERROR] Frontend dependency install failed. & pause & exit /b 1 )
)

REM ---- Launch both servers in their own windows ---------------------------
echo.
echo [run] Starting backend  ->  http://localhost:8000/api/health
start "SMS Backend" /d "%CD%\backend" cmd /k ..\.venv\Scripts\python -m waitress --listen=127.0.0.1:8000 --threads=8 app.main:app

echo [run] Starting frontend ->  http://localhost:5173
start "SMS Frontend" /d "%CD%\frontend" cmd /k npm run dev

timeout /t 4 >nul
start "" http://localhost:5173

echo.
echo ============================================================
echo   Both servers are running in separate windows.
echo   App: http://localhost:5173
echo   API: http://localhost:8000/api/health
echo   Close those two windows to stop the servers.
echo ============================================================
echo.
pause
endlocal
