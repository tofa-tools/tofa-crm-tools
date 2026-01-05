"""
Lead staging management logic.
Handles creation, retrieval, and promotion of staged leads.
"""
from sqlmodel import Session, select
from typing import List, Optional
from datetime import datetime, date
import uuid
from backend.models import LeadStaging, Lead, Center, User


def create_staging_lead(
    db: Session,
    player_name: str,
    phone: str,
    center_id: int,
    date_of_birth: Optional[date] = None,
    user_id: Optional[int] = None
) -> LeadStaging:
    """
    Create a staging lead record.
    
    Args:
        db: Database session
        player_name: Player's name
        phone: Phone number
        center_id: Center ID
        date_of_birth: Optional date of birth
        user_id: Optional user ID who created this (coach)
        
    Returns:
        Created LeadStaging object
        
    Raises:
        ValueError: If center not found or required fields missing
    """
    if not player_name or not phone:
        raise ValueError("Player name and phone are required")
    
    # Verify center exists
    center = db.get(Center, center_id)
    if not center:
        raise ValueError(f"Center {center_id} not found")
    
    # Create staging record
    staging_lead = LeadStaging(
        player_name=player_name,
        phone=phone,
        center_id=center_id,
        date_of_birth=date_of_birth,
        created_at=datetime.utcnow()
    )
    
    db.add(staging_lead)
    db.commit()
    db.refresh(staging_lead)
    
    return staging_lead


def get_staging_leads(
    db: Session,
    center_id: Optional[int] = None
) -> List[LeadStaging]:
    """
    Get all staging leads, optionally filtered by center.
    
    Args:
        db: Database session
        center_id: Optional center ID to filter by
        
    Returns:
        List of LeadStaging objects
    """
    query = select(LeadStaging)
    
    if center_id:
        query = query.where(LeadStaging.center_id == center_id)
    
    query = query.order_by(LeadStaging.created_at.desc())
    
    return list(db.exec(query).all())


def get_staging_lead_by_id(
    db: Session,
    staging_id: int
) -> Optional[LeadStaging]:
    """
    Get a staging lead by ID.
    
    Args:
        db: Database session
        staging_id: Staging lead ID
        
    Returns:
        LeadStaging object or None if not found
    """
    return db.get(LeadStaging, staging_id)


def promote_staging_lead(
    db: Session,
    staging_id: int,
    email: Optional[str] = None,
    address: Optional[str] = None,
    player_age_category: Optional[str] = None,
    user_id: Optional[int] = None
) -> Lead:
    """
    Promote a staging lead to a full Lead record.
    
    Args:
        db: Database session
        staging_id: Staging lead ID
        email: Optional email address
        address: Optional address
        player_age_category: Optional age category
        user_id: Optional user ID who promoted this
        
    Returns:
        Created Lead object
        
    Raises:
        ValueError: If staging lead not found
    """
    staging = db.get(LeadStaging, staging_id)
    if not staging:
        raise ValueError(f"Staging lead {staging_id} not found")
    
    # Calculate age category from date_of_birth if not provided
    age_category = player_age_category
    if not age_category and staging.date_of_birth:
        from datetime import date
        today = date.today()
        age = today.year - staging.date_of_birth.year - ((today.month, today.day) < (staging.date_of_birth.month, staging.date_of_birth.day))
        
        # Simple age category mapping (can be enhanced)
        if age < 9:
            age_category = "U9"
        elif age < 11:
            age_category = "U11"
        elif age < 13:
            age_category = "U13"
        elif age < 15:
            age_category = "U15"
        else:
            age_category = "U17+"
    
    if not age_category:
        age_category = "Unknown"
    
    # Create full Lead record
    from datetime import timedelta
    initial_followup = datetime.utcnow() + timedelta(hours=24)
    
    new_lead = Lead(
        created_time=datetime.utcnow(),
        player_name=staging.player_name,
        player_age_category=age_category,
        date_of_birth=staging.date_of_birth,
        phone=staging.phone,
        email=email,
        address=address,
        center_id=staging.center_id,
        status="New",
        public_token=str(uuid.uuid4()),
        next_followup_date=initial_followup
    )
    
    db.add(new_lead)
    
    # Delete staging record
    db.delete(staging)
    
    db.commit()
    db.refresh(new_lead)
    
    return new_lead

