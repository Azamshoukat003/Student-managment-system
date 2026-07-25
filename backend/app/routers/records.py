from flask import Blueprint, g

from app.config import settings
from app.core.deps import require_auth, require_role
from app.models.activity_log import ActivityLog
from app.models.attendance_record import (
    APPROVAL_APPROVED,
    APPROVAL_PENDING,
    APPROVAL_REJECTED,
    METHOD_FACE,
    METHOD_MANUAL,
    STATUS_ABSENT,
    STATUS_LATE,
    STATUS_PENDING,
    STATUS_PRESENT,
    AttendanceRecord,
)
from app.models.attendance_session import AttendanceSession
from app.models.user import ROLE_ADMIN, ROLE_STUDENT, ROLE_TEACHER, User
from app.schemas.record import (
    ApprovalRequest,
    LocationCheckRequest,
    LocationCheckResponse,
    ManualMarkRequest,
    MarkFaceRequest,
    MarkResponse,
)
from app.services.attendance import find_active_session
from app.services.clock import now_local
from app.services.face_service import verify_identity
from app.services.gps import check_geofence
from app.services.reports import query_records, to_detail
from app.services.time_rules import resolve_status
from app.web import ApiError, dump, parse_body, q_date, q_int, q_str

bp = Blueprint("attendance-records", __name__, url_prefix="/api/attendance-records")

MANUAL_STATUSES = {STATUS_PRESENT, STATUS_LATE, STATUS_ABSENT}


@bp.post("/check-location")
@require_role(ROLE_STUDENT)
def check_location():
    """Validate the student's GPS against the active session's geofence (spec §9).

    Lets the student confirm they're in range before capturing their face.
    """
    payload = parse_body(LocationCheckRequest)
    db, user = g.db, g.user
    now = now_local()
    session = find_active_session(db, user, now)
    if not session:
        return dump(LocationCheckResponse(eligible=False, message="No open session for your class right now"))

    already = (
        db.query(AttendanceRecord)
        .filter(AttendanceRecord.session_id == session.id, AttendanceRecord.student_id == user.id)
        .first()
    )
    if already:
        return dump(
            LocationCheckResponse(
                eligible=False,
                session_id=session.id,
                message="You have already marked attendance for this session",
            )
        )

    geo = check_geofence(
        payload.latitude,
        payload.longitude,
        payload.gps_accuracy,
        session.latitude,
        session.longitude,
        session.allowed_radius_meters,
        settings.max_gps_accuracy,
    )
    return dump(
        LocationCheckResponse(
            eligible=geo["passed"],
            session_id=session.id,
            distance=geo["distance"],
            within_radius=geo["within_radius"],
            accuracy_ok=geo["accuracy_ok"],
            message=geo["reason"],
        )
    )


@bp.post("/mark-face")
@require_role(ROLE_STUDENT)
def mark_face():
    """The full attendance validation pipeline (spec §8).

    Runs checks 1-11 in order; the first failure returns a clear message and
    nothing is saved. On success a record is written with the time-based status.
    """
    payload = parse_body(MarkFaceRequest)
    db, user = g.db, g.user
    now = now_local()

    # Checks 3,4,5: student belongs to an open, in-window session for their class.
    session = find_active_session(db, user, now)
    if not session:
        raise ApiError(400, "No open attendance session for your class right now")

    # Check 11: no duplicate for this session.
    existing = (
        db.query(AttendanceRecord)
        .filter(AttendanceRecord.session_id == session.id, AttendanceRecord.student_id == user.id)
        .first()
    )
    if existing:
        raise ApiError(409, "You have already marked attendance for this session")

    # Checks 6,7,8: GPS present, accuracy acceptable, inside radius.
    geo = check_geofence(
        payload.latitude,
        payload.longitude,
        payload.gps_accuracy,
        session.latitude,
        session.longitude,
        session.allowed_radius_meters,
        settings.max_gps_accuracy,
    )
    if not geo["passed"]:
        raise ApiError(422, geo["reason"])

    # Checks 9,10: face detected and matches THIS logged-in student.
    verdict = verify_identity(
        db,
        user,
        payload.frame,
        settings.face_match_threshold,
        settings.face_pending_threshold,
    )
    if not verdict["face_detected"]:
        raise ApiError(422, verdict["error"] or "No face detected")
    if verdict["error"]:
        raise ApiError(422, verdict["error"])
    if not verdict["matched"] and not verdict["pending"]:
        raise ApiError(422, "Face does not match your account. Attendance rejected.")

    # Time-based status (present/late). Low-confidence face -> pending review (spec §14).
    time_status, _ = resolve_status(now, session)
    if verdict["pending"]:
        rec_status = STATUS_PENDING
        approval = APPROVAL_PENDING
        message = "Attendance submitted for review (low face confidence)."
    else:
        rec_status = time_status
        approval = APPROVAL_APPROVED
        message = f"Attendance marked as {time_status}."

    record = AttendanceRecord(
        session_id=session.id,
        student_id=user.id,
        status=rec_status,
        method=METHOD_FACE,
        approval_status=approval,
        confidence_score=verdict["confidence"],
        latitude=payload.latitude,
        longitude=payload.longitude,
        gps_accuracy=payload.gps_accuracy,
        distance_from_session=geo["distance"],
        marked_at=now,
    )
    db.add(record)
    db.add(ActivityLog(user_id=user.id, action="attendance_marked", detail=f"session {session.id}: {rec_status}"))
    db.commit()

    return dump(
        MarkResponse(
            success=True,
            status=rec_status,
            approval_status=approval,
            confidence=verdict["confidence"],
            distance=geo["distance"],
            message=message,
        )
    )


