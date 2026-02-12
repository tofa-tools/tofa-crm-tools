"""
Student management business logic.
Handles conversion from Lead to Student and student operations.
"""
from sqlmodel import Session, select
from typing import List, Optional, Dict, Any
from datetime import datetime, date
from backend.models import Student, Lead, StudentBatchLink, Batch
from backend.core.audit import log_lead_activity


def convert_lead_to_student(
    db: Session,
    lead_id: int,
    student_data: Dict[str, Any],
    user_id: Optional[int] = None
) -> Student:
    """
    Convert a Lead to a Student (graduate from prospect to active member).
    
    This function runs inside a transaction and:
    1. Creates a Student record with subscription and batch data
    2. Updates Lead.status to 'Joined'
    3. Creates an Audit Log entry
    
    Args:
        db: Database session
        lead_id: ID of the lead to convert
        student_data: Dictionary containing:
            - subscription_plan: str
            - subscription_start_date: date
            - subscription_end_date: Optional[date]
            - payment_proof_url: Optional[str]
            - student_batch_ids: List[int] (batch IDs to assign)
        user_id: Optional user ID for audit logging
        
    Returns:
        Created Student object
        
    Raises:
        ValueError: If lead not found, lead already converted, or validation fails
    """
    # Start transaction (SQLModel/SQLAlchemy handles this via session)
    
    # Get the lead
    lead = db.get(Lead, lead_id)
    if not lead:
        raise ValueError("Lead not found")
    
    # Check if lead already has a student record (may be deactivated)
    existing_student = db.exec(
        select(Student).where(Student.lead_id == lead_id)
    ).first()
    
    if existing_student:
        # RE-ACTIVATION: If student record exists but is inactive, re-activate it instead of creating new
        if not existing_student.is_active:
            # Re-activate existing student record and update subscription data
            existing_student.is_active = True
            existing_student.subscription_plan = student_data['subscription_plan']
            existing_student.subscription_start_date = student_data['subscription_start_date']
            existing_student.subscription_end_date = student_data.get('subscription_end_date')
            if student_data.get('payment_proof_url'):
                existing_student.payment_proof_url = student_data.get('payment_proof_url')
            
            # Reset renewal intent and grace period flags
            existing_student.renewal_intent = False
            existing_student.in_grace_period = False
            existing_student.grace_nudge_count = 0
            
            db.add(existing_student)
            db.flush()
            
            # Update batch assignments
            student_batch_ids = student_data.get('student_batch_ids', [])
            if student_batch_ids:
                # Remove old batch assignments
                old_links = db.exec(
                    select(StudentBatchLink).where(StudentBatchLink.student_id == existing_student.id)
                ).all()
                for link in old_links:
                    db.delete(link)
                
                # Add new batch assignments
                for batch_id in student_batch_ids:
                    batch = db.get(Batch, batch_id)
                    if not batch:
                        db.rollback()
                        raise ValueError(f"Batch {batch_id} not found")
                    
                    # Check capacity
                    from backend.core.batches import check_batch_capacity_for_date
                    is_full, current_count, max_capacity = check_batch_capacity_for_date(
                        db, batch_id, date.today()
                    )
                    if is_full:
                        db.rollback()
                        raise ValueError(f"CAPACITY_REACHED: Batch {batch.name} is full.")
                    
                    link = StudentBatchLink(
                        student_id=existing_student.id,
                        batch_id=batch_id
                    )
                    db.add(link)
            
            # Update lead status to 'Joined'
            old_status = lead.status
            lead.status = 'Joined'
            
            # Commit re-activation
            db.commit()
            db.refresh(existing_student)
            
            # Log the re-activation
            if user_id:
                from backend.core.audit import log_status_change, log_lead_activity
                log_status_change(
                    db,
                    lead_id=lead_id,
                    user_id=user_id,
                    old_status=old_status,
                    new_status='Joined'
                )
                log_lead_activity(
                    db,
                    lead_id=lead_id,
                    user_id=user_id,
                    action_type='student_reactivated',
                    description='Student record re-activated (preserved history from previous enrollment).',
                    old_value='Inactive',
                    new_value='Active'
                )
            
            return existing_student
        else:
            # Student record already exists and is active
            raise ValueError("Lead has already been converted to an active Student")
    
    # Validate required fields
    if not student_data.get('subscription_plan'):
        raise ValueError("subscription_plan is required")
    if not student_data.get('subscription_start_date'):
        raise ValueError("subscription_start_date is required")
    if not student_data.get('center_id'):
        raise ValueError("center_id is required (use lead.center_id)")
    
    # Get center_id from lead if not provided
    center_id = student_data.get('center_id') or lead.center_id
    if not center_id:
        raise ValueError("Lead must have a center_id")
    
    # Create Student record
    new_student = Student(
        lead_id=lead_id,
        center_id=center_id,
        subscription_plan=student_data['subscription_plan'],
        subscription_start_date=student_data['subscription_start_date'],
        subscription_end_date=student_data.get('subscription_end_date'),
        payment_proof_url=student_data.get('payment_proof_url'),
        utr_number=student_data.get('utr_number'),
        is_payment_verified=student_data.get('is_payment_verified', False),
        kit_size=student_data.get('kit_size'),
        medical_info=student_data.get('medical_info'),
        secondary_contact=student_data.get('secondary_contact'),
        is_active=True
    )
    db.add(new_student)
    db.flush()  # Flush to get the student ID
    
    # Assign batches if provided
    student_batch_ids = student_data.get('student_batch_ids', [])
    if student_batch_ids:
        for batch_id in student_batch_ids:
            # Verify batch exists
            batch = db.get(Batch, batch_id)
            if not batch:
                db.rollback()
                raise ValueError(f"Batch {batch_id} not found")
            
            # Check capacity
            from backend.core.batches import check_batch_capacity_for_date
            is_full, current_count, max_capacity = check_batch_capacity_for_date(
                db, batch_id, date.today()
            )
            if is_full:
                db.rollback()
                raise ValueError(f"CAPACITY_REACHED: Batch {batch.name} is full.")
            
            # Create StudentBatchLink
            link = StudentBatchLink(
                student_id=new_student.id,
                batch_id=batch_id
            )
            db.add(link)
    
    # Update lead status to 'Joined'
    old_status = lead.status
    lead.status = 'Joined'
    
    # Create audit log entry (log_lead_activity commits internally, so we need to handle this carefully)
    if user_id:
        # Use log_status_change which is more appropriate
        from backend.core.audit import log_status_change
        # Note: log_status_change commits, so we'll do this after our transaction
        pass  # We'll log after commit to avoid double commit
    
    # Commit transaction (student creation, batch links, status update)
    db.commit()
    db.refresh(new_student)
    
    # Now log the status change (separate transaction)
    if user_id:
        from backend.core.audit import log_status_change
        log_status_change(
            db,
            lead_id=lead_id,
            user_id=user_id,
            old_status=old_status,
            new_status='Joined'
        )
        # Also add a comment-style log entry
        from backend.core.audit import log_lead_activity
        log_lead_activity(
            db,
            lead_id=lead_id,
            user_id=user_id,
            action_type='status_change',
            description='Lead graduated to Active Student status.',
            old_value=old_status,
            new_value='Joined'
        )
    
    # Refresh again after audit log
    db.refresh(new_student)
    db.refresh(new_student)
    
    return new_student


