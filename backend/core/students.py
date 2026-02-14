"""
Student management business logic.
Handles conversion from Lead to Student and student operations.
"""
from sqlmodel import Session, select
from sqlalchemy.orm import selectinload
from sqlalchemy import and_
from typing import List, Optional, Dict, Any
from datetime import datetime, date, timedelta
from backend.models import Student, Lead, StudentBatchLink, Batch
from backend.core.audit import log_lead_activity


def get_student_by_public_token(db: Session, public_token: str) -> Optional[Student]:
    """
    Get student by lead's public_token. Used for public renewal pages.

    Args:
        db: Database session
        public_token: Lead's public_token

    Returns:
        Student with lead and batches loaded, or None if not found
    """
    lead = db.exec(
        select(Lead).where(Lead.public_token == public_token)
    ).first()
    if not lead:
        return None

    student = db.exec(
        select(Student)
        .where(Student.lead_id == lead.id)
        .options(selectinload(Student.lead), selectinload(Student.batches))
    ).first()
    return student


def verify_student_payment(
    db: Session,
    student_id: int,
    user_id: int,
) -> Student:
    """
    Mark student payment as verified. Sets is_payment_verified=True, is_active=True,
    clears renewal/grace flags. Creates audit log.

    Args:
        db: Database session
        student_id: ID of the student
        user_id: ID of the user performing verification (for audit)

    Returns:
        Updated Student object

    Raises:
        ValueError: If student not found
    """
    student = db.get(Student, student_id)
    if not student:
        raise ValueError("Student not found")

    student.is_payment_verified = True
    student.renewal_intent = False
    student.in_grace_period = False
    student.grace_nudge_count = 0
    student.is_active = True
    db.add(student)
    db.commit()
    db.refresh(student)

    log_lead_activity(
        db,
        student.lead_id,
        user_id,
        action_type="payment_verified",
        description="Payment verified by Team Lead.",
        new_value="verified",
    )
    return student


def submit_renewal_confirmation(
    db: Session,
    public_token: str,
    payload: Dict[str, Any],
) -> None:
    """
    Process renewal confirmation from public portal. Validates UTR/screenshot,
    updates student record, sets renewal_intent=True, is_payment_verified=False.
    Creates audit log.

    Payload keys: subscription_plan, subscription_start_date, utr_number (optional),
    payment_proof_url (optional), kit_size (optional), medical_info (optional),
    secondary_contact (optional).

    Args:
        db: Database session
        public_token: Lead's public_token
        payload: Dict with renewal form data

    Raises:
        ValueError: If token invalid, student not found, or validation fails
    """
    lead = db.exec(
        select(Lead).where(Lead.public_token == public_token)
    ).first()
    if not lead:
        raise ValueError("Invalid renewal link")

    student = db.exec(
        select(Student).where(
            and_(Student.lead_id == lead.id, Student.is_active == True)
        )
    ).first()
    if not student:
        raise ValueError("Student not found for this link")

    # Validate UTR or payment screenshot
    utr = (payload.get("utr_number") or "").strip().replace(" ", "")
    has_utr = len(utr) == 12 and utr.isdigit()
    has_screenshot = bool(payload.get("payment_proof_url") and str(payload.get("payment_proof_url")).strip())

    if not has_utr and not has_screenshot:
        raise ValueError("Provide at least one: UTR (12 digits) or payment screenshot")
    if utr and (len(utr) != 12 or not utr.isdigit()):
        raise ValueError("UTR must be exactly 12 digits")

    # Parse start date
    start_date_str = payload.get("subscription_start_date")
    if not start_date_str:
        raise ValueError("subscription_start_date is required")
    try:
        start_date = date.fromisoformat(start_date_str)
    except ValueError:
        raise ValueError("Invalid start_date (use YYYY-MM-DD)")

    months_map = {"Monthly": 1, "Quarterly": 3, "3 Months": 3, "6 Months": 6, "Yearly": 12}
    months = months_map.get(payload.get("subscription_plan", "Monthly"), 1)
    end_date = start_date + timedelta(days=months * 31)

    # Update student
    student.subscription_plan = payload.get("subscription_plan", "Monthly")
    student.subscription_start_date = start_date
    student.subscription_end_date = end_date
    student.utr_number = utr if has_utr else (student.utr_number or None)
    student.payment_proof_url = (
        str(payload.get("payment_proof_url")).strip()
        if has_screenshot and payload.get("payment_proof_url")
        else None
    )
    student.is_payment_verified = False
    student.renewal_intent = True

    kit_size = payload.get("kit_size")
    if kit_size is not None:
        student.kit_size = kit_size or None
    medical_info = payload.get("medical_info")
    if medical_info is not None:
        student.medical_info = medical_info or None
    secondary_contact = payload.get("secondary_contact")
    if secondary_contact is not None:
        student.secondary_contact = secondary_contact or None

    db.add(student)
    db.commit()
    db.refresh(student)

    log_lead_activity(
        db,
        lead.id,
        None,
        action_type="renewal_submitted",
        description="Parent submitted renewal transaction via public portal. Pending verification.",
    )


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
    
    # Reset renewal flags when subscription is renewed
    if subscription_plan is not None or subscription_start_date is not None or subscription_end_date is not None:
        student.renewal_intent = False
        student.in_grace_period = False
        student.grace_nudge_count = 0
    
    db.add(student)
    db.commit()
    db.refresh(student)
    
    return student


