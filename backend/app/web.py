"""Flask request/response helpers shared by all blueprints.

Keeps the exact API contract the React frontend expects from the previous
FastAPI backend: `{"detail": ...}` error bodies (string or a Pydantic-style
validation array) and JSON-serialized Pydantic response models.
"""
from datetime import date
from typing import Optional, Type, TypeVar

from flask import request
from pydantic import BaseModel, ValidationError

M = TypeVar("M", bound=BaseModel)


class ApiError(Exception):
    """Drop-in replacement for FastAPI's HTTPException."""

    def __init__(self, status_code: int, detail, headers: Optional[dict] = None):
        super().__init__(detail)
        self.status_code = status_code
        self.detail = detail
        self.headers = headers or {}


def _validation_errors(exc: ValidationError) -> list:
    """Mimic FastAPI's 422 body: [{loc: ["body", field], msg, type}, ...]."""
    out = []
    for e in exc.errors():
        out.append(
            {
                "loc": ["body", *e.get("loc", ())],
                "msg": e.get("msg", "Invalid value"),
                "type": e.get("type", "value_error"),
            }
        )
    return out


def parse_body(model: Type[M]) -> M:
    """Validate the request JSON body against a Pydantic model (422 on failure)."""
    data = request.get_json(silent=True)
    if data is None:
        data = {}
    try:
        return model.model_validate(data)
    except ValidationError as exc:
        raise ApiError(422, _validation_errors(exc))


def serialize(obj, model: Type[M]) -> dict:
    """ORM object -> JSON-safe dict via the response model (from_attributes)."""
    return model.model_validate(obj).model_dump(mode="json")


def serialize_list(objs, model: Type[M]) -> list:
    return [serialize(o, model) for o in objs]


def dump(model_instance: BaseModel) -> dict:
    """Already-built Pydantic instance -> JSON-safe dict."""
    return model_instance.model_dump(mode="json")


# ── Query-param coercion (FastAPI coerced Optional[int]/bool/date silently) ──
def q_str(name: str) -> Optional[str]:
    value = request.args.get(name)
    return value if value not in (None, "") else None


def q_int(name: str) -> Optional[int]:
    value = q_str(name)
    if value is None:
        return None
    try:
        return int(value)
    except ValueError:
        raise ApiError(422, f"Query parameter '{name}' must be an integer")


def q_bool(name: str) -> Optional[bool]:
    value = q_str(name)
    if value is None:
        return None
    lowered = value.lower()
    if lowered in ("true", "1", "yes", "on"):
        return True
    if lowered in ("false", "0", "no", "off"):
        return False
    raise ApiError(422, f"Query parameter '{name}' must be a boolean")


def q_date(name: str) -> Optional[date]:
    value = q_str(name)
    if value is None:
        return None
    try:
        return date.fromisoformat(value)
    except ValueError:
        raise ApiError(422, f"Query parameter '{name}' must be a date (YYYY-MM-DD)")
