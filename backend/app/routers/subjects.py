from flask import Blueprint, g, jsonify

from app.core.deps import require_auth, require_role
from app.models.klass import Class
from app.models.subject import Subject
from app.models.user import ROLE_ADMIN
from app.schemas.subject import SubjectCreate, SubjectOut, SubjectUpdate
from app.web import ApiError, parse_body, q_int, serialize, serialize_list

bp = Blueprint("subjects", __name__, url_prefix="/api/subjects")


@bp.get("")
@require_auth
def list_subjects():
    class_id = q_int("class_id")
    q = g.db.query(Subject)
    if class_id is not None:
        q = q.filter(Subject.class_id == class_id)
    return serialize_list(q.order_by(Subject.name).all(), SubjectOut)


@bp.post("")
@require_role(ROLE_ADMIN)
def create_subject():
    payload = parse_body(SubjectCreate)
    if not g.db.get(Class, payload.class_id):
        raise ApiError(400, "class_id does not exist")
    obj = Subject(**payload.model_dump())
    g.db.add(obj)
    g.db.commit()
    g.db.refresh(obj)
    return serialize(obj, SubjectOut), 201


@bp.put("/<int:subject_id>")
@require_role(ROLE_ADMIN)
def update_subject(subject_id: int):
    payload = parse_body(SubjectUpdate)
    obj = g.db.get(Subject, subject_id)
    if not obj:
        raise ApiError(404, "Subject not found")
    data = payload.model_dump(exclude_unset=True)
    if "class_id" in data and not g.db.get(Class, data["class_id"]):
        raise ApiError(400, "class_id does not exist")
    for field, value in data.items():
        setattr(obj, field, value)
    g.db.commit()
    g.db.refresh(obj)
    return serialize(obj, SubjectOut)


@bp.delete("/<int:subject_id>")
@require_role(ROLE_ADMIN)
def delete_subject(subject_id: int):
    obj = g.db.get(Subject, subject_id)
    if not obj:
        raise ApiError(404, "Subject not found")
    g.db.delete(obj)
    g.db.commit()
    return jsonify({"success": True})
