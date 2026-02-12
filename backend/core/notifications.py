"""
Notification dispatcher service.
Saves in-app notifications to the Notification table for the bell feed.
When creating for a lead/student, attach center_id and target_url for deep-linking.
"""
from sqlmodel import Session, select
from sqlalchemy import func, or_
from typing import List, Optional
from datetime import datetime, timedelta
from urllib.parse import urlparse

from backend.models import Notification, UserCenterLink

VALID_TYPES = ("SALES_ALERT", "OPS_ALERT", "FINANCE_ALERT", "GOVERNANCE_ALERT")


def _target_url_from_link(link: Optional[str]) -> Optional[str]:
    """Derive app path from full URL for deep-linking (e.g. https://domain/leads?search=x -> /leads?search=x)."""
    if not link or not link.strip():
        return None
    parsed = urlparse(link.strip())
    path = parsed.path or "/"
    if parsed.query:
        path = f"{path}?{parsed.query}"
    return path[:500] if path != "/" else None


def send_notification(
    db: Session,
    user_id: int,
    type: str,
    title: str,
    message: str,
    link: Optional[str] = None,
    target_url: Optional[str] = None,
    center_id: Optional[int] = None,
    priority: str = "low",
) -> Notification:
    """
    Create and save a notification for a user (in-app bell).
    Pass center_id for lead/student notifications; priority "high" or "low".
    target_url is set from param or derived from link (path+query) for deep-linking.
    """
    if type not in VALID_TYPES:
        type = "OPS_ALERT"
    priority = "high" if priority == "high" else "low"
    resolved_target = (target_url or _target_url_from_link(link)) if (target_url or link) else None
    n = Notification(
        user_id=user_id,
        type=type,
        title=title[:255] if title else "Notification",
        message=(message or "")[:2000],
        link=link[:500] if link else None,
        target_url=resolved_target[:500] if resolved_target else None,
        is_read=False,
        created_at=datetime.utcnow(),
        center_id=center_id,
        priority=priority,
    )
    db.add(n)
    db.commit()
    db.refresh(n)
    return n


def notify_center_users(
    db: Session,
    center_id: int,
    type: str,
    title: str,
    message: str,
    link: Optional[str] = None,
    target_url: Optional[str] = None,
    priority: str = "low",
) -> List[Notification]:
    """
    Create a notification for every user assigned to the center (UserCenterLink).
    Attaches center_id and target_url (from param or derived from link) for deep-linking.
    """
    user_ids = [
        uc.user_id
        for uc in db.exec(select(UserCenterLink).where(UserCenterLink.center_id == center_id)).all()
        if uc.user_id is not None
    ]
    created = []
    for uid in user_ids:
        n = send_notification(
            db, uid, type, title, message,
            link=link, target_url=target_url, center_id=center_id, priority=priority,
        )
        created.append(n)
    return created


def get_notifications_for_user(
    db: Session,
    user_id: int,
    limit: int = 20,
    offset: int = 0,
    unread_only: bool = False,
    is_team_lead: bool = False,
    user_center_ids: Optional[List[int]] = None,
    since_hours: Optional[int] = None,
) -> List[Notification]:
    """
    Fetch notifications for a user, newest first.
    If team_lead: return all. If team_member/observer: only where center_id is in user_center_ids or null.
    If since_hours is set, only return notifications created in the last N hours.
    """
    query = select(Notification).where(Notification.user_id == user_id)
    if not is_team_lead and user_center_ids is not None:
        query = query.where(
            or_(
                Notification.center_id.in_(user_center_ids),
                Notification.center_id.is_(None),
            )
        )
    if unread_only:
        query = query.where(Notification.is_read == False)
    if since_hours is not None and since_hours > 0:
        since = datetime.utcnow() - timedelta(hours=since_hours)
        query = query.where(Notification.created_at >= since)
    query = query.order_by(Notification.created_at.desc()).limit(limit).offset(offset)
    return list(db.exec(query).all())


def get_unread_count(
    db: Session,
    user_id: int,
    is_team_lead: bool = False,
    user_center_ids: Optional[List[int]] = None,
) -> int:
    """Return count of unread notifications for user (role-filtered for non-team-leads)."""
    q = select(func.count(Notification.id)).where(
        Notification.user_id == user_id,
        Notification.is_read == False,
    )
    if not is_team_lead and user_center_ids is not None:
        q = q.where(
            or_(
                Notification.center_id.in_(user_center_ids),
                Notification.center_id.is_(None),
            )
        )
    result = db.exec(q).first()
    return result or 0


def mark_as_read(db: Session, notification_id: int, user_id: int) -> bool:
    """Mark a single notification as read (only if it belongs to user)."""
    n = db.get(Notification, notification_id)
    if not n or n.user_id != user_id:
        return False
    n.is_read = True
    db.add(n)
    db.commit()
    return True


def mark_all_as_read(db: Session, user_id: int) -> int:
    """Mark all notifications for the user as read. Returns count updated."""
    notifications = db.exec(
        select(Notification).where(
            Notification.user_id == user_id,
            Notification.is_read == False,
        )
    ).all()
    count = 0
    for n in notifications:
        n.is_read = True
        db.add(n)
        count += 1
    if count:
        db.commit()
    return count
