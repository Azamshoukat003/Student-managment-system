"""Per-role dashboard summaries (spec §17).

Counts come from live data; session/attendance tables stay empty until Phases 3-5,
so those figures read 0 until sessions and records exist.
"""
from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.database import get_db
from app.services.attendance import auto_close_expired
from app.services.reports import query_records
from app.models.attendance_record import (
    STATUS_ABSENT,
    STATUS_LATE,
    STATUS_PENDING,
    STATUS_PRESENT,
    AttendanceRecord,
)
from app.models.attendance_session import SESSION_OPEN, AttendanceSession
from app.models.klass import Class
from app.models.subject import Subject
from app.models.teacher_class import TeacherClass
from app.models.user import ROLE_STUDENT, ROLE_TEACHER, User
from app.schemas.dashboard import (
    AdminDashboard,
    StatusSummary,
    StudentDashboard,
    TeacherDashboard,
)

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


def _summary_from_rows(rows) -> StatusSummary:
    counts = {status: n for status, n in rows}
    return StatusSummary(
        present=counts.get(STATUS_PRESENT, 0),
        late=counts.get(STATUS_LATE, 0),
        absent=counts.get(STATUS_ABSENT, 0),
        pending=counts.get(STATUS_PENDING, 0),
    )


@router.get("/summary")
def summary(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Return a role-appropriate dashboard payload for the current user."""
    auto_close_expired(db)
    if user.role == "admin":
        return _admin_summary(db)
    if user.role == ROLE_TEACHER:
        return _teacher_summary(db, user)
    return _student_summary(db, user)


def _admin_summary(db: Session) -> AdminDashboard:
    today = date.today()
    total_students = db.query(func.count(User.id)).filter(User.role == ROLE_STUDENT).scalar()
    total_teachers = db.query(func.count(User.id)).filter(User.role == ROLE_TEACHER).scalar()
    total_classes = db.query(func.count(Class.id)).scalar()
    total_subjects = db.query(func.count(Subject.id)).scalar()
    total_sessions = db.query(func.count(AttendanceSession.id)).scalar()

    rows = (
        db.query(AttendanceRecord.status, func.count(AttendanceRecord.id))
        .join(AttendanceSession, AttendanceRecord.session_id == AttendanceSession.id)
        .filter(AttendanceSession.session_date == today)
        .group_by(AttendanceRecord.status)
        .all()
    )
    summ = _summary_from_rows(rows)
    return AdminDashboard(
        total_students=total_students,
        total_teachers=total_teachers,
        total_classes=total_classes,
        total_subjects=total_subjects,
        total_sessions=total_sessions,
        today_attendance_count=summ.present + summ.late,
        today_summary=summ,
    )


def _teacher_summary(db: Session, user: User) -> TeacherDashboard:
    today = date.today()
    assigned_classes = (
        db.query(func.count(func.distinct(TeacherClass.class_id)))
        .filter(TeacherClass.teacher_id == user.id)
        .scalar()
    )
    today_sessions = (
        db.query(func.count(AttendanceSession.id))
        .filter(AttendanceSession.teacher_id == user.id, AttendanceSession.session_date == today)
        .scalar()
    )
    open_sessions = (
        db.query(func.count(AttendanceSession.id))
        .filter(AttendanceSession.teacher_id == user.id, AttendanceSession.status == SESSION_OPEN)
        .scalar()
    )
    rows = (
        db.query(AttendanceRecord.status, func.count(AttendanceRecord.id))
        .join(AttendanceSession, AttendanceRecord.session_id == AttendanceSession.id)
        .filter(AttendanceSession.teacher_id == user.id, AttendanceSession.session_date == today)
        .group_by(AttendanceRecord.status)
        .all()
    )
    return TeacherDashboard(
        assigned_classes=assigned_classes,
        today_sessions=today_sessions,
        open_sessions=open_sessions,
        today_summary=_summary_from_rows(rows),
    )


def _trend_buckets(period: str, today: date):
    """Return (granularity, [(key, label), ...], date_from)."""
    if period == "today":
        return "hour", [(h, f"{h:02d}:00") for h in range(24)], today
    if period == "week":
        start = today - timedelta(days=6)
        days = [start + timedelta(days=i) for i in range(7)]
        return "day", [(d, d.strftime("%a")) for d in days], start
    if period == "month":
        start = today - timedelta(days=29)
        days = [start + timedelta(days=i) for i in range(30)]
        return "day", [(d, d.strftime("%d %b")) for d in days], start
    # year: last 12 months
    seq = []
    y, m = today.year, today.month
    for i in range(11, -1, -1):
        mm, yy = m - i, y
        while mm <= 0:
            mm += 12
            yy -= 1
        seq.append((yy, mm))
    labels = [((yy, mm), date(yy, mm, 1).strftime("%b")) for yy, mm in seq]
    return "month", labels, date(seq[0][0], seq[0][1], 1)


@router.get("/attendance-trend")
def attendance_trend(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    period: str = Query("week", alias="range"),
):
    """Attendance counts over time for a chart, scoped by role (spec §17)."""
    if period not in ("today", "week", "month", "year"):
        period = "week"
    today = date.today()
    gran, buckets, date_from = _trend_buckets(period, today)

    rows = query_records(db, user, date_from=date_from, date_to=today, limit=200000)

    counts: dict = {}
    for rec, sess, *_ in rows:
        if gran == "hour":
            when = rec.marked_at or datetime.combine(sess.session_date, sess.start_time)
            key = when.hour
        elif gran == "day":
            key = sess.session_date
        else:  # month
            key = (sess.session_date.year, sess.session_date.month)
        c = counts.setdefault(key, {"present": 0, "late": 0, "absent": 0})
        if rec.status in c:
            c[rec.status] += 1

    out = []
    for key, label in buckets:
        c = counts.get(key, {"present": 0, "late": 0, "absent": 0})
        out.append(
            {
                "label": label,
                "present": c["present"],
                "late": c["late"],
                "absent": c["absent"],
                "total": c["present"] + c["late"],
            }
        )
    totals = {
        "present": sum(b["present"] for b in out),
        "late": sum(b["late"] for b in out),
        "absent": sum(b["absent"] for b in out),
    }
    return {"range": period, "granularity": gran, "buckets": out, "totals": totals}


def _student_summary(db: Session, user: User) -> StudentDashboard:
    rows = (
        db.query(AttendanceRecord.status, func.count(AttendanceRecord.id))
        .filter(AttendanceRecord.student_id == user.id)
        .group_by(AttendanceRecord.status)
        .all()
    )
    summ = _summary_from_rows(rows)
    total = summ.present + summ.late + summ.absent
    pct = round((summ.present + summ.late) / total * 100, 1) if total else 0.0
    return StudentDashboard(
        attendance_percentage=pct,
        present=summ.present,
        late=summ.late,
        absent=summ.absent,
        total_marked=total,
        face_registered=user.face_registered,
    )
