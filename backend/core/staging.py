"""
Lead staging management logic.
Handles creation, retrieval, and promotion of staged leads.
"""
from sqlmodel import Session, select
from typing import List, Optional
from datetime import datetime, date, timedelta
import uuid
from backend.models import LeadStaging, Lead, Center, User
from sqlalchemy import or_

# Export check_duplicate_lead for use in other modules
__all__ = [
    'check_duplicate_lead',
    'create_staging_lead',
    'get_staging_leads',
    'get_staging_lead_by_id',
    'promote_staging_lead'
]


def check_duplicate_lead(db: Session, player_name: str, phone: str) -> bool:
    """
    Check if a lead with the same player_name and phone already exists
    in either the Lead table or the LeadStaging table.
    
    Args:
        db: Database session
        player_name: Player's name
        phone: Phone number
        
    Returns:
        True if duplicate exists, False otherwise
    """
    # Normalize phone number (remove spaces, dashes, etc.)
    normalized_phone = phone.replace(" ", "").replace("-", "").replace("(", "").replace(")", "")
    
    # Check in Lead table
    lead_exists = db.exec(
        select(Lead).where(
            Lead.player_name.ilike(player_name),
            or_(
                Lead.phone == phone,
                Lead.phone == normalized_phone
            )
        )
    ).first()
    
    if lead_exists:
        return True
    
    # Check in LeadStaging table
    staging_exists = db.exec(
        select(LeadStaging).where(
            LeadStaging.player_name.ilike(player_name),
            or_(
                LeadStaging.phone == phone,
                LeadStaging.phone == normalized_phone
            )
        )
    ).first()
    
    if staging_exists:
        return True
    
    return False


def create_staging_lead(
    db: Session,
    player_name: str,
    phone: str,
    center_id: int,
    email: Optional[str] = None,
    created_by_id: Optional[int] = None
) -> LeadStaging:
    """
    Create a staging lead record.
    
    Args:
        db: Database session
        player_name: Player's name
        phone: Phone number
        center_id: Center ID
        email: Optional email address
        created_by_id: Optional user ID who created this (coach)
        
    Returns:
        Created LeadStaging object
        
    Raises:
        ValueError: If center not found, required fields missing, or duplicate lead exists
    """
    if not player_name or not phone:
        raise ValueError("Player name and phone are required")
    
    # Check for duplicates
    if check_duplicate_lead(db, player_name, phone):
        raise ValueError("A lead with this name and phone number already exists")
    
    # Verify center exists
    center = db.get(Center, center_id)
    if not center:
        raise ValueError(f"Center {center_id} not found")
    
    # Create staging record
    staging_lead = LeadStaging(
        player_name=player_name,
        phone=phone,
        email=email,
        center_id=center_id,
        created_by_id=created_by_id,
        created_at=datetime.utcnow()
    )
    
    db.add(staging_lead)
    db.commit()
    db.refresh(staging_lead)
    
    return staging_lead


def get_staging_leads(
    db: Session,
    user: Optional[User] = None,
    center_id: Optional[int] = None
) -> List[LeadStaging]:
    """
    Get staging leads for a user based on their role and assigned centers.
    
    Args:
        db: Database session
        user: User object (for role-based filtering)
        center_id: Optional center ID to filter by (overrides user centers)
        
    Returns:
        List of LeadStaging objects
    """
    query = select(LeadStaging)
    
    # Apply center filtering based on user role
    if user:
        if user.role == "team_lead":
            # Team leads see all staging leads
            pass
        else:
            # Other users see only their assigned centers
            user_center_ids = [c.id for c in user.centers]
            if user_center_ids:
                query = query.where(LeadStaging.center_id.in_(user_center_ids))
            else:
                # User has no centers, return empty list
                return []
    
    # Override with explicit center_id if provided
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
    player_age_category: str,  # Required for promotion
    email: Optional[str] = None,
    address: Optional[str] = None,
    date_of_birth: Optional[date] = None,
    user_id: Optional[int] = None
) -> Lead:
    """
    Promote a staging lead to a full Lead record.
    
    Args:
        db: Database session
        staging_id: Staging lead ID
        email: Optional email address
        address: Optional address
        player_age_category: Required age category
        date_of_birth: Optional date of birth
        user_id: Optional user ID who promoted this
        
    Returns:
        Created Lead object
        
    Raises:
        ValueError: If staging lead not found
    """
    staging = db.get(LeadStaging, staging_id)
    if not staging:
        raise ValueError(f"Staging lead {staging_id} not found")
    
    # Age category is required for promotion
    if not player_age_category:
        raise ValueError("player_age_category is required to promote a staging lead")
    
    # Use email from staging if not provided
    final_email = email or staging.email
    
    # Create full Lead record
    from datetime import timedelta
    initial_followup = datetime.utcnow() + timedelta(hours=24)
    
    new_lead = Lead(
        created_time=datetime.utcnow(),
        player_name=staging.player_name,
        player_age_category=player_age_category,
        date_of_birth=date_of_birth,
        phone=staging.phone,
        email=final_email,
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

