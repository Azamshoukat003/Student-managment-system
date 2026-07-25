from flask import Blueprint, g, jsonify

from app.core.deps import require_role
from app.models.activity_log import ActivityLog
from app.models.user import ROLE_ADMIN, User
from app.web import q_int

bp = Blueprint("activity-logs", __name__, url_prefix="/api/activity-logs")


@bp.get("")
@require_role(ROLE_ADMIN)
def list_activity():
    """Recent important actions (spec §26)."""
    limit = q_int("limit")
    if limit is None:
        limit = 100
    rows = (
        g.db.query(ActivityLog, User)
        .outerjoin(User, ActivityLog.user_id == User.id)
        .order_by(ActivityLog.created_at.desc())
        .limit(min(limit, 500))
        .all()
    )
    return jsonify(
        [
            {
                "id": log.id,
                "action": log.action,
                "detail": log.detail,
                "user_name": user.full_name if user else None,
                "created_at": log.created_at.isoformat() if log.created_at else None,
            }
            for log, user in rows
        ]
    )
