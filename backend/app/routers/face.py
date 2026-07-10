from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from starlette.concurrency import run_in_threadpool

from app.core.deps import require_role
from app.database import get_db
from app.models.activity_log import ActivityLog
from app.models.user import ROLE_STUDENT, User
from app.schemas.face import FaceRegisterRequest, FaceRegisterResponse
from app.services.face_service import register_frames

router = APIRouter(prefix="/api/face", tags=["face"])


@router.post("/register", response_model=FaceRegisterResponse)
async def register_face(
    payload: FaceRegisterRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(ROLE_STUDENT)),
):
    """Register a student's face from multiple captured samples (spec §10)."""
    if not payload.frames:
        raise HTTPException(status_code=400, detail="No frames provided")

    # Embedding is CPU-heavy; run off the event loop.
    saved = await run_in_threadpool(register_frames, db, user, payload.frames)
    if saved == 0:
        raise HTTPException(
            status_code=422,
            detail="No clear face detected in the samples. Retry with good lighting.",
        )

    db.add(ActivityLog(user_id=user.id, action="face_registered", detail=f"{saved} samples"))
    db.commit()
    return FaceRegisterResponse(
        registered=True,
        samples_saved=saved,
        message=f"Face registered from {saved} sample(s).",
    )
