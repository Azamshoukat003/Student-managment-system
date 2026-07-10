from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, Float, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models.mixins import TimestampMixin

# status values (spec §19)
STATUS_PRESENT = "present"
STATUS_LATE = "late"
STATUS_ABSENT = "absent"
STATUS_PENDING = "pending"
STATUS_REJECTED = "rejected"

# method values
METHOD_FACE = "face"
METHOD_MANUAL = "manual"

# approval values
APPROVAL_APPROVED = "approved"
APPROVAL_PENDING = "pending"
APPROVAL_REJECTED = "rejected"


class AttendanceRecord(Base, TimestampMixin):
    """One student's attendance for one session (spec §19).

    UNIQUE(session_id, student_id) enforces 'one mark per session' (spec §8.11).
    """

    __tablename__ = "attendance_records"
    __table_args__ = (
        UniqueConstraint("session_id", "student_id", name="uq_session_student"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    session_id: Mapped[int] = mapped_column(
        ForeignKey("attendance_sessions.id"), nullable=False, index=True
    )
    student_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)

    status: Mapped[str] = mapped_column(String(20), nullable=False)
    method: Mapped[str] = mapped_column(String(20), nullable=False)
    approval_status: Mapped[str] = mapped_column(
        String(20), default=APPROVAL_APPROVED, nullable=False
    )

    confidence_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    latitude: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    longitude: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    gps_accuracy: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    distance_from_session: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    marked_by: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True)
    reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    marked_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
