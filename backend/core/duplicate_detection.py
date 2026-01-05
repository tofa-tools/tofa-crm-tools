"""
Duplicate detection logic for leads.
Prevents data pollution by checking for existing leads with same name + phone + email.
"""
from sqlmodel import Session, select, and_, or_
from typing import Optional, Tuple
from datetime import datetime
from backend.models import Lead, AuditLog


def find_duplicate_lead(
    db: Session,
    player_name: str,
    phone: str,
    email: Optional[str] = None
) -> Optional[Lead]:
    """
    Check if a lead with the same combination of player_name, phone, and email already exists.
    
    Args:
        db: Database session
        player_name: Player name to check
        phone: Phone number to check
        email: Email to check (optional, can be None)
        
    Returns:
        Existing Lead if duplicate found, None otherwise
    """
    # Build query: match on player_name AND phone
    # If email is provided, also match on email (or email is None)
    query = select(Lead).where(
        and_(
            Lead.player_name == player_name,
            Lead.phone == phone
        )
    )
    
    # If email is provided, require exact match
    # If email is None, match leads where email is also None
    if email:
        query = query.where(Lead.email == email)
    else:
        query = query.where(Lead.email.is_(None))
    
    return db.exec(query).first()


def handle_duplicate_lead(
    db: Session,
    existing_lead: Lead,
    source: str = "Unknown",
    user_id: Optional[int] = None
) -> Lead:
    """
    Handle a duplicate lead submission by updating the existing lead.
    
    Actions:
    1. Update last_updated timestamp
    2. Add audit log entry
    3. Reset status to 'New' if it was 'Dead/Not Interested'
    
    Args:
        db: Database session
        existing_lead: The existing lead that was found as duplicate
        source: Source of the duplicate submission (e.g., "CSV Import", "Meta Webhook")
        user_id: Optional user ID for audit log
        
    Returns:
        Updated Lead object
    """
    from backend.core.audit import log_status_change, log_field_update
    
    old_status = existing_lead.status
    
    # Update last_updated timestamp
    existing_lead.last_updated = datetime.utcnow()
    
    # Reset status to 'New' if it was 'Dead/Not Interested'
    if existing_lead.status == "Dead/Not Interested":
        existing_lead.status = "New"
        log_status_change(
            db=db,
            lead_id=existing_lead.id,
            user_id=user_id or 0,  # Use 0 if no user_id provided
            old_status=old_status,
            new_status="New"
        )
    
    # Add audit log for duplicate detection
    log_field_update(
        db=db,
        lead_id=existing_lead.id,
        user_id=user_id or 0,
        field_name="duplicate_detection",
        old_value=None,
        new_value=f"Duplicate submission detected via {source}; lead refreshed"
    )
    
    db.add(existing_lead)
    db.commit()
    db.refresh(existing_lead)
    
    return existing_lead

