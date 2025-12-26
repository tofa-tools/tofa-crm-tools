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


def get_center_by_meta_tag(db: Session, meta_tag: str) -> Optional[Center]:
    """Get a center by meta tag name."""
    return db.exec(select(Center).where(Center.meta_tag_name == meta_tag)).first()


def create_center(
    db: Session,
    display_name: str,
    meta_tag_name: str,
    city: str,
    location: str = ""
) -> Center:
    """
    Create a new center.
    
    Args:
        db: Database session
        display_name: Display name of the center
        meta_tag_name: Meta tag name (must be unique)
        city: City name
        location: Location details (optional)
        
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
        location=location
    )
    
    db.add(new_center)
    db.commit()
    db.refresh(new_center)
    return new_center