def get_student_with_relations(db: Session, student_id: int) -> Optional[Student]:
    """Get student by ID with lead and batches loaded."""
    stmt = select(Student).where(Student.id == student_id).options(
        selectinload(Student.lead),
        selectinload(Student.batches),
    )
    return db.exec(stmt).first()


def get_payment_unverified_students(db: Session) -> List[Dict[str, Any]]:
    """Get students with UTR but payment not yet verified (for financial audit)."""
    from sqlalchemy.orm import selectinload
    from sqlalchemy import and_
    stmt = (
        select(Student)
        .where(
            and_(
                Student.utr_number.isnot(None),
                Student.utr_number != "",
                Student.is_payment_verified == False,
            )
        )
        .options(selectinload(Student.lead))
    )
    students = list(db.exec(stmt).all())
    return [
        {
            "id": s.id,
            "lead_id": s.lead_id,
            "player_name": s.lead.player_name if s.lead else "—",
            "utr_number": s.utr_number,
            "payment_proof_url": s.payment_proof_url,
            "date": s.created_at.isoformat() if s.created_at else None,
        }
        for s in students
    ]


def update_renewal_intent_by_token(db: Session, public_token: str) -> Dict[str, Any]:
    """Set renewal_intent=True for student by lead's public_token. Returns dict with success info."""
    lead = db.exec(select(Lead).where(Lead.public_token == public_token)).first()
    if not lead:
        raise ValueError("Invalid renewal link")
    student = db.exec(
        select(Student).where(Student.lead_id == lead.id).options(selectinload(Student.lead))
    ).first()
    if not student:
        raise ValueError("Student not found for this link")
    student.renewal_intent = True
    db.add(student)
    db.commit()
    db.refresh(student)
    return {
        "success": True,
        "message": "Renewal intent recorded. Our team will follow up for payment.",
        "student_id": student.id,
        "player_name": lead.player_name if lead else None,
    }


def send_grace_nudge(db: Session, student_id: int, user_id: int) -> Dict[str, Any]:
    """Increment grace_nudge_count for a student in grace period. Returns dict with new count."""
    from backend.models import AuditLog

    student = db.get(Student, student_id)
    if not student:
        raise ValueError("Student not found")
    if not student.in_grace_period:
        raise ValueError("Student is not in grace period")
    if student.grace_nudge_count >= 2:
        raise ValueError("Maximum grace nudges (2) already sent")
    old_count = student.grace_nudge_count
    student.grace_nudge_count = old_count + 1
    if student.lead:
        audit_log = AuditLog(
            lead_id=student.lead_id,
            user_id=user_id,
            action_type="grace_nudge_sent",
            description=f"Grace period nudge sent (grace_nudge_count: {old_count} → {student.grace_nudge_count})",
            old_value=str(old_count),
            new_value=str(student.grace_nudge_count),
            timestamp=datetime.utcnow(),
        )
        db.add(audit_log)
    db.add(student)
    db.commit()
    db.refresh(student)
    return {"message": "Grace nudge sent successfully", "grace_nudge_count": student.grace_nudge_count}


def can_user_view_student_milestones(db: Session, student_id: int, user_id: int, user_role: str, user_center_ids: List[int]) -> bool:
    """Check if user can view milestones for this student. Coaches: must have student in batch; others: center match."""
    from backend.models import BatchCoachLink, StudentBatchLink

    student = db.get(Student, student_id)
    if not student:
        return False
    if user_role == "coach":
        coach_batch_ids = list(db.exec(select(BatchCoachLink.batch_id).where(BatchCoachLink.user_id == user_id)).all())
        if not coach_batch_ids:
            return False
        links = db.exec(
            select(StudentBatchLink.batch_id).where(
                StudentBatchLink.student_id == student_id,
                StudentBatchLink.batch_id.in_(coach_batch_ids),
            )
        ).all()
        return len(list(links)) > 0
    if user_role == "team_lead":
        return True
    return student.center_id in user_center_ids

