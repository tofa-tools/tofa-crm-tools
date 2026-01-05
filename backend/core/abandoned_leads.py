"""
Logic for identifying abandoned/ghosted leads.
"""
from sqlmodel import Session, select
from typing import List
from datetime import datetime, timedelta
from backend.models import Lead


def get_abandoned_leads(db: Session, user=None, hours_threshold: int = 48) -> List[Lead]:
    """
    Get leads that are abandoned (status='New' and created_time > threshold hours ago).
    
    Args:
        db: Database session
        user: Optional user to filter leads by their centers (if not team_lead)
        hours_threshold: Number of hours to consider a lead abandoned (default: 48)
        
    Returns:
        List of abandoned Lead objects
    """
    threshold_time = datetime.utcnow() - timedelta(hours=hours_threshold)
    
    query = select(Lead).where(
        Lead.status == "New",
        Lead.created_time <= threshold_time
    )
    
    # Filter by user's centers if not team_lead
    if user and user.role != "team_lead":
        center_ids = [c.id for c in user.centers]
        if center_ids:
            query = query.where(Lead.center_id.in_(center_ids))
        else:
            return []  # User has no centers
    
    return list(db.exec(query).all())


def count_abandoned_leads(db: Session, user=None, hours_threshold: int = 48) -> int:
    """
    Count abandoned leads.
    
    Args:
        db: Database session
        user: Optional user to filter leads by their centers
        hours_threshold: Number of hours to consider a lead abandoned (default: 48)
        
    Returns:
        Count of abandoned leads
    """
    return len(get_abandoned_leads(db, user, hours_threshold))


def get_abandoned_leads_count(db: Session) -> int:
    """
    Get count of abandoned leads (status='New' and created_time > 48 hours ago).
    Simple wrapper without user filtering for analytics endpoint.
    """
    return count_abandoned_leads(db, user=None, hours_threshold=48)

