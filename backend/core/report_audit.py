"""
Report audit logging logic.
Framework-agnostic business logic for logging report sharing actions.
"""
from sqlmodel import Session
from backend.models import AuditLog, Lead
from backend.core.audit import log_lead_activity
from datetime import datetime


def log_report_sent(
    db: Session,
    lead_id: int,
    user_id: int,
    details: str = "Progress Card shared with parent via WhatsApp"
) -> AuditLog:
    """
    Log that a report was sent for a student.
    
    Args:
        db: Database session
        lead_id: Lead (Student) ID
        user_id: User ID who sent the report
        details: Optional details about how the report was sent
        
    Returns:
        Created AuditLog entry
        
    Raises:
        ValueError: If lead not found
    """
    # Verify lead exists
    lead = db.get(Lead, lead_id)
    if not lead:
        raise ValueError(f"Lead {lead_id} not found")
    
    # Use the existing log_lead_activity function
    return log_lead_activity(
        db=db,
        lead_id=lead_id,
        user_id=user_id,
        action_type="REPORT_SENT",
        description=details,
        old_value=None,
        new_value=None
    )

