"""App-local clock.

Session times are stored as local wall-clock (as entered by teachers). To make
time-window logic correct regardless of where the server runs (Render is UTC),
"now" is computed with a fixed configured UTC offset (default +5:00, Pakistan).
"""
from datetime import date, datetime, timedelta, timezone

from app.config import settings


def _tz() -> timezone:
    return timezone(timedelta(minutes=settings.app_utc_offset_minutes))


def now_local() -> datetime:
    """Current time in the app's configured timezone (tz-aware)."""
    return datetime.now(_tz())


def today_local() -> date:
    return now_local().date()
