"""FastAPI application entrypoint.

Run from the backend/ directory:
    uvicorn app.main:app --reload --port 8000
Interactive API docs: http://localhost:8000/docs
"""
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.exc import OperationalError

from app import models  # noqa: F401 — ensure all tables register on Base.metadata
from app.config import settings
from app.database import Base, engine
from app.routers import (
    activity,
    auth,
    classes,
    dashboard,
    face,
    records,
    reports,
    sessions,
    subjects,
    teacher_classes,
    users,
)
from app.seed import seed_admin


def _init_db(retries: int = 6, delay: float = 2.5) -> None:
    """Create tables, retrying transient connection failures.

    Neon free tier autosuspends and cold-starts, so the first connection can
    briefly fail (DNS / timeout) before the compute is ready.
    """
    for attempt in range(1, retries + 1):
        try:
            Base.metadata.create_all(bind=engine)
            return
        except OperationalError as e:
            if attempt == retries:
                raise
            print(f"[startup] database not ready (attempt {attempt}/{retries}); retrying… {e.orig}")
            time.sleep(delay)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create tables if missing, then seed the first admin.
    _init_db()
    seed_admin()
    yield


app = FastAPI(
    title="Face + GPS Attendance API",
    description="Zero-cost face + GPS attendance system (see PRODUCTION_REQUIREMENTS.md).",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health", tags=["health"])
def health():
    return {"status": "ok", "database": "sqlite" if settings.is_sqlite else "postgresql"}


for r in (
    auth,
    users,
    classes,
    subjects,
    teacher_classes,
    sessions,
    face,
    records,
    reports,
    dashboard,
    activity,
):
    app.include_router(r.router)
