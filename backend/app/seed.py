"""Seed the first admin account from env on startup (spec §24: no hardcoded creds)."""
from app.config import settings
from app.core.security import hash_password
from app.database import SessionLocal
from app.models.user import ROLE_ADMIN, User


def seed_admin() -> None:
    db = SessionLocal()
    try:
        if db.query(User).filter(User.role == ROLE_ADMIN).first():
            return
        admin = User(
            full_name=settings.admin_name,
            email=settings.admin_email,
            password_hash=hash_password(settings.admin_password),
            role=ROLE_ADMIN,
            is_active=True,
        )
        db.add(admin)
        db.commit()
        print(f"[seed] Created admin account: {settings.admin_email}")
    finally:
        db.close()
