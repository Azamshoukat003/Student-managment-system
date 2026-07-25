"""Flask application entrypoint — Student Management System API.

Run from the backend/ directory:
    python -m waitress --listen=127.0.0.1:8000 --threads=8 app.main:app
Dev server:
    python -m app.main
"""
import time

from flask import Flask, g, jsonify
from flask_cors import CORS
from sqlalchemy import inspect, text
from sqlalchemy.exc import OperationalError

from app import models  # noqa: F401 — ensure all tables register on Base.metadata
from app.config import settings
from app.database import Base, SessionLocal, engine
from app.seed import seed_admin
from app.web import ApiError


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


def _migrate_columns() -> None:
    """Add any users columns missing from an older database (create_all won't).

    All added columns are nullable, so a plain ALTER TABLE is safe on both
    SQLite and PostgreSQL — no Alembic needed.
    """
    new_columns = {
        "father_name": "VARCHAR(120)",
        "program": "VARCHAR(120)",
        "section": "VARCHAR(20)",
        "address": "VARCHAR(255)",
    }
    existing = {c["name"] for c in inspect(engine).get_columns("users")}
    with engine.begin() as conn:
        for name, ddl_type in new_columns.items():
            if name not in existing:
                conn.execute(text(f"ALTER TABLE users ADD COLUMN {name} {ddl_type}"))
                print(f"[startup] added users.{name}")


def create_app() -> Flask:
    _init_db()
    _migrate_columns()
    seed_admin()

    app = Flask("student-management-system")
    CORS(
        app,
        origins=settings.cors_origin_list,
        supports_credentials=True,
        allow_headers="*",
        methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    )

    # ── Per-request DB session ────────────────────────────────────────────
    @app.before_request
    def open_session():
        g.db = SessionLocal()

    @app.teardown_appcontext
    def close_session(exc):
        db = g.pop("db", None)
        if db is not None:
            if exc is not None:
                db.rollback()
            db.close()

    # ── Error contract: {"detail": ...} everywhere, like FastAPI ─────────
    @app.errorhandler(ApiError)
    def handle_api_error(e: ApiError):
        resp = jsonify({"detail": e.detail})
        resp.status_code = e.status_code
        for k, v in e.headers.items():
            resp.headers[k] = v
        return resp

    @app.errorhandler(404)
    def handle_404(e):
        return jsonify({"detail": "Not Found"}), 404

    @app.errorhandler(405)
    def handle_405(e):
        return jsonify({"detail": "Method Not Allowed"}), 405

    @app.errorhandler(500)
    def handle_500(e):
        return jsonify({"detail": "Internal Server Error"}), 500

    @app.get("/api/health")
    def health():
        return {"status": "ok", "database": "sqlite" if settings.is_sqlite else "postgresql"}

    # ── Blueprints ────────────────────────────────────────────────────────
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

    for module in (
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
        app.register_blueprint(module.bp)

    return app


app = create_app()


if __name__ == "__main__":
    app.run(port=8000, threaded=True, debug=True)
