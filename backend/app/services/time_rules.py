"""Time-window rules for attendance sessions (spec §15).

    now < start_time                 -> upcoming  (not markable)
    start_time <= now <= end_time    -> present
    end_time  < now <= late_cutoff   -> late
    now > late_cutoff (or end_time)  -> closed    (not markable)
"""
from datetime import datetime

WINDOW_UPCOMING = "upcoming"
WINDOW_PRESENT = "present"
WINDOW_LATE = "late"
WINDOW_CLOSED = "closed"


def window_state(now: datetime, session) -> str:
    """Return the time-window state of a session for the given moment."""
    if session.session_date != now.date():
        return WINDOW_CLOSED if now.date() > session.session_date else WINDOW_UPCOMING

    cur = now.time().replace(microsecond=0)
    late = session.late_cutoff_time or session.end_time

    if cur < session.start_time:
        return WINDOW_UPCOMING
    if cur <= session.end_time:
        return WINDOW_PRESENT
    if cur <= late:
        return WINDOW_LATE
    return WINDOW_CLOSED


def resolve_status(now: datetime, session):
    """Map the window state to an attendance status.

    Returns (status, reason). status is 'present'/'late' when markable, else None.
    """
    state = window_state(now, session)
    if state == WINDOW_PRESENT:
        return "present", "On time"
    if state == WINDOW_LATE:
        return "late", "Marked late"
    if state == WINDOW_UPCOMING:
        return None, "Session has not started yet"
    return None, "Session is closed"
