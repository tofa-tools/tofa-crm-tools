"""
User management business logic.
Framework-agnostic user CRUD operations.
"""
from sqlmodel import Session, select
from typing import List, Optional
from backend.models import User, UserCenterLink
from backend.core.auth import get_password_hash


def get_user_by_email(db: Session, email: str) -> Optional[User]:
    """Get a user by email address."""
    return db.exec(select(User).where(User.email == email)).first()


def get_user_by_id(db: Session, user_id: int) -> Optional[User]:
    """Get a user by ID."""
    return db.get(User, user_id)


def get_all_users(db: Session) -> List[User]:
    """Get all users."""
    return list(db.exec(select(User)).all())


def create_user(
    db: Session,
    email: str,
    password: str,
    full_name: str,
    role: str,
    center_ids: List[int]
) -> User:
    """
    Create a new user and assign them to centers.
    
    Args:
        db: Database session
        email: User email
        password: Plain text password (will be hashed)
        full_name: User's full name
        role: User role (team_member, team_lead, observer)
        center_ids: List of center IDs to assign user to
        
    Returns:
        Created User object
        
    Raises:
        ValueError: If email already exists
    """
    # Check if user already exists
    existing = get_user_by_email(db, email)
    if existing:
        raise ValueError("Email already registered")
    
    # Create user
    new_user = User(
        email=email,
        hashed_password=get_password_hash(password),
        full_name=full_name,
        role=role
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    # Assign centers
    for center_id in center_ids:
        link = UserCenterLink(user_id=new_user.id, center_id=center_id)
        db.add(link)
    
    db.commit()
    db.refresh(new_user)
    return new_user


def verify_user_credentials(db: Session, email: str, password: str) -> Optional[User]:
    """
    Verify user credentials.
    
    Args:
        db: Database session
        email: User email
        password: Plain text password
        
    Returns:
        User object if credentials are valid, None otherwise
    """
    user = get_user_by_email(db, email)
    if not user:
        return None
    
    from backend.core.auth import verify_password
    if not verify_password(password, user.hashed_password):
        return None
    
    return user

