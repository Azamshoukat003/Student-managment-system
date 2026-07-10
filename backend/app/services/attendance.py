"""Shared attendance helpers used by the sessions and records routers."""
from datetime import date, datetime, time

from sqlalchemy.orm import Session

from app.models.attendance_session import (
    SESSION_CLOSED,
    SESSION_OPEN,
    AttendanceSession,
)
from app.services.time_rules import (
    WINDOW_CLOSED,
    WINDOW_LATE,
    WINDOW_PRESENT,
    window_state,
)


def auto_close_expired(db: Session, now: datetime | None = None) -> int:
    """Lazily close any open session whose time window has fully passed.

    There is no background scheduler (zero-cost); instead this runs on relevant
    reads/writes so `status` reflects reality. Returns how many were closed.
    """
    now = now or datetime.now()
    rows = db.query(AttendanceSession).filter(AttendanceSession.status == SESSION_OPEN).all()
    closed = 0
    for s in rows:
        if window_state(now, s) == WINDOW_CLOSED:
            s.status = SESSION_CLOSED
            closed += 1
    if closed:
        db.commit()
    return closed


def _effective_end(start: time, end: time, late_cutoff: time | None) -> time:
    return late_cutoff or end


def overlapping_open_session(
    db: Session,
    class_id: int,
    session_date: date,
    start_time: time,
    end_time: time,
    late_cutoff_time: time | None,
    exclude_id: int | None = None,
):
    """Return an existing OPEN session for the class whose window overlaps, or None.

    Enforces one active attendance window per class at a time — this is the
    assumption find_active_session() relies on, so two teachers/subjects can't
    open concurrent sessions for the same class.
    """
    new_end = _effective_end(start_time, end_time, late_cutoff_time)
    rows = (
        db.query(AttendanceSession)
        .filter(
            AttendanceSession.class_id == class_id,
            AttendanceSession.status == SESSION_OPEN,
            AttendanceSession.session_date == session_date,
        )
        .all()
    )
    for ex in rows:
        if exclude_id is not None and ex.id == exclude_id:
            continue
        ex_end = _effective_end(ex.start_time, ex.end_time, ex.late_cutoff_time)
        # half-open interval overlap: startA < endB and startB < endA
        if start_time < ex_end and ex.start_time < new_end:
            return ex
    return None


def find_active_session(db: Session, student, now: datetime | None = None):
    """Return the open, in-window session a student may currently mark, or None."""
    if not student.class_id:
        return None
    now = now or datetime.now()
    rows = (
        db.query(AttendanceSession)
        .filter(
            AttendanceSession.class_id == student.class_id,
            AttendanceSession.status == SESSION_OPEN,
            AttendanceSession.session_date == now.date(),
        )
        .all()
    )
    for s in rows:
        if window_state(now, s) in (WINDOW_PRESENT, WINDOW_LATE):
            return s
    return None
