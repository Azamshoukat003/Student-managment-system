"""Shared attendance-record querying + enrichment, used by records and reports."""
from datetime import date
from typing import Optional

from sqlalchemy.orm import Session, aliased

from app.models.attendance_record import AttendanceRecord
from app.models.attendance_session import AttendanceSession
from app.models.klass import Class
from app.models.subject import Subject
from app.models.user import ROLE_STUDENT, ROLE_TEACHER, User
from app.schemas.record import RecordDetail


def query_records(
    db: Session,
    user: User,
    *,
    class_id: Optional[int] = None,
    subject_id: Optional[int] = None,
    student_id: Optional[int] = None,
    session_id: Optional[int] = None,
    status: Optional[str] = None,
    approval_status: Optional[str] = None,
    method: Optional[str] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    limit: Optional[int] = None,
):
    """Return enriched attendance rows, scoped to the caller's role."""
    Student = aliased(User)
    q = (
        db.query(AttendanceRecord, AttendanceSession, Class, Subject, Student)
        .join(AttendanceSession, AttendanceRecord.session_id == AttendanceSession.id)
        .join(Class, AttendanceSession.class_id == Class.id)
        .join(Subject, AttendanceSession.subject_id == Subject.id)
        .join(Student, AttendanceRecord.student_id == Student.id)
    )

    # Role scoping (spec §16: student=own, teacher=their sessions, admin=all).
    if user.role == ROLE_STUDENT:
        q = q.filter(AttendanceRecord.student_id == user.id)
    elif user.role == ROLE_TEACHER:
        q = q.filter(AttendanceSession.teacher_id == user.id)

    if class_id is not None:
        q = q.filter(AttendanceSession.class_id == class_id)
    if subject_id is not None:
        q = q.filter(AttendanceSession.subject_id == subject_id)
    if student_id is not None:
        q = q.filter(AttendanceRecord.student_id == student_id)
    if session_id is not None:
        q = q.filter(AttendanceRecord.session_id == session_id)
    if status:
        q = q.filter(AttendanceRecord.status == status)
    if approval_status:
        q = q.filter(AttendanceRecord.approval_status == approval_status)
    if method:
        q = q.filter(AttendanceRecord.method == method)
    if date_from:
        q = q.filter(AttendanceSession.session_date >= date_from)
    if date_to:
        q = q.filter(AttendanceSession.session_date <= date_to)

    q = q.order_by(
        AttendanceSession.session_date.desc(), AttendanceRecord.created_at.desc()
    )
    if limit:
        q = q.limit(limit)
    return q.all()


def to_detail(row) -> RecordDetail:
    rec, sess, cls, subj, student = row
    d = RecordDetail.model_validate(rec)
    d.student_name = student.full_name
    d.registration_number = student.registration_number
    d.class_name = cls.name
    d.subject_name = subj.name
    d.session_date = str(sess.session_date)
    return d


CSV_HEADER = [
    "Date",
    "Student",
    "Registration No",
    "Class",
    "Subject",
    "Status",
    "Method",
    "Approval",
    "Confidence",
    "Distance (m)",
    "Reason",
    "Marked At",
]


def to_csv_row(row) -> list:
    rec, sess, cls, subj, student = row
    return [
        str(sess.session_date),
        student.full_name,
        student.registration_number or "",
        cls.name,
        subj.name,
        rec.status,
        rec.method,
        rec.approval_status,
        rec.confidence_score if rec.confidence_score is not None else "",
        round(rec.distance_from_session) if rec.distance_from_session is not None else "",
        rec.reason or "",
        rec.marked_at.isoformat() if rec.marked_at else "",
    ]
