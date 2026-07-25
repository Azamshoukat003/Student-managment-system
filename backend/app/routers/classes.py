from flask import Blueprint, g, jsonify

from app.core.deps import require_auth, require_role
from app.models.klass import Class
from app.models.user import ROLE_ADMIN, ROLE_STUDENT, ROLE_TEACHER, User
from app.schemas.klass import ClassCreate, ClassOut, ClassUpdate
from app.schemas.user import UserOut
from app.web import ApiError, parse_body, serialize, serialize_list

bp = Blueprint("classes", __name__, url_prefix="/api/classes")


@bp.get("/<int:class_id>/students")
@require_role(ROLE_TEACHER, ROLE_ADMIN)
def class_students(class_id: int):
    """Active students in a class — used by teachers for manual attendance."""
    students = (
        g.db.query(User)
        .filter(User.role == ROLE_STUDENT, User.class_id == class_id, User.is_active.is_(True))
        .order_by(User.full_name)
        .all()
    )
    return serialize_list(students, UserOut)


@bp.get("")
@require_auth
def list_classes():
    # readable by any logged-in user (needed by teachers/forms); edits are admin-only
    return serialize_list(g.db.query(Class).order_by(Class.name).all(), ClassOut)


@bp.post("")
@require_role(ROLE_ADMIN)
def create_class():
    payload = parse_body(ClassCreate)
    obj = Class(**payload.model_dump())
    g.db.add(obj)
    g.db.commit()
    g.db.refresh(obj)
    return serialize(obj, ClassOut), 201


@bp.put("/<int:class_id>")
@require_role(ROLE_ADMIN)
def update_class(class_id: int):
    payload = parse_body(ClassUpdate)
    obj = g.db.get(Class, class_id)
    if not obj:
        raise ApiError(404, "Class not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(obj, field, value)
    g.db.commit()
    g.db.refresh(obj)
    return serialize(obj, ClassOut)


@bp.delete("/<int:class_id>")
@require_role(ROLE_ADMIN)
def delete_class(class_id: int):
    obj = g.db.get(Class, class_id)
    if not obj:
        raise ApiError(404, "Class not found")
    g.db.delete(obj)
    g.db.commit()
    return jsonify({"success": True})
