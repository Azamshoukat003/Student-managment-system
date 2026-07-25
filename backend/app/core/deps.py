"""Auth decorators for Flask: current-user resolution and role guards.

`g.db` is a per-request SQLAlchemy session opened in main.py's before_request.
`g.user` is set by these decorators after the Bearer token is validated.
"""
from functools import wraps

import jwt
from flask import g, request

from app.core.security import decode_access_token
from app.models.user import User
from app.web import ApiError


def _authenticate() -> User:
    cred_exc = ApiError(
        401,
        "Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise cred_exc
    token = auth[len("Bearer "):]

    try:
        payload = decode_access_token(token)
        user_id = int(payload["sub"])
    except (jwt.PyJWTError, KeyError, TypeError, ValueError):
        raise cred_exc

    user = g.db.get(User, user_id)
    if user is None:
        raise cred_exc
    if not user.is_active:  # spec §4.1: inactive users cannot use the system
        raise ApiError(403, "Account is inactive")
    return user


def require_auth(fn):
    """Any logged-in user. Sets g.user."""

    @wraps(fn)
    def wrapper(*args, **kwargs):
        g.user = _authenticate()
        return fn(*args, **kwargs)

    return wrapper


def require_role(*roles: str):
    """Decorator factory enforcing that the current user has one of `roles`."""

    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            user = _authenticate()
            if user.role not in roles:
                raise ApiError(403, "Insufficient permissions")
            g.user = user
            return fn(*args, **kwargs)

        return wrapper

    return decorator
