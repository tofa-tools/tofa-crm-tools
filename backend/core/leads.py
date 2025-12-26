"""
Lead management business logic.
Framework-agnostic lead CRUD operations.
"""
from sqlmodel import Session, select
from typing import List, Optional
from datetime import datetime
from backend.models import Lead, Center, Comment, User
import pandas as pd


def get_leads_for_user(db: Session, user: User) -> List[Lead]:
    """
    Get leads for a user based on their role.
    Team leads see all leads, others see leads from their assigned centers.
    """
    if user.role == "team_lead":
        return list(db.exec(select(Lead)).all())
    else:
        center_ids = [c.id for c in user.centers]
        if not center_ids:
            return []
        return list(db.exec(select(Lead).where(Lead.center_id.in_(center_ids))).all())


def get_lead_by_id(db: Session, lead_id: int) -> Optional[Lead]:
    """Get a lead by ID."""
    return db.get(Lead, lead_id)


def update_lead(
    db: Session,
    lead_id: int,
    status: str,
    next_date: Optional[str] = None,
    comment: Optional[str] = None,
    user_id: Optional[int] = None
) -> Lead:
    """
    Update a lead's status and optionally add a comment.
    
    Args:
        db: Database session
        lead_id: Lead ID
        status: New status
        next_date: Next follow-up date (ISO format string)
        comment: Optional comment text
        user_id: User ID for the comment (if comment is provided)
        
    Returns:
        Updated Lead object
        
    Raises:
        ValueError: If lead not found
    """
    lead = get_lead_by_id(db, lead_id)
    if not lead:
        raise ValueError("Lead not found")
    
    lead.status = status
    
    if next_date and next_date != "None":
        try:
            lead.next_followup_date = datetime.fromisoformat(next_date)
        except (ValueError, AttributeError):
            pass
    
    if comment and user_id:
        new_comment = Comment(
            text=comment,
            user_id=user_id,
            lead_id=lead.id
        )
        db.add(new_comment)
    
    db.add(lead)
    db.commit()
    db.refresh(lead)
    return lead


def create_lead_from_meta(
    db: Session,
    phone: str,
    name: str,
    email: Optional[str],
    center_tag: str,
    age_category: str,
    address: Optional[str]
) -> Lead:
    """
    Create a lead from Meta webhook data.
    
    Args:
        db: Database session
        phone: Phone number
        name: Player name
        email: Email address (optional)
        center_tag: Center meta tag name
        age_category: Player age category
        address: Address (optional)
        
    Returns:
        Created Lead object
        
    Raises:
        ValueError: If center not found or phone is missing
    """
    if not phone:
        raise ValueError("Phone number is required")
    
    # Find center by meta tag
    center = db.exec(select(Center).where(Center.meta_tag_name == center_tag)).first()
    if not center:
        raise ValueError(f"Center '{center_tag}' not found")
    
    new_lead = Lead(
        created_time=datetime.now(),
        player_name=name if name else "Unknown",
        player_age_category=age_category if age_category else "Unknown",
        phone=phone,
        email=email,
        address=address,
        center_id=center.id,
        status="New"
    )
    
    db.add(new_lead)
    db.commit()
    db.refresh(new_lead)
    return new_lead


def import_leads_from_dataframe(db: Session, df: pd.DataFrame, meta_col: str) -> tuple[int, List[str]]:
    """
    Import leads from a pandas DataFrame.
    
    Args:
        db: Database session
        df: DataFrame with lead data
        meta_col: Column name containing center meta tag
        
    Returns:
        Tuple of (count of leads added, list of unknown center tags)
    """
    # Get existing centers
    existing_centers = db.exec(select(Center)).all()
    known_tags = [c.meta_tag_name for c in existing_centers]
    
    # Check for unknown tags
    df.columns = df.columns.str.strip()
    unique_tags = df[meta_col].unique()
    unknown_tags = [tag for tag in unique_tags if tag not in known_tags]
    
    if unknown_tags:
        return 0, list(unknown_tags)
    
    # Create leads
    count = 0
    for _, row in df.iterrows():
        center = db.exec(select(Center).where(Center.meta_tag_name == row[meta_col])).first()
        phone_val = str(row.get('phone', ''))
        
        if center:
            try:
                created_dt = pd.to_datetime(row.get('created_time', datetime.now())).to_pydatetime()
            except (ValueError, TypeError):
                created_dt = datetime.now()
            
            new_lead = Lead(
                created_time=created_dt,
                player_name=row.get('player_name', 'Unknown'),
                player_age_category=row.get('player_age_category', 'Unknown'),
                phone=phone_val,
                email=row.get('email', ''),
                address=row.get('address_and_pincode', ''),
                center_id=center.id,
                status="New"
            )
            db.add(new_lead)
            count += 1
    
    db.commit()
    return count, []

