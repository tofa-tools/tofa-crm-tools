"""
Logic for identifying "At-Risk" leads - leads that haven't been updated in a while.
"""
from sqlmodel import Session, select, func, and_
from datetime import datetime, timedelta
from backend.models import Lead

def get_at_risk_leads_count(db: Session) -> int:
    """
    Counts leads that are 'At-Risk': 
    - Status is 'Joined' or 'Trial Scheduled'
    - last_updated is older than 10 days (or is None and created_time is older than 10 days)
    """
    ten_days_ago = datetime.utcnow() - timedelta(days=10)
    
    # Build query for at-risk leads
    # Either last_updated is None and created_time is old, or last_updated is old
    query = select(func.count(Lead.id)).where(
        and_(
            Lead.status.in_(["Joined", "Trial Scheduled"]),
            (
                (Lead.last_updated.is_(None) & (Lead.created_time <= ten_days_ago)) |
                (Lead.last_updated.isnot(None) & (Lead.last_updated <= ten_days_ago))
            )
        )
    )
    
    count = db.exec(query).one()
    return count


def is_lead_at_risk(lead: Lead) -> bool:
    """
    Checks if a single lead is at-risk based on its status and last_updated/created_time.
    """
    ten_days_ago = datetime.utcnow() - timedelta(days=10)
    
    if lead.status not in ["Joined", "Trial Scheduled"]:
        return False
    
    # Check if last_updated is old, or if it's None, check created_time
    if lead.last_updated:
        return lead.last_updated <= ten_days_ago
    else:
        return lead.created_time <= ten_days_ago

