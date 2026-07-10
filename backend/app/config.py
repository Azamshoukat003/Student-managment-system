"""Application settings, loaded from environment / .env (spec §24: no hardcoded creds)."""
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Database ---------------------------------------------------------------
    # Blank falls back to a local SQLite dev DB so the app runs before Neon is wired.
    database_url: str = ""

    # Auth -------------------------------------------------------------------
    jwt_secret: str = "change-me"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 720

    # Seed admin -------------------------------------------------------------
    admin_name: str = "System Admin"
    admin_email: str = "admin@attendance.local"
    admin_password: str = "admin123"

    # CORS -------------------------------------------------------------------
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    # Attendance tuning (spec §9, §10) --------------------------------------
    # ArcFace (ONNX) cosine thresholds — same-person ~0.65-0.93, different ~0.0
    face_match_threshold: float = 0.45
    face_pending_threshold: float = 0.35
    max_gps_accuracy: float = 100.0
    default_radius_meters: int = 100

    @property
    def sqlalchemy_url(self) -> str:
        """Normalize the DB URL for SQLAlchemy; fall back to local SQLite."""
        url = (self.database_url or "").strip()
        if not url:
            return "sqlite:///./attendance_dev.db"
        # Neon gives postgresql://…  — route it through the psycopg v3 driver.
        if url.startswith("postgresql://"):
            url = "postgresql+psycopg://" + url[len("postgresql://"):]
        elif url.startswith("postgres://"):
            url = "postgresql+psycopg://" + url[len("postgres://"):]
        return url

    @property
    def is_sqlite(self) -> bool:
        return self.sqlalchemy_url.startswith("sqlite")

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
