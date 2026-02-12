"""
Batch management business logic.
Framework-agnostic batch operations.
"""
from sqlmodel import Session, select, func
from typing import List, Optional, Tuple
from datetime import date
from backend.models import Batch, BatchCoachLink, User, Center, Lead, StudentBatchLink


def get_all_batches(
    db: Session,
    user: Optional[User] = None,
    center_id: Optional[int] = None
) -> List[Batch]:
    """
    Get all batches, optionally filtered by center and user role.
    
    Args:
        db: Database session
        user: Optional user object to determine filtering (Team Leads see all, others see only active)
        center_id: Optional center ID to filter by
        
    Returns:
        List of Batch objects
    """
    query = select(Batch)
    
    # Filter by center if provided
    if center_id:
        query = query.where(Batch.center_id == center_id)
    
    # Filter by is_active based on user role
    # Team Leads see all batches (active and inactive)
    # Coaches and Sales see only active batches
    if user and user.role != "team_lead":
        query = query.where(Batch.is_active == True)
    
    batches = db.exec(query).all()
    return list(batches)


def get_batch_coaches(
    db: Session,
    batch_id: int
) -> List[User]:
    """
    Get all coaches assigned to a batch.
    
    Args:
        db: Database session
        batch_id: Batch ID
        
    Returns:
        List of User objects (coaches)
    """
    coach_ids = db.exec(
        select(BatchCoachLink.user_id).where(BatchCoachLink.batch_id == batch_id)
    ).all()
    
    if not coach_ids:
        return []
    
    coaches = db.exec(
        select(User).where(User.id.in_(coach_ids))
    ).all()
    
    return list(coaches)


def assign_coaches_to_batch(
    db: Session,
    batch_id: int,
    coach_ids: List[int]
) -> List[BatchCoachLink]:
    """
    Assign multiple coaches to a batch. Replaces existing assignments.
    
    Args:
        db: Database session
        batch_id: Batch ID
        coach_ids: List of coach user IDs
        
    Returns:
        List of BatchCoachLink objects
        
    Raises:
        ValueError: If batch not found, any user not found, or any user is not a coach
    """
    # Verify batch exists
    batch = db.get(Batch, batch_id)
    if not batch:
        raise ValueError(f"Batch {batch_id} not found")
    
    # Validate all users exist and are coaches
    for user_id in coach_ids:
        user = db.get(User, user_id)
        if not user:
            raise ValueError(f"User {user_id} not found")
        if user.role != "coach":
            raise ValueError(f"User {user_id} is not a coach (role: {user.role})")
    
    # Remove existing assignments
    existing_assignments = db.exec(
        select(BatchCoachLink).where(BatchCoachLink.batch_id == batch_id)
    ).all()
    for assignment in existing_assignments:
        db.delete(assignment)
    
    # Create new assignments
    new_assignments = []
    for coach_id in coach_ids:
        assignment = BatchCoachLink(batch_id=batch_id, user_id=coach_id)
        db.add(assignment)
        new_assignments.append(assignment)
    
    db.commit()
    
    # Refresh all assignments
    for assignment in new_assignments:
        db.refresh(assignment)
    
    return new_assignments


def create_batch(
    db: Session,
    name: str,
    center_id: int,
    min_age: int = 0,
    max_age: int = 99,
    max_capacity: int = 20,
    is_mon: bool = False,
    is_tue: bool = False,
    is_wed: bool = False,
    is_thu: bool = False,
    is_fri: bool = False,
    is_sat: bool = False,
    is_sun: bool = False,
    start_time: Optional[str] = None,
    end_time: Optional[str] = None,
    start_date: Optional[date] = None,
    is_active: bool = True,
    coach_ids: Optional[List[int]] = None
) -> Batch:
    """
    Create a new batch.
    
    Args:
        db: Database session
        name: Batch name
        center_id: Center ID
        min_age: Minimum age for batch (inclusive)
        max_age: Maximum age for batch (inclusive)
        max_capacity: Maximum capacity
        is_mon through is_sun: Boolean schedule flags
        start_time: Optional start time (HH:MM:SS format)
        end_time: Optional end time (HH:MM:SS format)
        start_date: Batch start date (mandatory)
        is_active: Whether the batch is active (default: True)
        
    Returns:
        Created Batch
        
    Raises:
        ValueError: If center not found or start_date not provided
    """
    # Verify center exists
    center = db.get(Center, center_id)
    if not center:
        raise ValueError(f"Center {center_id} not found")
    
    # Parse time strings if provided
    from datetime import time as dt_time
    start_time_obj = None
    end_time_obj = None
    
    if start_time:
        try:
            time_parts = start_time.split(':')
            start_time_obj = dt_time(int(time_parts[0]), int(time_parts[1]), int(time_parts[2]) if len(time_parts) > 2 else 0)
        except (ValueError, IndexError):
            raise ValueError(f"Invalid start_time format: {start_time}")
    
    if end_time:
        try:
            time_parts = end_time.split(':')
            end_time_obj = dt_time(int(time_parts[0]), int(time_parts[1]), int(time_parts[2]) if len(time_parts) > 2 else 0)
        except (ValueError, IndexError):
            raise ValueError(f"Invalid end_time format: {end_time}")
    
    # Validate start_date is provided (mandatory)
    if not start_date:
        raise ValueError("start_date is required")
    
    batch = Batch(
        name=name,
        center_id=center_id,
        min_age=min_age,
        max_age=max_age,
        max_capacity=max_capacity,
        is_mon=is_mon,
        is_tue=is_tue,
        is_wed=is_wed,
        is_thu=is_thu,
        is_fri=is_fri,
        is_sat=is_sat,
        is_sun=is_sun,
        start_time=start_time_obj,
        end_time=end_time_obj,
        start_date=start_date,
        is_active=is_active
    )
    
    db.add(batch)
    db.commit()
    db.refresh(batch)
    
    # Assign coaches if provided
    if coach_ids:
        for coach_id in coach_ids:
            user = db.get(User, coach_id)
            if user and user.role == "coach":
                assignment = BatchCoachLink(batch_id=batch.id, user_id=coach_id)
                db.add(assignment)
        db.commit()
        db.refresh(batch)
    
    return batch


