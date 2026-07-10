from datetime import date, time
from typing import Optional

from sqlalchemy import Date, Float, ForeignKey, Integer, String, Time
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models.mixins import TimestampMixin

SESSION_OPEN = "open"
SESSION_CLOSED = "closed"
SESSION_CANCELLED = "cancelled"


class AttendanceSession(Base, TimestampMixin):
    """A teacher-created, GPS-restricted attendance window (spec §6, §19)."""

    __tablename__ = "attendance_sessions"

    id: Mapped[int] = mapped_column(primary_key=True)
    teacher_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    class_id: Mapped[int] = mapped_column(ForeignKey("classes.id"), nullable=False, index=True)
    subject_id: Mapped[int] = mapped_column(ForeignKey("subjects.id"), nullable=False, index=True)

    session_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    start_time: Mapped[time] = mapped_column(Time, nullable=False)
    end_time: Mapped[time] = mapped_column(Time, nullable=False)
    late_cutoff_time: Mapped[Optional[time]] = mapped_column(Time, nullable=True)

    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    allowed_radius_meters: Mapped[int] = mapped_column(Integer, default=100, nullable=False)

    status: Mapped[str] = mapped_column(String(20), default=SESSION_OPEN, nullable=False)
