from datetime import datetime
from typing import Optional

from flask import Blueprint, g
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.deps import require_auth, require_role
from app.models.attendance_record import AttendanceRecord
from app.models.attendance_session import (
    SESSION_CLOSED,
    SESSION_OPEN,
    AttendanceSession,
)
from app.models.klass import Class
from app.models.subject import Subject
from app.models.teacher_class import TeacherClass
from app.models.user import ROLE_ADMIN, ROLE_STUDENT, ROLE_TEACHER, User
from app.schemas.session import (
    ActiveSessionResponse,
    SessionCreate,
    SessionDetail,
)
from app.services.attendance import (
    auto_close_expired,
    find_active_session,
    overlapping_open_session,
)
from app.services.clock import now_local
from app.services.time_rules import window_state
from app.web import ApiError, dump, parse_body, q_date, q_int, q_str

bp = Blueprint("attendance-sessions", __name__, url_prefix="/api/attendance-sessions")


def _detail(db: Session, s: AttendanceSession, now: Optional[datetime] = None) -> SessionDetail:
    now = now or now_local()
    c = db.get(Class, s.class_id)
    subj = db.get(Subject, s.subject_id)
    teacher = db.get(User, s.teacher_id)
    marked = (
        db.query(func.count(AttendanceRecord.id))
        .filter(AttendanceRecord.session_id == s.id)
        .scalar()
    )
    d = SessionDetail.model_validate(s)
    d.class_name = c.name if c else "?"
    d.subject_name = subj.name if subj else "?"
    d.teacher_name = teacher.full_name if teacher else "?"
    d.window_state = window_state(now, s)
    d.marked_count = marked
    return d


@bp.post("")
@require_role(ROLE_TEACHER, ROLE_ADMIN)
def create_session():
    payload = parse_body(SessionCreate)
    db, user = g.db, g.user
    if not db.get(Class, payload.class_id):
        raise ApiError(400, "class_id does not exist")
    subject = db.get(Subject, payload.subject_id)
    if not subject or subject.class_id != payload.class_id:
        raise ApiError(400, "subject does not belong to that class")

    # Teachers may only open sessions for classes/subjects they are assigned to.
    if user.role == ROLE_TEACHER:
        assigned = (
            db.query(TeacherClass)
            .filter(
                TeacherClass.teacher_id == user.id,
                TeacherClass.class_id == payload.class_id,
                TeacherClass.subject_id == payload.subject_id,
            )
            .first()
        )
        if not assigned:
            raise ApiError(403, "You are not assigned to this class and subject")

    # Close anything already expired so it doesn't falsely block a new session.
    auto_close_expired(db)

    # One active attendance window per class: reject overlaps (same subject/teacher
    # or a different teacher's session for the same class in the same window).
    clash = overlapping_open_session(
        db,
        payload.class_id,
        payload.session_date,
        payload.start_time,
        payload.end_time,
        payload.late_cutoff_time,
    )
    if clash:
        raise ApiError(
            409,
            (
                f"This class already has an open session ({clash.start_time.strftime('%H:%M')}"
                f"–{(clash.late_cutoff_time or clash.end_time).strftime('%H:%M')}) overlapping this time. "
                "Close it before opening another."
            ),
        )

    s = AttendanceSession(
        teacher_id=user.id,
        status=SESSION_OPEN,
        **payload.model_dump(),
    )
    db.add(s)
    db.commit()
    db.refresh(s)
    return dump(_detail(db, s)), 201


@bp.get("")
@require_auth
def list_sessions():
    db, user = g.db, g.user
    class_id = q_int("class_id")
    session_date = q_date("session_date")
    status_filter = q_str("status_filter")

    if user.role == ROLE_STUDENT:
        raise ApiError(403, "Insufficient permissions")

    auto_close_expired(db)
    q = db.query(AttendanceSession)
    if user.role == ROLE_TEACHER:
        q = q.filter(AttendanceSession.teacher_id == user.id)
    if class_id is not None:
        q = q.filter(AttendanceSession.class_id == class_id)
    if session_date is not None:
        q = q.filter(AttendanceSession.session_date == session_date)
    if status_filter:
        q = q.filter(AttendanceSession.status == status_filter)

    rows = q.order_by(
        AttendanceSession.session_date.desc(), AttendanceSession.start_time.desc()
    ).all()
    now = now_local()
    return [dump(_detail(db, s, now)) for s in rows]


@bp.get("/active")
@require_role(ROLE_STUDENT)
def active_session():
    """The open session a student can currently mark, if any (spec §7 step 3)."""
    db, user = g.db, g.user
    if not user.class_id:
        return dump(ActiveSessionResponse(message="You are not assigned to a class yet"))

    auto_close_expired(db)
    now = now_local()
    s = find_active_session(db, user, now)
    if not s:
        return dump(ActiveSessionResponse(message="No open attendance session for your class right now"))

    already = (
        db.query(AttendanceRecord)
        .filter(AttendanceRecord.session_id == s.id, AttendanceRecord.student_id == user.id)
        .first()
    )
    return dump(
        ActiveSessionResponse(
            session=_detail(db, s, now),
            already_marked=already is not None,
            message="You have already marked attendance for this session" if already else "",
        )
    )


@bp.put("/<int:session_id>/close")
@require_role(ROLE_TEACHER, ROLE_ADMIN)
def close_session(session_id: int):
    db, user = g.db, g.user
    s = db.get(AttendanceSession, session_id)
    if not s:
        raise ApiError(404, "Session not found")
    if user.role == ROLE_TEACHER and s.teacher_id != user.id:
        raise ApiError(403, "You can only close your own sessions")
    s.status = SESSION_CLOSED
    db.commit()
    db.refresh(s)
    return dump(_detail(db, s))