def assign_coach_to_batch(
    db: Session,
    batch_id: int,
    user_id: int
) -> BatchCoachLink:
    """
    Assign a coach to a batch.
    
    Args:
        db: Database session
        batch_id: Batch ID
        user_id: User ID of the coach
        
    Returns:
        Created BatchCoachLink
        
    Raises:
        ValueError: If batch not found, user not found, or user is not a coach
    """
    # Verify batch exists
    batch = db.get(Batch, batch_id)
    if not batch:
        raise ValueError(f"Batch {batch_id} not found")
    
    # Verify user exists and is a coach
    user = db.get(User, user_id)
    if not user:
        raise ValueError(f"User {user_id} not found")
    
    if user.role != "coach":
        raise ValueError(f"User {user_id} is not a coach (role: {user.role})")
    
    # Check if assignment already exists
    existing = db.exec(
        select(BatchCoachLink).where(
            BatchCoachLink.batch_id == batch_id,
            BatchCoachLink.user_id == user_id
        )
    ).first()
    
    if existing:
        return existing  # Already assigned
    
    # Create assignment
    assignment = BatchCoachLink(
        batch_id=batch_id,
        user_id=user_id
    )
    
    db.add(assignment)
    db.commit()
    db.refresh(assignment)
    
    return assignment


def get_coach_batches(
    db: Session,
    user_id: int
) -> List[Batch]:
    """
    Get all batches assigned to a coach.
    
    Args:
        db: Database session
        user_id: Coach user ID
        
    Returns:
        List of Batch objects
    """
    batch_ids = db.exec(
        select(BatchCoachLink.batch_id).where(BatchCoachLink.user_id == user_id)
    ).all()
    
    if not batch_ids:
        return []
    
    # Only return active batches for coaches
    batches = db.exec(
        select(Batch).where(
            Batch.id.in_(batch_ids),
            Batch.is_active == True
        )
    ).all()
    
    return list(batches)


