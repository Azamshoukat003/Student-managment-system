from datetime import date, datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from starlette.concurrency import run_in_threadpool

from app.config import settings
from app.core.deps import get_current_user, require_role
from app.database import get_db
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
    RecordDetail,
)
from app.services.attendance import find_active_session
from app.services.clock import now_local
from app.services.face_service import verify_identity
from app.services.gps import check_geofence
from app.services.reports import query_records, to_detail
from app.services.time_rules import resolve_status

router = APIRouter(prefix="/api/attendance-records", tags=["attendance-records"])

MANUAL_STATUSES = {STATUS_PRESENT, STATUS_LATE, STATUS_ABSENT}


@router.post("/check-location", response_model=LocationCheckResponse)
def check_location(
    payload: LocationCheckRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(ROLE_STUDENT)),
):
    """Validate the student's GPS against the active session's geofence (spec §9).

    Lets the student confirm they're in range before capturing their face.
    """
    now = now_local()
    session = find_active_session(db, user, now)
    if not session:
        return LocationCheckResponse(eligible=False, message="No open session for your class right now")

    already = (
        db.query(AttendanceRecord)
        .filter(AttendanceRecord.session_id == session.id, AttendanceRecord.student_id == user.id)
        .first()
    )
    if already:
        return LocationCheckResponse(
            eligible=False,
            session_id=session.id,
            message="You have already marked attendance for this session",
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
    return LocationCheckResponse(
        eligible=geo["passed"],
        session_id=session.id,
        distance=geo["distance"],
        within_radius=geo["within_radius"],
        accuracy_ok=geo["accuracy_ok"],
        message=geo["reason"],
    )


@router.post("/mark-face", response_model=MarkResponse)
async def mark_face(
    payload: MarkFaceRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(ROLE_STUDENT)),
):
    """The full attendance validation pipeline (spec §8).

    Runs checks 1-11 in order; the first failure returns a clear message and
    nothing is saved. On success a record is written with the time-based status.
    """
    now = now_local()

    # Checks 3,4,5: student belongs to an open, in-window session for their class.
    session = find_active_session(db, user, now)
    if not session:
        raise HTTPException(status_code=400, detail="No open attendance session for your class right now")

    # Check 11: no duplicate for this session.
    existing = (
        db.query(AttendanceRecord)
        .filter(AttendanceRecord.session_id == session.id, AttendanceRecord.student_id == user.id)
        .first()
    )
    if existing:
        raise HTTPException(status_code=409, detail="You have already marked attendance for this session")

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
        raise HTTPException(status_code=422, detail=geo["reason"])

    # Checks 9,10: face detected and matches THIS logged-in student.
    verdict = await run_in_threadpool(
        verify_identity,
        db,
        user,
        payload.frame,
        settings.face_match_threshold,
        settings.face_pending_threshold,
    )
    if not verdict["face_detected"]:
        raise HTTPException(status_code=422, detail=verdict["error"] or "No face detected")
    if verdict["error"]:
        raise HTTPException(status_code=422, detail=verdict["error"])
    if not verdict["matched"] and not verdict["pending"]:
        raise HTTPException(status_code=422, detail="Face does not match your account. Attendance rejected.")

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

    return MarkResponse(
        success=True,
        status=rec_status,
        approval_status=approval,
        confidence=verdict["confidence"],
        distance=geo["distance"],
        message=message,
    )


@router.get("", response_model=list[RecordDetail])
def list_records(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    class_id: Optional[int] = None,
    subject_id: Optional[int] = None,
    student_id: Optional[int] = None,
    session_id: Optional[int] = None,
    status: Optional[str] = None,
    approval_status: Optional[str] = None,
    method: Optional[str] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
):
    """List attendance records, scoped by role and filtered (spec §16)."""
    rows = query_records(
        db,
        user,
        class_id=class_id,
        subject_id=subject_id,
        student_id=student_id,
        session_id=session_id,
        status=status,
        approval_status=approval_status,
        method=method,
        date_from=date_from,
        date_to=date_to,
        limit=1000,
    )
    return [to_detail(r) for r in rows]


@router.post("/manual", response_model=RecordDetail, status_code=201)
def manual_mark(
    payload: ManualMarkRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(ROLE_TEACHER, ROLE_ADMIN)),
):
    """Teacher marks a student manually (spec §13). A reason is required."""
    if payload.status not in MANUAL_STATUSES:
        raise HTTPException(status_code=400, detail="status must be present, late or absent")
    if not payload.reason or not payload.reason.strip():
        raise HTTPException(status_code=400, detail="A reason is required for manual attendance")

    session = db.get(AttendanceSession, payload.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if user.role == ROLE_TEACHER and session.teacher_id != user.id:
        raise HTTPException(status_code=403, detail="You can only mark your own sessions")

    student = db.get(User, payload.student_id)
    if not student or student.role != ROLE_STUDENT:
        raise HTTPException(status_code=400, detail="student_id must reference a student")
    if student.class_id != session.class_id:
        raise HTTPException(status_code=400, detail="Student does not belong to this session's class")

    existing = (
        db.query(AttendanceRecord)
        .filter(
            AttendanceRecord.session_id == session.id,
            AttendanceRecord.student_id == student.id,
        )
        .first()
    )
    if existing:
        raise HTTPException(status_code=409, detail="This student already has a record for this session")

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
    return to_detail(query_records(db, user, session_id=session.id, student_id=student.id)[0])


def _set_approval(db, user, record_id, new_status, comment):
    record = db.get(AttendanceRecord, record_id)
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
    session = db.get(AttendanceSession, record.session_id)
    if user.role == ROLE_TEACHER and (not session or session.teacher_id != user.id):
        raise HTTPException(status_code=403, detail="You can only review your own sessions")

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
    return to_detail(rows[0])


@router.put("/{record_id}/approve", response_model=RecordDetail)
def approve_record(
    record_id: int,
    payload: ApprovalRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(ROLE_TEACHER, ROLE_ADMIN)),
):
    return _set_approval(db, user, record_id, APPROVAL_APPROVED, payload.comment)


@router.put("/{record_id}/reject", response_model=RecordDetail)
def reject_record(
    record_id: int,
    payload: ApprovalRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(ROLE_TEACHER, ROLE_ADMIN)),
):
    return _set_approval(db, user, record_id, APPROVAL_REJECTED, payload.comment)
