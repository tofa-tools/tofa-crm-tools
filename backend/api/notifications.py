"""
Notification API routes.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session

from backend.api.deps import get_current_user, get_session
from backend.core.notifications import (
    get_notifications_for_user,
    get_unread_count,
    mark_as_read,
    mark_all_as_read,
)
from backend.models import User

router = APIRouter()


@router.get("")
def get_notifications(
    limit: int = 20,
    offset: int = 0,
    unread_only: bool = False,
    hours: int = 48,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Fetch current user's notifications (paginated). team_lead: all; others: only where center_id in user's centers."""
    is_team_lead = current_user.role == "team_lead"
    user_center_ids = [c.id for c in current_user.centers] if not is_team_lead else None
    since_hours = hours if hours > 0 else None
    notifications = get_notifications_for_user(
        db, current_user.id,
        limit=limit, offset=offset, unread_only=unread_only,
        is_team_lead=is_team_lead, user_center_ids=user_center_ids,
        since_hours=since_hours,
    )
    return [
        {
            "id": n.id,
            "user_id": n.user_id,
            "type": n.type,
            "title": n.title,
            "message": n.message,
            "link": n.link,
            "target_url": getattr(n, "target_url", None),
            "is_read": n.is_read,
            "created_at": n.created_at.isoformat() if n.created_at else None,
            "center_id": n.center_id,
            "priority": getattr(n, "priority", "low"),
        }
        for n in notifications
    ]


@router.get("/unread-count")
def get_notifications_unread_count(
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Return unread notification count for the current user (role-filtered)."""
    is_team_lead = current_user.role == "team_lead"
    user_center_ids = [c.id for c in current_user.centers] if not is_team_lead else None
    return {"count": get_unread_count(db, current_user.id, is_team_lead=is_team_lead, user_center_ids=user_center_ids)}


@router.put("/{notification_id}/read")
def mark_notification_read(
    notification_id: int,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Mark a single notification as read."""
    if not mark_as_read(db, notification_id, current_user.id):
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"status": "ok"}


@router.put("/read-all")
def mark_all_notifications_read(
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Mark all notifications for the current user as read."""
    count = mark_all_as_read(db, current_user.id)
    return {"marked_count": count}
