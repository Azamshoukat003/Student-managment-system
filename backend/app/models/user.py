from typing import Optional

from sqlalchemy import Boolean, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models.mixins import TimestampMixin

ROLE_ADMIN = "admin"
ROLE_TEACHER = "teacher"
ROLE_STUDENT = "student"
ROLES = (ROLE_ADMIN, ROLE_TEACHER, ROLE_STUDENT)


class User(Base, TimestampMixin):
    """Admin, teacher, and student accounts in one table (spec §19)."""

    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    full_name: Mapped[str] = mapped_column(String(120), nullable=False)
    email: Mapped[str] = mapped_column(String(160), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(20), nullable=False)

    # Student-only
    registration_number: Mapped[Optional[str]] = mapped_column(
        String(60), unique=True, index=True, nullable=True
    )
    class_id: Mapped[Optional[int]] = mapped_column(ForeignKey("classes.id"), nullable=True)
    semester: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    # SRS student-record fields (docs §3.3 ERD: Student entity)
    father_name: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    program: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    section: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    address: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    # Teacher-only
    department: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)

    # Common profile
    phone: Mapped[Optional[str]] = mapped_column(String(40), nullable=True)
    profile_image: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    face_registered: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