def get_student_by_lead_id(db: Session, lead_id: int) -> Optional[Student]:
    """Get a student by their associated lead ID."""
    return db.exec(
        select(Student).where(Student.lead_id == lead_id)
    ).first()


def get_all_students(
    db: Session,
    center_id: Optional[int] = None,
    center_ids: Optional[List[int]] = None,
    is_active: Optional[bool] = None
) -> List[Student]:
    """Get all students, optionally filtered by center(s) and active status."""
    from sqlalchemy.orm import selectinload
    
    query = select(Student)
    
    if center_ids:
        query = query.where(Student.center_id.in_(center_ids))
    elif center_id is not None:
        query = query.where(Student.center_id == center_id)
    
    if is_active is not None:
        query = query.where(Student.is_active == is_active)
    
    # Eagerly load relationships
    query = query.options(
        selectinload(Student.lead),
        selectinload(Student.batches)
    )
    
    return list(db.exec(query).all())


def update_student(
    db: Session,
    student_id: int,
    user_id: int,
    user_role: str,
    center_id: Optional[int] = None,
    subscription_plan: Optional[str] = None,
    subscription_start_date: Optional[date] = None,
    subscription_end_date: Optional[date] = None,
    payment_proof_url: Optional[str] = None,
    student_batch_ids: Optional[List[int]] = None,
    is_active: Optional[bool] = None
) -> Student:
    """
    Update a student record with strict governance for center transfers.
    
    Args:
        db: Database session
        student_id: ID of the student to update
        user_id: ID of the user performing the update (for audit logging)
        user_role: Role of the user ('team_lead', 'team_member', 'coach', 'observer')
        center_id: New center ID (if changing)
        subscription_plan: Subscription plan
        subscription_start_date: Subscription start date
        subscription_end_date: Subscription end date
        payment_proof_url: Payment proof URL
        student_batch_ids: List of batch IDs to assign
        is_active: Active status
        
    Returns:
        Updated Student object
        
    Raises:
        ValueError: If center transfer attempted by non-team-lead
        HTTPException: If student not found or unauthorized
    """
    from backend.models import Center
    from fastapi import HTTPException
    
    # Get student
    student = db.get(Student, student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    
    # Track center transfer
    old_center_id = student.center_id
    is_center_transfer = center_id is not None and center_id != old_center_id
    
    # STRICT GOVERNANCE: Only team leads can transfer students between centers
    if is_center_transfer:
        if user_role != 'team_lead':
            raise HTTPException(
                status_code=403,
                detail='Only Team Leads can transfer students between centers'
            )
        
        # Verify new center exists
        new_center = db.get(Center, center_id)
        if not new_center:
            raise HTTPException(status_code=404, detail=f"Center {center_id} not found")
        
        # CASCADING ACTION: Remove all existing batch assignments (old batches won't exist in new center)
        existing_batch_links = db.exec(
            select(StudentBatchLink).where(StudentBatchLink.student_id == student_id)
        ).all()
        for link in existing_batch_links:
            db.delete(link)
        db.flush()
        
        # Update center
        student.center_id = center_id
        
        # Log center transfer
        old_center = db.get(Center, old_center_id)
        old_center_name = old_center.display_name if old_center else f"Center {old_center_id}"
        new_center_name = new_center.display_name
        
        # Get user name for audit log
        from backend.models import User
        user = db.get(User, user_id)
        user_name = user.full_name if user else 'Unknown'
        
        log_lead_activity(
            db=db,
            lead_id=student.lead_id,
            user_id=user_id,
            action_type='center_transfer',
            description=f'Student transferred from {old_center_name} to {new_center_name} by {user_name}',
            old_value=f'Center: {old_center_name} (ID: {old_center_id})',
            new_value=f'Center: {new_center_name} (ID: {center_id})'
        )
    
    # Update subscription fields
    if subscription_plan is not None:
        student.subscription_plan = subscription_plan
    
    if subscription_start_date is not None:
        student.subscription_start_date = subscription_start_date
    
    if subscription_end_date is not None:
        student.subscription_end_date = subscription_end_date
    
    if payment_proof_url is not None:
        student.payment_proof_url = payment_proof_url
    
    if is_active is not None:
        student.is_active = is_active
    
    # Update batch assignments (only if provided and not a center transfer with no new batches)
    if student_batch_ids is not None:
        # Clear existing batch links (unless we already did during center transfer)
        if not is_center_transfer:
            existing_links = db.exec(
                select(StudentBatchLink).where(StudentBatchLink.student_id == student_id)
            ).all()
            for link in existing_links:
                db.delete(link)
        
        # Add new batch links
        from backend.core.batches import check_batch_capacity_for_date
        from datetime import date as date_type
        
        for batch_id in student_batch_ids:
            batch = db.get(Batch, batch_id)
            if not batch:
                raise ValueError(f"Batch {batch_id} not found")
            
            # Verify batch belongs to the student's center
            if batch.center_id != student.center_id:
                raise ValueError(f"Batch {batch_id} does not belong to center {student.center_id}")
            
            # Check capacity
            is_full, current_count, max_capacity = check_batch_capacity_for_date(
                db, batch_id, date_type.today()
            )
            if is_full:
                raise ValueError(f"CAPACITY_REACHED: Batch {batch.name} is full.")
            
            link = StudentBatchLink(
                student_id=student_id,
                batch_id=batch_id
            )
            db.add(link)
    
    db.add(student)
    db.commit()
    db.refresh(student)
    
    return student

