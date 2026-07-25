from flask import Blueprint, g

from app.core.deps import require_role
from app.models.activity_log import ActivityLog
from app.models.user import ROLE_STUDENT
from app.schemas.face import FaceRegisterRequest, FaceRegisterResponse
from app.services.face_service import register_frames
from app.web import ApiError, dump, parse_body

bp = Blueprint("face", __name__, url_prefix="/api/face")


@bp.post("/register")
@require_role(ROLE_STUDENT)
def register_face():
    """Register a student's face from multiple captured samples (spec §10)."""
    payload = parse_body(FaceRegisterRequest)
    if not payload.frames:
        raise ApiError(400, "No frames provided")

    # Embedding is CPU-heavy; runs synchronously in this worker thread.
    saved = register_frames(g.db, g.user, payload.frames)
    if saved == 0:
        raise ApiError(
            422,
            "No clear face detected in the samples. Retry with good lighting.",
        )

    g.db.add(ActivityLog(user_id=g.user.id, action="face_registered", detail=f"{saved} samples"))
    g.db.commit()
    return dump(
        FaceRegisterResponse(
            registered=True,
            samples_saved=saved,
            message=f"Face registered from {saved} sample(s).",
        )
    )
