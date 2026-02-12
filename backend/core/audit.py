"""
Audit logging for lead changes.
Framework-agnostic audit logging utilities.
"""
from sqlmodel import Session
from datetime import datetime
from typing import Optional
from backend.models import AuditLog, Lead, User


def log_lead_activity(
    db: Session,
    lead_id: int,
    user_id: Optional[int],
    action_type: str,
    description: str,
    old_value: Optional[str] = None,
    new_value: Optional[str] = None
) -> AuditLog:
    """
    Log an activity/change to a lead.
    
    Args:
        db: Database session
        lead_id: ID of the lead being changed
        user_id: ID of the user making the change (None for system/public actions)
        action_type: Type of action ('status_change', 'comment_added', etc.)
        description: Human-readable description
        old_value: Previous value (optional)
        new_value: New value (optional)
        
    Returns:
        Created AuditLog entry
    """
    audit_log = AuditLog(
        lead_id=lead_id,
        user_id=user_id,
        action_type=action_type,
        description=description,
        old_value=old_value,
        new_value=new_value,
        timestamp=datetime.utcnow()
    )
    
    db.add(audit_log)
    
    # Also update the lead's last_updated timestamp
    lead = db.get(Lead, lead_id)
    if lead:
        lead.last_updated = datetime.utcnow()
        db.add(lead)
    
    db.commit()
    db.refresh(audit_log)
    return audit_log


def log_status_change(
    db: Session,
    lead_id: int,
    user_id: int,
    old_status: str,
    new_status: str
) -> AuditLog:
    """Log a status change."""
    return log_lead_activity(
        db=db,
        lead_id=lead_id,
        user_id=user_id,
        action_type='status_change',
        description=f"Status changed from '{old_status}' to '{new_status}'",
        old_value=old_status,
        new_value=new_status
    )


def log_comment_added(
    db: Session,
    lead_id: int,
    user_id: int,
    comment_text: str
) -> AuditLog:
    """Log a comment being added."""
    # Truncate long comments for description
    preview = comment_text[:50] + "..." if len(comment_text) > 50 else comment_text
    return log_lead_activity(
        db=db,
        lead_id=lead_id,
        user_id=user_id,
        action_type='comment_added',
        description=f"Added comment: {preview}",
        new_value=comment_text
    )


def log_field_update(
    db: Session,
    lead_id: int,
    user_id: int,
    field_name: str,
    old_value: Optional[str],
    new_value: Optional[str]
) -> AuditLog:
    """Log a field update."""
    return log_lead_activity(
        db=db,
        lead_id=lead_id,
        user_id=user_id,
        action_type='field_update',
        description=f"Updated {field_name}",
        old_value=str(old_value) if old_value else None,
        new_value=str(new_value) if new_value else None
    )


def get_audit_logs_for_lead(db: Session, lead_id: int, limit: Optional[int] = None) -> list[AuditLog]:
    """
    Get audit logs for a specific lead, ordered by most recent first.
    
    Args:
        db: Database session
        lead_id: ID of the lead
        limit: Optional limit on number of logs to return
        
    Returns:
        List of AuditLog entries
    """
    from sqlmodel import select
    
    query = select(AuditLog).where(AuditLog.lead_id == lead_id).order_by(AuditLog.timestamp.desc())
    
    if limit:
        query = query.limit(limit)
    
    return list(db.exec(query).all())