@bp.get("")
@require_auth
def list_records():
    """List attendance records, scoped by role and filtered (spec §16)."""
    db, user = g.db, g.user
    rows = query_records(
        db,
        user,
        class_id=q_int("class_id"),
        subject_id=q_int("subject_id"),
        student_id=q_int("student_id"),
        session_id=q_int("session_id"),
        status=q_str("status"),
        approval_status=q_str("approval_status"),
        method=q_str("method"),
        date_from=q_date("date_from"),
        date_to=q_date("date_to"),
        limit=1000,
    )
    return [dump(to_detail(r)) for r in rows]


@bp.post("/manual")
@require_role(ROLE_TEACHER, ROLE_ADMIN)
def manual_mark():
    """Teacher marks a student manually (spec §13). A reason is required."""
    payload = parse_body(ManualMarkRequest)
    db, user = g.db, g.user
    if payload.status not in MANUAL_STATUSES:
        raise ApiError(400, "status must be present, late or absent")
    if not payload.reason or not payload.reason.strip():
        raise ApiError(400, "A reason is required for manual attendance")

    session = db.get(AttendanceSession, payload.session_id)
    if not session:
        raise ApiError(404, "Session not found")
    if user.role == ROLE_TEACHER and session.teacher_id != user.id:
        raise ApiError(403, "You can only mark your own sessions")

    student = db.get(User, payload.student_id)
    if not student or student.role != ROLE_STUDENT:
        raise ApiError(400, "student_id must reference a student")
    if student.class_id != session.class_id:
        raise ApiError(400, "Student does not belong to this session's class")

    existing = (
        db.query(AttendanceRecord)
        .filter(
            AttendanceRecord.session_id == session.id,
            AttendanceRecord.student_id == student.id,
        )
        .first()
    )
    if existing:
        raise ApiError(409, "This student already has a record for this session")

    record = AttendanceRecord(
        session_id=session.id,
        student_id=student.id,
        status=payload.status,
        method=METHOD_MANUAL,
        approval_status=APPROVAL_APPROVED,
        reason=payload.reason.strip(),
        marked_by=user.id,
        marked_at=now_local(),
    )
    db.add(record)
    db.add(
        ActivityLog(
            user_id=user.id,
            action="manual_attendance",
            detail=f"session {session.id}, student {student.id}: {payload.status}",
        )
    )
    db.commit()
    db.refresh(record)
    return dump(to_detail(query_records(db, user, session_id=session.id, student_id=student.id)[0])), 201


def _set_approval(db, user, record_id, new_status, comment):
    record = db.get(AttendanceRecord, record_id)
    if not record:
        raise ApiError(404, "Record not found")
    session = db.get(AttendanceSession, record.session_id)
    if user.role == ROLE_TEACHER and (not session or session.teacher_id != user.id):
        raise ApiError(403, "You can only review your own sessions")

    record.approval_status = new_status
    if new_status == APPROVAL_REJECTED:
        # rejecting a mark counts the student as absent for that session
        record.status = STATUS_ABSENT
    else:
        # approving resolves present/late from WHEN the student marked (marked_at)
        when = record.marked_at or now_local()
        computed, _ = resolve_status(when, session) if session else (None, None)
        if computed:
            record.status = computed

    if comment:
        record.reason = (record.reason + " | " if record.reason else "") + comment
    db.commit()
    rows = query_records(db, user, session_id=record.session_id, student_id=record.student_id)
    return dump(to_detail(rows[0]))


@bp.put("/<int:record_id>/approve")
@require_role(ROLE_TEACHER, ROLE_ADMIN)
def approve_record(record_id: int):
    payload = parse_body(ApprovalRequest)
    return _set_approval(g.db, g.user, record_id, APPROVAL_APPROVED, payload.comment)


@bp.put("/<int:record_id>/reject")
@require_role(ROLE_TEACHER, ROLE_ADMIN)
def reject_record(record_id: int):
    payload = parse_body(ApprovalRequest)
    return _set_approval(g.db, g.user, record_id, APPROVAL_REJECTED, payload.comment)
