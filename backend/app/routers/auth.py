from flask import Blueprint, g, jsonify
from sqlalchemy import func, or_

from app.core.deps import require_auth
from app.core.security import create_access_token, hash_password, verify_password
from app.models.user import User
from app.schemas.auth import ChangePasswordRequest, LoginRequest, TokenResponse
from app.schemas.user import UserOut
from app.web import ApiError, dump, parse_body, serialize

bp = Blueprint("auth", __name__, url_prefix="/api/auth")


@bp.post("/login")
def login():
    """Login by email or registration number (spec §4.1)."""
    payload = parse_body(LoginRequest)
    ident = payload.identifier.strip()
    user = (
        g.db.query(User)
        .filter(
            or_(
                func.lower(User.email) == ident.lower(),  # email is case-insensitive
                User.registration_number == ident,
            )
        )
        .first()
    )
    if not user or not verify_password(payload.password, user.password_hash):
        raise ApiError(401, "Invalid credentials")
    if not user.is_active:
        raise ApiError(403, "Account is inactive")

    token = create_access_token(user.id, user.role)
    return dump(TokenResponse(access_token=token, user=user))


@bp.post("/logout")
@require_auth
def logout():
    """JWT is stateless — the client discards the token. Endpoint kept for symmetry."""
    return jsonify({"success": True})


@bp.get("/me")
@require_auth
def me():
    return serialize(g.user, UserOut)


@bp.put("/password")
@require_auth
def change_password():
    """User changes own password (spec §4.3 step 4)."""
    payload = parse_body(ChangePasswordRequest)
    if not verify_password(payload.old_password, g.user.password_hash):
        raise ApiError(403, "Current password incorrect")
    g.user.password_hash = hash_password(payload.new_password)
    g.db.commit()
    return jsonify({"success": True})
