"""
Subscription and auto-expiry logic for student leads.
Framework-agnostic subscription management.
"""
from sqlmodel import Session, select
from datetime import date, datetime
from typing import List
from backend.models import Lead, AuditLog


def check_subscription_expirations(db: Session) -> List[int]:
    """
    Check for expired subscriptions and move students to Nurture pool.
    
    Logic:
    - Find all leads with status 'Joined' where subscription_end_date is in the past (before today)
    - Change status to 'Nurture'
    - Clear the next_followup_date
    - Add an Audit Log entry: 'System: Subscription expired; student moved to Nurture pool.'
    
    Args:
        db: Database session
        
    Returns:
        List of lead IDs that were expired
    """
    today = date.today()
    
    # Find all leads with status 'Joined' where subscription_end_date is in the past
    expired_leads = db.exec(
        select(Lead).where(
            Lead.status == "Joined",
            Lead.subscription_end_date.isnot(None),
            Lead.subscription_end_date < today
        )
    ).all()
    
    expired_lead_ids = []
    
    for lead in expired_leads:
        # Change status to 'Nurture'
        old_status = lead.status
        lead.status = "Nurture"
        
        # Clear the next_followup_date
        lead.next_followup_date = None
        
        # Update last_updated timestamp
        lead.last_updated = datetime.utcnow()
        
        # Add Audit Log entry (system-generated, no user_id)
        audit_log = AuditLog(
            lead_id=lead.id,
            user_id=None,  # System-generated, no user
            action_type='status_change',
            description='System: Subscription expired; student moved to Nurture pool.',
            old_value=old_status,
            new_value="Nurture",
            timestamp=datetime.utcnow()
        )
        
        db.add(audit_log)
        db.add(lead)
        expired_lead_ids.append(lead.id)
    
    if expired_lead_ids:
        db.commit()
    
    return expired_lead_ids

