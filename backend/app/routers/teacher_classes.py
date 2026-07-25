from flask import Blueprint, g, jsonify

from app.core.deps import require_auth, require_role
from app.models.klass import Class
from app.models.subject import Subject
from app.models.teacher_class import TeacherClass
from app.models.user import ROLE_ADMIN, ROLE_TEACHER, User
from app.schemas.teacher_class import TeacherClassCreate, TeacherClassDetail
from app.web import ApiError, dump, parse_body, q_int

bp = Blueprint("teacher_classes", __name__, url_prefix="/api/teacher-classes")


def _detail_rows(db, query):
    """Join assignment rows with teacher/class/subject names for display."""
    rows = query.all()
    result = []
    for tc in rows:
        t = db.get(User, tc.teacher_id)
        c = db.get(Class, tc.class_id)
        s = db.get(Subject, tc.subject_id)
        result.append(
            TeacherClassDetail(
                id=tc.id,
                teacher_id=tc.teacher_id,
                teacher_name=t.full_name if t else "?",
                class_id=tc.class_id,
                class_name=c.name if c else "?",
                subject_id=tc.subject_id,
                subject_name=s.name if s else "?",
            )
        )
    return result


@bp.get("")
@require_auth
def list_assignments():
    teacher_id = q_int("teacher_id")
    # Admins see all (optionally filtered); teachers see only their own.
    q = g.db.query(TeacherClass)
    if g.user.role == ROLE_TEACHER:
        q = q.filter(TeacherClass.teacher_id == g.user.id)
    elif g.user.role == ROLE_ADMIN:
        if teacher_id is not None:
            q = q.filter(TeacherClass.teacher_id == teacher_id)
    else:
        raise ApiError(403, "Insufficient permissions")
    return [dump(row) for row in _detail_rows(g.db, q)]


@bp.post("")
@require_role(ROLE_ADMIN)
def create_assignment():
    payload = parse_body(TeacherClassCreate)
    teacher = g.db.get(User, payload.teacher_id)
    if not teacher or teacher.role != ROLE_TEACHER:
        raise ApiError(400, "teacher_id must reference a teacher")
    if not g.db.get(Class, payload.class_id):
        raise ApiError(400, "class_id does not exist")
    subject = g.db.get(Subject, payload.subject_id)
    if not subject:
        raise ApiError(400, "subject_id does not exist")
    if subject.class_id != payload.class_id:
        raise ApiError(400, "subject does not belong to that class")

    exists = (
        g.db.query(TeacherClass)
        .filter(
            TeacherClass.teacher_id == payload.teacher_id,
            TeacherClass.class_id == payload.class_id,
            TeacherClass.subject_id == payload.subject_id,
        )
        .first()
    )
    if exists:
        raise ApiError(409, "Assignment already exists")

    obj = TeacherClass(**payload.model_dump())
    g.db.add(obj)
    g.db.commit()
    g.db.refresh(obj)
    row = _detail_rows(g.db, g.db.query(TeacherClass).filter(TeacherClass.id == obj.id))[0]
    return dump(row), 201


@bp.delete("/<int:assignment_id>")
@require_role(ROLE_ADMIN)
def delete_assignment(assignment_id: int):
    obj = g.db.get(TeacherClass, assignment_id)
    if not obj:
        raise ApiError(404, "Assignment not found")
    g.db.delete(obj)
    g.db.commit()
    return jsonify({"success": True})
