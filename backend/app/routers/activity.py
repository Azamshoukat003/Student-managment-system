from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.deps import require_role
from app.database import get_db
from app.models.activity_log import ActivityLog
from app.models.user import ROLE_ADMIN, User

router = APIRouter(prefix="/api/activity-logs", tags=["activity-logs"])


@router.get("")
def list_activity(
    db: Session = Depends(get_db),
    _: User = Depends(require_role(ROLE_ADMIN)),
    limit: int = 100,
):
    """Recent important actions (spec §26)."""
    rows = (
        db.query(ActivityLog, User)
        .outerjoin(User, ActivityLog.user_id == User.id)
        .order_by(ActivityLog.created_at.desc())
        .limit(min(limit, 500))
        .all()
    )
    return [
        {
            "id": log.id,
            "action": log.action,
            "detail": log.detail,
            "user_name": user.full_name if user else None,
            "created_at": log.created_at.isoformat() if log.created_at else None,
        }
        for log, user in rows
    ]
