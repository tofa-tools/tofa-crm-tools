"""
User management business logic.
Framework-agnostic user CRUD operations.
"""
from sqlmodel import Session, select
from typing import List, Optional, Dict, Any
from backend.models import User, UserCenterLink
from backend.core.auth import get_password_hash


def get_user_with_centers(db: Session, user_id: int) -> Optional[Dict[str, Any]]:
    """
    Fetch a user and include their center_ids from the UserCenterLink table.

    Args:
        db: Database session
        user_id: ID of the user to fetch

    Returns:
        Dict with user fields (email, full_name, role) and center_ids if found, None otherwise
    """
    user = get_user_by_id(db, user_id)
    if not user:
        return None

    center_links = db.exec(
        select(UserCenterLink).where(UserCenterLink.user_id == user_id)
    ).all()
    center_ids = [link.center_id for link in center_links]

    return {
        "id": user.id,
        "email": user.email,
        "full_name": user.full_name,
        "role": user.role,
        "center_ids": center_ids,
    }


def get_all_users_with_centers(db: Session) -> List[Dict[str, Any]]:
    """
    List all users with their center assignments (center_ids).

    Args:
        db: Database session

    Returns:
        List of dicts with user fields and center_ids
    """
    users = get_all_users(db)
    result = []
    for user in users:
        center_links = db.exec(
            select(UserCenterLink).where(UserCenterLink.user_id == user.id)
        ).all()
        result.append({
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name,
            "phone": getattr(user, "phone", None),
            "role": user.role,
            "is_active": user.is_active,
            "center_ids": [link.center_id for link in center_links],
        })
    return result


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
    center_ids: List[int],
    phone: str
) -> User:
    """
    Create a new user and assign them to centers.
    
    Args:
        db: Database session
        email: User email
        password: Plain text password (will be hashed)
        full_name: User's full name
        role: User role (team_lead, team_member, observer, coach)
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
        role=role,
        phone=phone
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    # Validate: Coaches must be assigned to at least one center
    if role == "coach" and not center_ids:
        raise ValueError("Coaches must be assigned to at least one center")
    
    # Assign centers
    for center_id in center_ids:
        link = UserCenterLink(user_id=new_user.id, center_id=center_id)
        db.add(link)
    
    db.commit()
    db.refresh(new_user)
    return new_user


def update_user(
    db: Session,
    user_id: int,
    full_name: Optional[str] = None,
    phone: Optional[str] = None,
    role: Optional[str] = None,
    is_active: Optional[bool] = None,
    password: Optional[str] = None,
    center_ids: Optional[List[int]] = None
) -> User:
    """
    Update an existing user.
    
    Args:
        db: Database session
        user_id: ID of user to update
        full_name: New full name (optional)
        role: New role (optional)
        is_active: New active status (optional)
        password: New password (optional, will be hashed if provided)
        center_ids: New list of center IDs to assign user to (optional)
        
    Returns:
        Updated User object
        
    Raises:
        ValueError: If user not found or validation fails
    """
    user = get_user_by_id(db, user_id)
    if not user:
        raise ValueError(f"User {user_id} not found")
    
    # Update basic fields
    if full_name is not None:
        user.full_name = full_name
    if phone is not None:
        user.phone = phone
    if role is not None:
        user.role = role
    if is_active is not None:
        user.is_active = is_active
    
    # Update password if provided
    if password is not None and password.strip():
        user.hashed_password = get_password_hash(password)
    
    # Handle center re-assignment if provided
    if center_ids is not None:
        # Validate: Coaches must be assigned to at least one center
        if (role or user.role) == "coach" and not center_ids:
            raise ValueError("Coaches must be assigned to at least one center")
        
        # Clear existing center assignments
        existing_links = db.exec(
            select(UserCenterLink).where(UserCenterLink.user_id == user_id)
        ).all()
        for link in existing_links:
            db.delete(link)
        
        # Add new center assignments
        for center_id in center_ids:
            link = UserCenterLink(user_id=user_id, center_id=center_id)
            db.add(link)
    
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def verify_user_credentials(db: Session, email: str, password: str) -> Optional[User]:
    """
    Verify user credentials.
    
    Args:
        db: Database session
        email: User email
        password: Plain text password
        
    Returns:
        User object if credentials are valid, None otherwise
        
    Raises:
        ValueError: If user account is deactivated (is_active is False)
    """
    user = get_user_by_email(db, email)
    if not user:
        return None
    
    # Bcrypt limit is 72 bytes. Truncate here so we never pass longer to verify, even if auth layer is old.
    _p = password or ""
    try:
        _enc = _p.encode("utf-8")
        if len(_enc) > 72:
            _p = _enc[:72].decode("utf-8", errors="ignore")
    except Exception:
        _p = (_p or "")[:72]
    
    from backend.core.auth import verify_password
    if not verify_password(_p, user.hashed_password or ""):
        return None
    
    # Check if user account is active
    if not user.is_active:
        raise ValueError("Your account has been deactivated. Please contact the administrator.")
    
    return user


def toggle_user_status(db: Session, user_id: int) -> User:
    """
    Toggle a user's active status.
    
    Args:
        db: Database session
        user_id: ID of user to toggle
        
    Returns:
        Updated User object with flipped is_active status
        
    Raises:
        ValueError: If user not found
    """
    user = get_user_by_id(db, user_id)
    if not user:
        raise ValueError(f"User {user_id} not found")
    
    # Flip the is_active status
    user.is_active = not user.is_active
    
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