def update_batch(
    db: Session,
    batch_id: int,
    name: Optional[str] = None,
    center_id: Optional[int] = None,
    min_age: Optional[int] = None,
    max_age: Optional[int] = None,
    max_capacity: Optional[int] = None,
    is_mon: Optional[bool] = None,
    is_tue: Optional[bool] = None,
    is_wed: Optional[bool] = None,
    is_thu: Optional[bool] = None,
    is_fri: Optional[bool] = None,
    is_sat: Optional[bool] = None,
    is_sun: Optional[bool] = None,
    start_time: Optional[str] = None,
    end_time: Optional[str] = None,
    start_date: Optional[date] = None,
    is_active: Optional[bool] = None,
    coach_ids: Optional[List[int]] = None
) -> Batch:
    """
    Update a batch's details.
    
    Args:
        db: Database session
        batch_id: Batch ID
        name: Optional new name
        center_id: Optional new center ID
        min_age: Optional new minimum age
        max_age: Optional new maximum age
        max_capacity: Optional new max capacity
        is_mon through is_sun: Optional schedule flags
        start_time: Optional start time (HH:MM:SS format)
        end_time: Optional end time (HH:MM:SS format)
        start_date: Optional start date
        is_active: Optional active status
        coach_ids: Optional list of coach IDs (replaces existing assignments)
        
    Returns:
        Updated Batch
        
    Raises:
        ValueError: If batch not found, center not found, or invalid values
    """
    batch = db.get(Batch, batch_id)
    if not batch:
        raise ValueError(f"Batch {batch_id} not found")
    
    # Update fields if provided
    if name is not None:
        batch.name = name
    if center_id is not None:
        center = db.get(Center, center_id)
        if not center:
            raise ValueError(f"Center {center_id} not found")
        batch.center_id = center_id
    if min_age is not None and max_age is not None and max_age < min_age:
        raise ValueError("max_age must be >= min_age")
    if min_age is not None:
        batch.min_age = min_age
    if max_age is not None:
        batch.max_age = max_age
    if max_capacity is not None:
        batch.max_capacity = max_capacity
    if is_mon is not None:
        batch.is_mon = is_mon
    if is_tue is not None:
        batch.is_tue = is_tue
    if is_wed is not None:
        batch.is_wed = is_wed
    if is_thu is not None:
        batch.is_thu = is_thu
    if is_fri is not None:
        batch.is_fri = is_fri
    if is_sat is not None:
        batch.is_sat = is_sat
    if is_sun is not None:
        batch.is_sun = is_sun
    
    # Parse and update time fields if provided
    from datetime import time as dt_time
    if start_time is not None:
        if start_time == "" or start_time is None:
            batch.start_time = None
        else:
            try:
                time_parts = start_time.split(':')
                batch.start_time = dt_time(int(time_parts[0]), int(time_parts[1]), int(time_parts[2]) if len(time_parts) > 2 else 0)
            except (ValueError, IndexError):
                raise ValueError(f"Invalid start_time format: {start_time}")
    
    if end_time is not None:
        if end_time == "" or end_time is None:
            batch.end_time = None
        else:
            try:
                time_parts = end_time.split(':')
                batch.end_time = dt_time(int(time_parts[0]), int(time_parts[1]), int(time_parts[2]) if len(time_parts) > 2 else 0)
            except (ValueError, IndexError):
                raise ValueError(f"Invalid end_time format: {end_time}")
    
    # Update date field if provided
    if start_date is not None:
        batch.start_date = start_date
    
    # Update is_active if provided
    if is_active is not None:
        batch.is_active = is_active
    
    # Update coach assignments if provided
    if coach_ids is not None:
        # Validate all users exist and are coaches
        for user_id in coach_ids:
            user = db.get(User, user_id)
            if not user:
                raise ValueError(f"User {user_id} not found")
            if user.role != "coach":
                raise ValueError(f"User {user_id} is not a coach (role: {user.role})")
        
        # Replace existing assignments
        assign_coaches_to_batch(db, batch_id, coach_ids)
    
    db.add(batch)
    db.commit()
    db.refresh(batch)
    
    return batch


def delete_batch(
    db: Session,
    batch_id: int
) -> bool:
    """
    Delete a batch and all its coach assignments.
    Clears foreign key references from leads before deletion.
    
    Args:
        db: Database session
        batch_id: Batch ID
        
    Returns:
        True if deleted successfully
        
    Raises:
        ValueError: If batch not found
    """
    batch = db.get(Batch, batch_id)
    if not batch:
        raise ValueError(f"Batch {batch_id} not found")
    
    # Clear preferred_batch_id references
    leads_with_preferred = db.exec(
        select(Lead).where(Lead.preferred_batch_id == batch_id)
    ).all()
    for lead in leads_with_preferred:
        lead.preferred_batch_id = None
        db.add(lead)
    
    # Clear trial_batch_id references
    leads_with_trial = db.exec(
        select(Lead).where(Lead.trial_batch_id == batch_id)
    ).all()
    for lead in leads_with_trial:
        lead.trial_batch_id = None
        db.add(lead)
    
    # Delete student batch link entries
    student_batch_links = db.exec(
        select(StudentBatchLink).where(StudentBatchLink.batch_id == batch_id)
    ).all()
    for link in student_batch_links:
        db.delete(link)
    
    # Delete all coach assignments
    existing_assignments = db.exec(
        select(BatchCoachLink).where(BatchCoachLink.batch_id == batch_id)
    ).all()
    for assignment in existing_assignments:
        db.delete(assignment)
    
    # Delete the batch
    db.delete(batch)
    db.commit()
    
    return True


def check_batch_capacity_for_date(
    db: Session,
    batch_id: int,
    target_date: date
) -> Tuple[bool, int, int]:
    """
    Check if a batch has reached capacity for a specific date.
    Counts leads with trial_batch_id or permanent_batch_id matching the batch.
    
    Args:
        db: Database session
        batch_id: Batch ID
        target_date: Date to check capacity for
        
    Returns:
        Tuple of (is_full: bool, current_count: int, max_capacity: int)
    """
    batch = db.get(Batch, batch_id)
    if not batch:
        raise ValueError(f"Batch {batch_id} not found")
    
    # Count leads assigned to this batch (trial or permanent)
    from sqlalchemy import or_
    count = db.exec(
        select(func.count(Lead.id)).where(
            or_(
                Lead.trial_batch_id == batch_id,
                Lead.permanent_batch_id == batch_id
            )
        )
    ).one()
    
    is_full = count >= batch.max_capacity
    return is_full, count, batch.max_capacity

