from flask import Blueprint, g, jsonify
from sqlalchemy import func, or_

from app.core.deps import require_auth, require_role
from app.core.security import hash_password
from app.models.user import ROLE_ADMIN, User
from app.schemas.user import (
    ProfileUpdate,
    ResetPasswordRequest,
    UserCreate,
    UserOut,
    UserUpdate,
)
from app.web import ApiError, parse_body, q_bool, q_int, q_str, serialize, serialize_list

bp = Blueprint("users", __name__, url_prefix="/api/users")


# ── Self-service profile (any logged-in user) ─────────────────────────────────
@bp.get("/me")
@require_auth
def get_me():
    return serialize(g.user, UserOut)


@bp.put("/me")
@require_auth
def update_me():
    """Users edit own name/phone/profile image (spec §4.4). Reg no/role/class locked."""
    payload = parse_body(ProfileUpdate)
    data = payload.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(g.user, field, value)
    g.db.commit()
    g.db.refresh(g.user)
    return serialize(g.user, UserOut)


# ── Admin user management (spec §3.1, §4.2, §4.5) ─────────────────────────────
@bp.post("")
@require_role(ROLE_ADMIN)
def create_user():
    payload = parse_body(UserCreate)
    email = payload.email.strip().lower()
    if g.db.query(User).filter(func.lower(User.email) == email).first():
        raise ApiError(409, "Email already exists")
    if payload.registration_number and g.db.query(User).filter(
        User.registration_number == payload.registration_number
    ).first():
        raise ApiError(409, "Registration number already exists")

    user = User(
        full_name=payload.full_name,
        email=email,
        password_hash=hash_password(payload.password),
        role=payload.role,
        registration_number=payload.registration_number,
        class_id=payload.class_id,
        semester=payload.semester,
        # SRS student-record fields (docs §3.3 ERD: Student entity)
        father_name=payload.father_name,
        program=payload.program,
        section=payload.section,
        address=payload.address,
        department=payload.department,
        phone=payload.phone,
        is_active=payload.is_active,
    )
    g.db.add(user)
    g.db.commit()
    g.db.refresh(user)
    return serialize(user, UserOut), 201


@bp.get("")
@require_role(ROLE_ADMIN)
def list_users():
    role = q_str("role")
    class_id = q_int("class_id")
    is_active = q_bool("is_active")
    search = q_str("search")
    q = g.db.query(User)
    if role:
        q = q.filter(User.role == role)
    if class_id is not None:
        q = q.filter(User.class_id == class_id)
    if is_active is not None:
        q = q.filter(User.is_active == is_active)
    if search:
        like = f"%{search}%"
        q = q.filter(or_(User.full_name.ilike(like), User.email.ilike(like),
                         User.registration_number.ilike(like)))
    return serialize_list(q.order_by(User.full_name).all(), UserOut)


@bp.get("/<int:user_id>")
@require_role(ROLE_ADMIN)
def get_user(user_id: int):
    user = g.db.get(User, user_id)
    if not user:
        raise ApiError(404, "User not found")
    return serialize(user, UserOut)


@bp.put("/<int:user_id>")
@require_role(ROLE_ADMIN)
def update_user(user_id: int):
    payload = parse_body(UserUpdate)
    user = g.db.get(User, user_id)
    if not user:
        raise ApiError(404, "User not found")
    data = payload.model_dump(exclude_unset=True)
    if "email" in data and data["email"]:
        data["email"] = data["email"].strip().lower()
        if data["email"] != user.email and g.db.query(User).filter(
            func.lower(User.email) == data["email"]
        ).first():
            raise ApiError(409, "Email already exists")
    for field, value in data.items():
        setattr(user, field, value)
    g.db.commit()
    g.db.refresh(user)
    return serialize(user, UserOut)


@bp.delete("/<int:user_id>")
@require_role(ROLE_ADMIN)
def deactivate_user(user_id: int):
    """Soft-delete: deactivate rather than hard delete (spec §4.5)."""
    user = g.db.get(User, user_id)
    if not user:
        raise ApiError(404, "User not found")
    if user.id == g.user.id:
        raise ApiError(400, "You cannot deactivate your own account")
    user.is_active = False
    # deactivated students must not be recognized in live attendance (spec §4.5)
    from app.models.face_embedding import FaceEmbedding
    g.db.query(FaceEmbedding).filter(FaceEmbedding.student_id == user.id).update(
        {FaceEmbedding.is_active: False}
    )
    g.db.commit()
    return jsonify({"success": True})


@bp.post("/<int:user_id>/reset-password")
@require_role(ROLE_ADMIN)
def reset_password(user_id: int):
    """Admin sets a temporary password (spec §4.3)."""
    payload = parse_body(ResetPasswordRequest)
    user = g.db.get(User, user_id)
    if not user:
        raise ApiError(404, "User not found")
    user.password_hash = hash_password(payload.new_password)
    g.db.commit()
    return jsonify({"success": True})
