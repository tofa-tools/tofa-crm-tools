"""
Center management business logic.
Framework-agnostic center CRUD operations.
"""
from sqlmodel import Session, select
from typing import List, Optional
from backend.models import Center


def get_all_centers(db: Session) -> List[Center]:
    """Get all centers."""
    return list(db.exec(select(Center)).all())


def get_center_by_id(db: Session, center_id: int) -> Optional[Center]:
    """Get a center by ID."""
    return db.get(Center, center_id)


def get_center_display_name(db: Session, center_id: Optional[int]) -> str:
    """Get display name for a center (display_name or city or 'Unknown')."""
    if not center_id:
        return "Unknown"
    center = db.get(Center, center_id)
    return (center.display_name or center.city or "Unknown") if center else "Unknown"


def get_center_by_meta_tag(db: Session, meta_tag: str) -> Optional[Center]:
    """Get a center by meta tag name."""
    return db.exec(select(Center).where(Center.meta_tag_name == meta_tag)).first()


def create_center(
    db: Session,
    display_name: str,
    meta_tag_name: str,
    city: str,
    location: str = "",
    map_link: Optional[str] = None,
    group_email: Optional[str] = None
) -> Center:
    """
    Create a new center.
    
    Args:
        db: Database session
        display_name: Display name of the center
        meta_tag_name: Meta tag name (must be unique)
        city: City name
        location: Location details (optional)
        map_link: Google Maps URL (optional)
        group_email: Center Head / group email for internal notifications (optional)
        
    Returns:
        Created Center object
        
    Raises:
        ValueError: If meta_tag_name already exists
    """
    existing = get_center_by_meta_tag(db, meta_tag_name)
    if existing:
        raise ValueError(f"Center with meta tag '{meta_tag_name}' already exists")
    
    new_center = Center(
        display_name=display_name,
        meta_tag_name=meta_tag_name,
        city=city,
        location=location,
        map_link=map_link,
        group_email=(group_email or "").strip() or None
    )
    
    db.add(new_center)
    db.commit()
    db.refresh(new_center)
    return new_center


def update_center(
    db: Session,
    center_id: int,
    display_name: Optional[str] = None,
    meta_tag_name: Optional[str] = None,
    city: Optional[str] = None,
    location: Optional[str] = None,
    map_link: Optional[str] = None,
    group_email: Optional[str] = None
) -> Center:
    """
    Update an existing center.
    
    Args:
        db: Database session
        center_id: ID of center to update
        display_name: New display name (optional)
        meta_tag_name: New meta tag name (optional, must be unique)
        city: New city name (optional)
        location: New location details (optional)
        map_link: Google Maps URL (optional)
        group_email: Center Head / group email for internal notifications (optional)
        
    Returns:
        Updated Center object
        
    Raises:
        ValueError: If center not found or meta_tag_name already exists
    """
    center = get_center_by_id(db, center_id)
    if not center:
        raise ValueError(f"Center {center_id} not found")
    
    # Check if meta_tag_name is being changed and if it conflicts
    if meta_tag_name is not None and meta_tag_name != center.meta_tag_name:
        existing = get_center_by_meta_tag(db, meta_tag_name)
        if existing:
            raise ValueError(f"Center with meta tag '{meta_tag_name}' already exists")
        center.meta_tag_name = meta_tag_name
    
    if display_name is not None:
        center.display_name = display_name
    if city is not None:
        center.city = city
    if location is not None:
        center.location = location
    if map_link is not None:
        center.map_link = map_link
    if group_email is not None:
        center.group_email = (group_email or "").strip() or None

    db.add(center)
    db.commit()
    db.refresh(center)
    return center

