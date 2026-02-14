"""
Lead management business logic.
Framework-agnostic lead CRUD operations.
"""
import logging
from sqlmodel import Session, select, func
from typing import List, Optional, Tuple
from datetime import datetime, date
from backend.models import Lead, Center, Comment, User, BatchCoachLink, Batch, StudentBatchLink, Student
from sqlalchemy import or_
import pandas as pd
import uuid

logger = logging.getLogger(__name__)


def get_leads_for_user(
    db: Session, 
    user: User,
    limit: Optional[int] = None,
    offset: int = 0,
    status_filter: Optional[str] = None,
    search: Optional[str] = None,
    sort_by: str = "created_time",  # "created_time" or "freshness"
    next_follow_up_date_filter: Optional[str] = None,  # Filter by follow-up date (YYYY-MM-DD)
    at_risk_filter: Optional[bool] = None,  # Filter for at-risk leads (10 days inactive)
    overdue_filter: Optional[bool] = None,  # Filter for overdue leads (next_followup_date < today)
    loss_reason_filter: Optional[str] = None,  # Filter by loss_reason
    nudge_failures_filter: Optional[bool] = None,  # Filter for preference link not clicked within 48h (needs_escalation)
) -> Tuple[List[Lead], int]:
    """
    Get leads for a user based on their role with pagination support.
    Team leads see all leads, others see leads from their assigned centers.
    
    Args:
        db: Database session
        user: User object
        limit: Maximum number of leads to return (None = all)
        offset: Number of leads to skip
        status_filter: Optional status filter
        search: Optional search term (searches player_name)
        
    Returns:
        Tuple of (list of leads, total count)
    """
    # Build base query based on user role
    if user.role == "team_lead":
        # Team leads see all leads
        query = select(Lead)
        count_query = select(func.count()).select_from(Lead)
    elif user.role == "coach":
        # Coaches only see leads in their assigned batches
        # Get batch IDs assigned to this coach
        batch_assignments = db.exec(
            select(BatchCoachLink.batch_id).where(BatchCoachLink.user_id == user.id)
        ).all()
        batch_ids = list(batch_assignments)
        
        if not batch_ids:
            return [], 0
        
        # Filter leads where trial_batch_id or permanent_batch_id matches coach's batches
        query = select(Lead).where(
            or_(
                Lead.trial_batch_id.in_(batch_ids),
                Lead.permanent_batch_id.in_(batch_ids)
            )
        )
        count_query = select(func.count()).select_from(Lead).where(
            or_(
                Lead.trial_batch_id.in_(batch_ids),
                Lead.permanent_batch_id.in_(batch_ids)
            )
        )
    else:
        # Regular users see leads from their assigned centers
        center_ids = [c.id for c in user.centers]
        if not center_ids:
            return [], 0
        query = select(Lead).where(Lead.center_id.in_(center_ids))
        count_query = select(func.count()).select_from(Lead).where(Lead.center_id.in_(center_ids))
    
    # Apply filters
    if status_filter:
        query = query.where(Lead.status == status_filter)
        count_query = count_query.where(Lead.status == status_filter)
    
    if loss_reason_filter:
        query = query.where(Lead.loss_reason == loss_reason_filter)
        count_query = count_query.where(Lead.loss_reason == loss_reason_filter)
    
    if search:
        search_pattern = f"%{search}%"
        query = query.where(Lead.player_name.ilike(search_pattern))
        count_query = count_query.where(Lead.player_name.ilike(search_pattern))
    
    # Filter by next_follow_up_date (exact date match)
    if next_follow_up_date_filter:
        try:
            filter_date = datetime.fromisoformat(next_follow_up_date_filter).date()
            date_start = datetime.combine(filter_date, datetime.min.time())
            date_end = datetime.combine(filter_date, datetime.max.time())
            query = query.where(
                Lead.next_followup_date.isnot(None),
                Lead.next_followup_date >= date_start,
                Lead.next_followup_date <= date_end
            )
            count_query = count_query.where(
                Lead.next_followup_date.isnot(None),
                Lead.next_followup_date >= date_start,
                Lead.next_followup_date <= date_end
            )
        except (ValueError, AttributeError):
            pass  # Invalid date format, skip filter
    
    # Filter for at-risk leads (10 days inactive)
    if at_risk_filter:
        from datetime import timedelta
        from sqlalchemy import and_
        ten_days_ago = datetime.utcnow() - timedelta(days=10)
        # At-risk: status is 'Joined' or 'Trial Scheduled' AND (last_updated is None and created_time old, OR last_updated is old)
        at_risk_condition = and_(
            Lead.status.in_(["Joined", "Trial Scheduled"]),
            (
                (Lead.last_updated.is_(None) & (Lead.created_time <= ten_days_ago)) |
                (Lead.last_updated.isnot(None) & (Lead.last_updated <= ten_days_ago))
            )
        )
        query = query.where(at_risk_condition)
        count_query = count_query.where(at_risk_condition)

    # Filter for overdue leads (next_followup_date < today, exclude Joined/Dead/Nurture)
    if overdue_filter:
        today_start = datetime.combine(date.today(), datetime.min.time())
        query = query.where(
            Lead.next_followup_date.isnot(None),
            Lead.next_followup_date < today_start,
            Lead.status.notin_(["Joined", "Dead/Not Interested", "Nurture"])
        )
        count_query = count_query.where(
            Lead.next_followup_date.isnot(None),
            Lead.next_followup_date < today_start,
            Lead.status.notin_(["Joined", "Dead/Not Interested", "Nurture"])
        )

    # Filter for nudge failures (preference link not clicked within 48h)
    if nudge_failures_filter:
        query = query.where(
            Lead.status == "Followed up with message",
            Lead.preferences_submitted == False,
            Lead.needs_escalation == True,
        )
        count_query = count_query.where(
            Lead.status == "Followed up with message",
            Lead.preferences_submitted == False,
            Lead.needs_escalation == True,
        )
    
    # Get total count
    total = db.exec(count_query).one()
    
    # Apply ordering based on sort_by parameter
    # Supported values: "created_time" or "freshness"
    if sort_by == "freshness":
        # Sort by freshness: oldest last_updated first (rotting leads at top), then by created_time
        # NULLS LAST ensures leads without last_updated go to the bottom
        # Use SQLAlchemy's nullslast() to handle NULL values
        from sqlalchemy import nullslast
        # Order by last_updated ascending (oldest first = most rotten), NULLS LAST
        # Then by created_time descending as secondary sort
        # Lead.last_updated.asc() returns an UnaryExpression which can be wrapped by nullslast()
        query = query.order_by(nullslast(Lead.last_updated.asc()), Lead.created_time.desc())
    else:
        # Default: Sort by created_time (newest first)
        query = query.order_by(Lead.created_time.desc())
    
    # Apply pagination
    if limit is not None:
        query = query.limit(limit).offset(offset)
    
    # Note: student_batches relationship moved to Student model
    # No need to eager load it for Lead queries
    
    leads = list(db.exec(query).all())
    return leads, total


def get_lead_by_id(db: Session, lead_id: int) -> Optional[Lead]:
    """Get a lead by ID with relationships loaded."""
    from sqlmodel import select
    
    # Note: student_batches relationship moved to Student model
    # If needed, load Student relationship separately via lead.student.batches
    stmt = select(Lead).where(Lead.id == lead_id)
    result = db.exec(stmt).first()
    return result


def update_lead(
    db: Session,
    lead_id: int,
    status: str,
    next_date: Optional[str] = None,
    comment: Optional[str] = None,
    user_id: Optional[int] = None,
    date_of_birth: Optional[date] = None,
    trial_batch_id: Optional[int] = None,  # New parameter for batch assignment
    permanent_batch_id: Optional[int] = None,  # New parameter for batch assignment
    student_batch_ids: Optional[List[int]] = None,  # Multi-batch assignment for joined students
    payment_proof_url: Optional[str] = None,  # URL to payment proof image
    call_confirmation_note: Optional[str] = None,  # Note confirming call with parent
    loss_reason: Optional[str] = None,  # Reason for loss (off-ramp: Nurture/Dead)
    loss_reason_notes: Optional[str] = None,  # Details when reason is 'Other'
) -> Lead:
    """
    Update a lead's status and optionally add a comment.
    Automatically logs all changes to the audit log.
    
    Args:
        db: Database session
        lead_id: Lead ID
        status: New status
        next_date: Next follow-up date (ISO format string)
        comment: Optional comment text
        user_id: User ID for the comment (if comment is provided)
        date_of_birth: Optional new date of birth
        
    Returns:
        Updated Lead object
        
    Raises:
        ValueError: If lead not found
    """
    from backend.core.audit import log_status_change, log_comment_added, log_field_update
    
    lead = get_lead_by_id(db, lead_id)
    if not lead:
        raise ValueError("Lead not found")
    
    # Track old values for audit log
    old_status = lead.status
    old_next_date = lead.next_followup_date.isoformat() if lead.next_followup_date else None
    
    # Validate Joined status requires batch assignment BEFORE status change
    if status == "Joined":
        # Check if student_batch_ids is being provided (new multi-batch assignment)
        if student_batch_ids is not None and len(student_batch_ids) > 0:
            # Using new multi-batch assignment, validation passed
            pass
        # Check if permanent_batch_id is being set in this update OR already exists
        elif permanent_batch_id is not None and permanent_batch_id != 0:
            # Using old single batch assignment, validation passed
            pass
        # Check if lead already has a permanent_batch_id
        elif lead.permanent_batch_id:
            # Already has permanent batch, validation passed
            pass
        # Check if lead already has student_batch_ids (via StudentBatchLink)
        else:
            existing_student_links = db.exec(
                select(StudentBatchLink).where(StudentBatchLink.lead_id == lead_id)
            ).all()
            if not existing_student_links:
                # No batch assignment found, raise error
                raise ValueError("BATCH_REQUIRED: A permanent batch must be assigned before setting status to 'Joined'.")
    
    # Validate Trial Scheduled status requires trial_batch_id
    if status == "Trial Scheduled":
        # Check if trial_batch_id is being set in this update OR already exists
        if trial_batch_id is None or trial_batch_id == 0:
            # Not setting it now, check if it already exists
            if not lead.trial_batch_id:
                raise ValueError("TRIAL_BATCH_REQUIRED: A trial batch must be assigned when status is 'Trial Scheduled'.")
    
    # Update status
    if lead.status != status:
        # Record lifecycle stage when moving to Dead or Nurture (for loss drill-down)
        if status in ("Dead/Not Interested", "Nurture"):
            lead.status_at_loss = lead.status
        lead.status = status
        # Auto-set do_not_contact for Dead/Not Interested status
        if status == "Dead/Not Interested":
            lead.do_not_contact = True
            # Auto-clear next_followup_date for Dead status (unless specific date provided)
            if next_date is None and lead.next_followup_date:
                old_date_str = lead.next_followup_date.isoformat()
                lead.next_followup_date = None
                if user_id:
                    log_field_update(
                        db, lead_id, user_id,
                        'next_followup_date',
                        old_date_str,
                        None
                    )
        elif status == "Nurture":
            # Auto-clear next_followup_date for Nurture status (unless specific date provided)
            if next_date is None and lead.next_followup_date:
                old_date_str = lead.next_followup_date.isoformat()
                lead.next_followup_date = None
                if user_id:
                    log_field_update(
                        db, lead_id, user_id,
                        'next_followup_date',
                        old_date_str,
                        None
                    )
        elif status == "On Break":
            # Auto-clear next_followup_date for On Break status (unless specific date provided)
            if next_date is None and lead.next_followup_date:
                old_date_str = lead.next_followup_date.isoformat()
                lead.next_followup_date = None
                if user_id:
                    log_field_update(
                        db, lead_id, user_id,
                        'next_followup_date',
                        old_date_str,
                        None
                    )
        elif old_status == "Dead/Not Interested" and status != "Dead/Not Interested":
            # Reset do_not_contact if moving away from Dead status
            lead.do_not_contact = False
        
        # Record when preference link was sent (for 48h nudge-failure escalation)
        if status == "Followed up with message":
            if not lead.extra_data:
                lead.extra_data = {}
            sent_at = datetime.utcnow().isoformat()
            if "preference_link_sent_at" not in lead.extra_data:
                lead.extra_data["preference_link_sent_at"] = sent_at

        # Record timestamp when status is set to 'Joined'
        if status == "Joined":
            # Store joined timestamp in extra_data
            if not lead.extra_data:
                lead.extra_data = {}
            if 'joined_at' not in lead.extra_data:
                joined_timestamp = datetime.utcnow().isoformat()
                lead.extra_data['joined_at'] = joined_timestamp
                if user_id:
                    log_field_update(
                        db, lead_id, user_id,
                        'joined_at',
                        None,
                        joined_timestamp
                    )
        
        # Auto-clear trial_batch_id when status changes to 'New' or 'Called'
        if status in ["New", "Called"] and lead.trial_batch_id:
            old_trial_batch = lead.trial_batch_id
            lead.trial_batch_id = None
            if user_id:
                log_field_update(
                    db, lead_id, user_id,
                    'trial_batch_id',
                    str(old_trial_batch),
                    None
                )
        
        # SOFT DEACTIVATION: Handle moving from 'Joined' to off-ramp statuses (On Break/Nurture/Dead)
        # Do NOT delete student records - preserve history for children who take a break
        if old_status == "Joined" and status in ["On Break", "Nurture", "Dead/Not Interested"]:
            # Find associated student record and soft deactivate
            student = db.exec(
                select(Student).where(Student.lead_id == lead_id)
            ).first()
            
            if student:
                # Soft deactivation: Set is_active = False to preserve history
                student.is_active = False
                db.add(student)
                db.flush()
                
                # Log the soft deactivation
                if user_id:
                    log_lead_activity(
                        db=db,
                        lead_id=lead_id,
                        user_id=user_id,
                        action_type='student_deactivated',
                        description=f'Student record deactivated (preserved for re-activation). Status changed from Joined to {status}.',
                        old_value='Active',
                        new_value='Inactive'
                    )
        
        # RE-ACTIVATION: Handle moving from 'On Break' back to 'Joined'
        # Re-activate the existing student record to preserve history
        if old_status == "On Break" and status == "Joined":
            # Find associated student record and re-activate
            student = db.exec(
                select(Student).where(Student.lead_id == lead_id)
            ).first()
            
            if student:
                # Re-activation: Set is_active = True
                student.is_active = True
                db.add(student)
                db.flush()
                
                # Log the re-activation
                if user_id:
                    log_lead_activity(
                        db=db,
                        lead_id=lead_id,
                        user_id=user_id,
                        action_type='student_reactivated',
                        description=f'Student record re-activated. Status changed from On Break to Joined.',
                        old_value='Inactive',
                        new_value='Active'
                    )
        
        # HARD DELETION: Only occurs during status reversal (handled in approvals.py)
        # This code path is no longer used for regular status updates
        
        if user_id:
            log_status_change(db, lead_id, user_id, old_status, status)
    
    # Update date_of_birth if provided
    if date_of_birth is not None:
        old_dob_str = lead.date_of_birth.isoformat() if lead.date_of_birth else None
        new_dob_str = date_of_birth.isoformat() if date_of_birth else None
        if old_dob_str != new_dob_str:
            lead.date_of_birth = date_of_birth
            if user_id:
                log_field_update(
                    db, lead_id, user_id,
                    'date_of_birth',
                    old_dob_str,
                    new_dob_str
                )
    
    # Update trial_batch_id if provided
    if trial_batch_id is not None:
        # Check batch capacity if assigning
        if trial_batch_id != 0:  # 0 or None means unassign
            from backend.core.batches import check_batch_capacity_for_date
            from datetime import date as date_type
            is_full, current_count, max_capacity = check_batch_capacity_for_date(
                db, trial_batch_id, date_type.today()
            )
            if is_full:
                raise ValueError("CAPACITY_REACHED: This batch is full.")
            
            old_trial_batch = lead.trial_batch_id
            if old_trial_batch != trial_batch_id and user_id:
                log_field_update(
                    db, lead_id, user_id,
                    'trial_batch_id',
                    str(old_trial_batch) if old_trial_batch else None,
                    str(trial_batch_id)
                )
            lead.trial_batch_id = trial_batch_id
        else:
            # Unassign (set to None)
            old_trial_batch = lead.trial_batch_id
            if old_trial_batch and user_id:
                log_field_update(
                    db, lead_id, user_id,
                    'trial_batch_id',
                    str(old_trial_batch),
                    None
                )
            lead.trial_batch_id = None
    
    # Update permanent_batch_id if provided
    if permanent_batch_id is not None:
        if permanent_batch_id != 0:  # 0 or None means unassign
            from backend.core.batches import check_batch_capacity_for_date
            from datetime import date as date_type
            is_full, current_count, max_capacity = check_batch_capacity_for_date(
                db, permanent_batch_id, date_type.today()
            )
            if is_full:
                raise ValueError("CAPACITY_REACHED: This batch is full.")
            
            old_permanent_batch = lead.permanent_batch_id
            if old_permanent_batch != permanent_batch_id and user_id:
                log_field_update(
                    db, lead_id, user_id,
                    'permanent_batch_id',
                    str(old_permanent_batch) if old_permanent_batch else None,
                    str(permanent_batch_id)
                )
            lead.permanent_batch_id = permanent_batch_id
        else:
            # Unassign (set to None)
            old_permanent_batch = lead.permanent_batch_id
            if old_permanent_batch and user_id:
                log_field_update(
                    db, lead_id, user_id,
                    'permanent_batch_id',
                    str(old_permanent_batch),
                    None
                )
            lead.permanent_batch_id = None
    
    # Update student_batch_ids (multi-batch assignment for joined students)
    if student_batch_ids is not None:
        # Clear existing student batch links
        existing_links = db.exec(
            select(StudentBatchLink).where(StudentBatchLink.lead_id == lead_id)
        ).all()
        for link in existing_links:
            db.delete(link)
        db.commit()  # Commit deletion before adding new ones
        
        # Add new student batch links
        for batch_id in student_batch_ids:
            # Verify batch exists
            batch = db.get(Batch, batch_id)
            if not batch:
                raise ValueError(f"Batch {batch_id} not found")
            # Check capacity
            from backend.core.batches import check_batch_capacity_for_date
            from datetime import date as date_type
            is_full, current_count, max_capacity = check_batch_capacity_for_date(
                db, batch_id, date_type.today()
            )
            if is_full:
                raise ValueError(f"CAPACITY_REACHED: Batch {batch.name} is full.")
            
            link = StudentBatchLink(lead_id=lead_id, batch_id=batch_id)
            db.add(link)
        
        # Log the change if user_id is provided
        if user_id:
            old_batch_ids = [str(link.batch_id) for link in existing_links]
            new_batch_ids = [str(bid) for bid in student_batch_ids]
            log_field_update(
                db, lead_id, user_id,
                'student_batch_ids',
                ','.join(old_batch_ids) if old_batch_ids else None,
                ','.join(new_batch_ids) if new_batch_ids else None
            )
    
    # Update last_updated timestamp
    lead.last_updated = datetime.utcnow()
    
    # Update next follow-up date
    # Note: Nurture and Dead/Not Interested statuses already had their next_followup_date cleared above
    if next_date and next_date != "None":
        try:
            new_next_date_obj = datetime.fromisoformat(next_date)
            new_next_date_str = new_next_date_obj.isoformat()
            
            if old_next_date != new_next_date_str:
                lead.next_followup_date = new_next_date_obj
                if user_id:
                    log_field_update(
                        db, lead_id, user_id, 
                        'next_followup_date', 
                        old_next_date, 
                        new_next_date_str
                    )
        except (ValueError, AttributeError):
            pass
    elif not next_date and lead.next_followup_date and status != "Nurture" and status != "Dead/Not Interested":
        # Clearing the date (but not for Nurture or Dead, which are handled above)
        old_date_str = lead.next_followup_date.isoformat()
        lead.next_followup_date = None
        if user_id:
            log_field_update(
                db, lead_id, user_id,
                'next_followup_date',
                old_date_str,
                None
            )
    
    # Update loss_reason / loss_reason_notes (off-ramp: Nurture / Dead)
    if loss_reason is not None:
        old_reason = lead.loss_reason
        lead.loss_reason = loss_reason
        if old_reason != loss_reason and user_id:
            log_field_update(db, lead_id, user_id, 'loss_reason', old_reason, loss_reason)
    if loss_reason_notes is not None:
        old_notes = lead.loss_reason_notes
        lead.loss_reason_notes = loss_reason_notes
        if old_notes != loss_reason_notes and user_id:
            log_field_update(db, lead_id, user_id, 'loss_reason_notes', old_notes, loss_reason_notes)
    
    # Update payment_proof_url if provided
    if payment_proof_url is not None:
        old_payment_proof = lead.payment_proof_url
        lead.payment_proof_url = payment_proof_url
        if old_payment_proof != payment_proof_url and user_id:
            log_field_update(
                db, lead_id, user_id,
                'payment_proof_url',
                old_payment_proof,
                payment_proof_url
            )
    
    # Update call_confirmation_note if provided
    if call_confirmation_note is not None:
        old_note = lead.call_confirmation_note
        lead.call_confirmation_note = call_confirmation_note
        if old_note != call_confirmation_note and user_id:
            log_field_update(
                db, lead_id, user_id,
                'call_confirmation_note',
                old_note,
                call_confirmation_note
            )
    
    # Add comment with mentions
    if comment and user_id:
        from backend.core.mentions import parse_mentions, resolve_mentions_to_user_ids, store_mentions
        
        # Parse and resolve mentions
        mentioned_usernames = parse_mentions(comment)
        mentioned_user_ids = resolve_mentions_to_user_ids(db, mentioned_usernames) if mentioned_usernames else []
        mentions_json = store_mentions(mentioned_user_ids)
        
        new_comment = Comment(
            text=comment,
            user_id=user_id,
            lead_id=lead.id,
            mentioned_user_ids=mentions_json
        )
        db.add(new_comment)
        log_comment_added(db, lead_id, user_id, comment)
    
    db.add(lead)
    db.commit()
    db.refresh(lead)
    
    return lead


def _age_group_to_dob(age_group: str):
    """Convert legacy age group (e.g. U9, Senior) to approximate date_of_birth for CSV/webhook import."""
    import re
    from datetime import date as date_type
    s = str(age_group).strip()
    m = re.match(r"^U(\d+)$", s, re.I)
    if m:
        age = max(0, int(m.group(1)) - 1)  # U9 = under 9 → ~8 years
    elif s.lower() == "senior":
        age = 17
    else:
        age = 10
    year = datetime.utcnow().year - age
    return date_type(year, 1, 1)


def create_lead_from_meta(
    db: Session,
    phone: str,
    name: str,
    email: Optional[str],
    center_tag: str,
    age_group: Optional[str] = None,
    date_of_birth: Optional[date] = None,
    address: Optional[str] = None,
    user_id: Optional[int] = None
) -> Lead:
    """
    Create a lead from Meta webhook data, with duplicate detection.
    
    Args:
        db: Database session
        phone: Phone number
        name: Player name
        email: Email address (optional)
        center_tag: Center meta tag name
        age_group: Legacy - converted to approximate DOB if date_of_birth not provided
        date_of_birth: Preferred - actual DOB
        address: Address (optional)
        user_id: Optional user ID for audit log
        
    Returns:
        Created or updated Lead object
    """
    from backend.core.duplicate_detection import find_duplicate_lead, handle_duplicate_lead
    
    if not phone:
        raise ValueError("Phone number is required")
    
    # Find center by meta tag
    center = db.exec(select(Center).where(Center.meta_tag_name == center_tag)).first()
    if not center:
        raise ValueError(f"Center '{center_tag}' not found")
    
    # Check for duplicate
    duplicate = find_duplicate_lead(db, name, phone, email)
    if duplicate:
        # Handle duplicate: update existing lead
        return handle_duplicate_lead(
            db=db,
            existing_lead=duplicate,
            source="Meta Webhook",
            user_id=user_id
        )
    
    # No duplicate found, create new lead
    # Set initial next_followup_date to 24 hours from creation
    from datetime import timedelta
    initial_followup = datetime.now() + timedelta(hours=24)
    
    dob = date_of_birth
    if not dob and age_group:
        dob = _age_group_to_dob(age_group)
    
    now = datetime.now()
    new_lead = Lead(
        created_time=now,
        last_updated=now,  # Set last_updated to same as created_time for new leads
        player_name=name if name else "Unknown",
        date_of_birth=dob,
        phone=phone,
        email=email,
        address=address,
        center_id=center.id,
        status="New",
        public_token=str(uuid.uuid4()),
        next_followup_date=initial_followup
    )
    
    db.add(new_lead)
    db.commit()
    db.refresh(new_lead)
    return new_lead


def import_leads_from_dataframe(db: Session, df: pd.DataFrame, meta_col: str) -> tuple[int, List[str], List[dict]]:
    """
    Import leads from a pandas DataFrame.
    Does not send email; caller should send one summary per center via BackgroundTasks.

    Returns:
        Tuple of (number of leads created, list of error messages, summary_list).
        summary_list: [{"center_id": int, "center_name": str, "count": int}, ...] for centers with count > 1 only.
    """
    from backend.core.duplicate_detection import find_duplicate_lead, handle_duplicate_lead
    
    # Get all centers for validation
    centers = db.exec(select(Center)).all()
    center_tags = {c.meta_tag_name for c in centers}
    
    errors = []
    unknown_tags = set()
    
    # Check for unknown meta tags
    for tag in df[meta_col].unique():
        if tag not in center_tags:
            unknown_tags.add(str(tag))
    
    if unknown_tags:
        errors.append(f"Unknown center tags: {', '.join(unknown_tags)}")
    
    count = 0
    rows_processed = 0
    created_leads_info: List[dict] = []  # {center_id, center_name, player_name, phone} per new lead
    for _, row in df.iterrows():
        rows_processed += 1
        center_val = str(row.get(meta_col, '')).strip() if pd.notna(row.get(meta_col)) else ''
        center = db.exec(select(Center).where(Center.meta_tag_name == center_val)).first()
        phone_val = str(row.get('phone', ''))
        player_name_val = row.get('player_name', 'Unknown')
        email_val = row.get('email', '')
        
        if not center:
            errors.append(f"Row {rows_processed}: Center '{center_val}' not found in database")
            continue
        
        # Check for duplicate lead
        existing_lead = find_duplicate_lead(db, player_name_val, phone_val, email_val)
        if existing_lead:
            handle_duplicate_lead(db, existing_lead, source="CSV Import")
            continue # Skip creating new lead, move to next row
        
        # For CSV imports, always use current time (ignore any created_time column in CSV)
        # This ensures next_followup_date is calculated from the actual import time
        from datetime import timedelta
        now = datetime.utcnow()
        
        # Set initial next_followup_date to 24 hours from now
        initial_followup = now + timedelta(hours=24)
        
        dob_val = row.get('date_of_birth') or row.get('player_age_group')
        dob_parsed = None
        if pd.notna(dob_val):
            try:
                dt = pd.to_datetime(dob_val)
                from datetime import date as date_type
                dob_parsed = date_type(dt.year, dt.month, dt.day)
            except Exception:
                pass
        if not dob_parsed and pd.notna(row.get('player_age_group')):
            dob_parsed = _age_group_to_dob(str(row.get('player_age_group', 'U10')))
        
        new_lead = Lead(
            created_time=now,  # Always use current time for CSV imports
            last_updated=now,  # Set last_updated to same as created_time for new leads
            player_name=player_name_val,
            date_of_birth=dob_parsed,
            phone=phone_val,
            email=email_val,
            address=row.get('address_and_pincode', ''),
            center_id=center.id,
            status="New",
            public_token=str(uuid.uuid4()),
            next_followup_date=initial_followup  # 24 hours from now
        )
        db.add(new_lead)
        count += 1
        center_name = center.display_name or center.city or str(center.id)
        created_leads_info.append({
            "center_id": center.id,
            "center_name": center_name,
            "player_name": player_name_val,
            "phone": phone_val,
        })
    
    db.commit()

    # One summary per center with count > 1. No individual emails for CSV import.
    by_center: dict = {}
    for info in created_leads_info:
        cid = info["center_id"]
        if cid not in by_center:
            by_center[cid] = {"center_name": info["center_name"], "count": 0}
        by_center[cid]["count"] += 1
    summary_list = [
        {"center_id": cid, "center_name": data["center_name"], "count": data["count"]}
        for cid, data in by_center.items()
        if data["count"] > 1
    ]
    return count, errors, summary_list


def check_nudge_expiry(db: Session) -> List[int]:
    """
    Check for Nurture leads that have reached the 3-strike limit (nudge_count >= 3).
    Automatically change their status to 'Dead/Not Interested' and set loss_reason.
    
    Args:
        db: Database session
        
    Returns:
        List of lead IDs that were processed
    """
    from backend.models import AuditLog
    from datetime import datetime
    
    # Find all leads in 'Nurture' status with nudge_count >= 3
    expired_nurture_leads = db.exec(
        select(Lead).where(
            Lead.status == "Nurture",
            Lead.nudge_count >= 3
        )
    ).all()
    
    processed_lead_ids = []
    
    for lead in expired_nurture_leads:
        old_status = lead.status
        lead.status = "Dead/Not Interested"
        lead.loss_reason = "No response to re-engagement"
        lead.do_not_contact = True
        lead.next_followup_date = None
        lead.last_updated = datetime.utcnow()
        
        # Add Audit Log entry
        audit_log = AuditLog(
            lead_id=lead.id,
            user_id=None,  # System-generated
            action_type='status_change',
            description=f'System: Lead reached 3-strike limit (nudge_count: {lead.nudge_count}). Auto-marked as Dead/Not Interested.',
            old_value=old_status,
            new_value="Dead/Not Interested",
            timestamp=datetime.utcnow()
        )
        db.add(audit_log)
        db.add(lead)
        processed_lead_ids.append(lead.id)
    
    if processed_lead_ids:
        db.commit()
    
    return processed_lead_ids


def increment_nudge_count(
    db: Session,
    lead_id: int,
    user_id: Optional[int] = None
) -> Lead:
    """
    Increment the nudge_count for a Nurture lead.
    Used when sending re-engagement nudges.
    
    Args:
        db: Database session
        lead_id: Lead ID
        user_id: User ID who sent the nudge (for audit logging)
        
    Returns:
        Updated Lead object
        
    Raises:
        ValueError: If lead not found or not in Nurture status
    """
    from datetime import datetime
    from backend.core.audit import log_lead_activity
    
    lead = db.get(Lead, lead_id)
    if not lead:
        raise ValueError(f"Lead {lead_id} not found")
    
    if lead.status not in ["Nurture", "On Break"]:
        raise ValueError("Can only send nudges to leads in 'Nurture' or 'On Break' status")
    
    # Increment nudge count
    old_nudge_count = lead.nudge_count
    lead.nudge_count = old_nudge_count + 1
    lead.last_updated = datetime.utcnow()
    
    # Log the action
    log_lead_activity(
        db,
        lead_id=lead_id,
        user_id=user_id,
        action_type='nudge_sent',
        description=f'Re-engagement nudge sent (nudge_count: {old_nudge_count} → {lead.nudge_count})',
        old_value=str(old_nudge_count),
        new_value=str(lead.nudge_count)
    )
    
    db.add(lead)
    db.commit()
    db.refresh(lead)
    
    # Check if this nudge pushed the lead to 3-strike limit
    if lead.nudge_count >= 3:
        check_nudge_expiry(db)
        db.refresh(lead)
    
    return lead


def verify_and_enroll_from_pending(
    db: Session,
    lead_id: int,
    user_id: int,
) -> Student:
    """
    Verify payment and enroll student from pending_subscription_data.
    Parses pending data, converts lead to student, clears pending, sends welcome email,
    and triggers enrollment finalized notification.

    Args:
        db: Database session
        lead_id: ID of the lead in Payment Pending Verification
        user_id: ID of the user performing verification

    Returns:
        Student with lead and batches loaded (for StudentRead serialization)

    Raises:
        ValueError: If lead not found, wrong status, or missing/invalid pending data
    """
    from backend.core.students import convert_lead_to_student
    from backend.core.emails import send_welcome_email
    from backend.core.notifications import notify_center_users
    from sqlalchemy.orm import selectinload
    from datetime import date as date_type, timedelta

    lead = get_lead_by_id(db, lead_id)
    if not lead:
        raise ValueError("Lead not found")
    if lead.status != "Payment Pending Verification":
        raise ValueError("Lead must be in Payment Pending Verification status")

    pending = getattr(lead, "pending_subscription_data", None)
    if not pending or not isinstance(pending, dict):
        raise ValueError("No pending subscription data found")

    subscription_plan = pending.get("subscription_plan") or "Monthly"
    start_date_str = pending.get("start_date")
    batch_id = pending.get("batch_id")
    utr_number = pending.get("utr_number")
    payment_proof_url = pending.get("payment_proof_url")
    kit_size = pending.get("kit_size")
    medical_info = pending.get("medical_info")
    secondary_contact = pending.get("secondary_contact")

    if not start_date_str:
        raise ValueError("Missing start_date in pending data")
    try:
        start_date = date_type.fromisoformat(start_date_str)
    except ValueError:
        raise ValueError("Invalid start_date in pending data")

    student_batch_ids = [batch_id] if batch_id else []
    if not student_batch_ids and getattr(lead, "preferred_batch_id", None):
        student_batch_ids = [lead.preferred_batch_id]

    months_map = {"Monthly": 1, "Quarterly": 3, "3 Months": 3, "6 Months": 6, "Yearly": 12}
    months = months_map.get(subscription_plan, 1)
    end_date = start_date + timedelta(days=months * 31)

    student_data = {
        "subscription_plan": subscription_plan,
        "subscription_start_date": start_date,
        "subscription_end_date": end_date,
        "utr_number": utr_number,
        "payment_proof_url": payment_proof_url,
        "is_payment_verified": True,
        "kit_size": kit_size,
        "medical_info": medical_info,
        "secondary_contact": secondary_contact,
        "student_batch_ids": student_batch_ids,
        "center_id": lead.center_id,
    }

    student = convert_lead_to_student(
        db=db,
        lead_id=lead_id,
        student_data=student_data,
        user_id=user_id,
    )

    # Clear pending data
    lead.pending_subscription_data = None
    db.add(lead)
    db.commit()
    db.refresh(lead)

    # Send welcome email (non-blocking)
    try:
        send_welcome_email(db, student.id)
    except Exception:
        pass

    # Enrollment finalized notification
    try:
        player_name = lead.player_name or "Player"
        batch_name = "—"
        if student_batch_ids:
            batch = db.get(Batch, student_batch_ids[0])
            batch_name = batch.name if batch else "—"
        from urllib.parse import quote
        notify_center_users(
            db,
            student.center_id,
            type="SALES_ALERT",
            title=f"🎉 Enrollment Finalized: {player_name}",
            message=f"Payment has been verified. {player_name} is now an active student in the {batch_name} batch.",
            target_url=f"/students?search={quote(player_name)}",
            priority="high",
        )
    except Exception:
        pass

    # Reload student with relationships for response
    stmt = select(Student).where(Student.id == student.id).options(
        selectinload(Student.lead),
        selectinload(Student.batches),
    )
    student_with_relations = db.exec(stmt).first()
    return student_with_relations


def create_manual_lead(
    db: Session,
    payload: dict,
    user_id: int,
) -> Lead:
    """
    Create a lead manually (Team Leads and Team Members).
    Duplicate check, center verification, and notification handled here.

    Payload keys: player_name, phone, email (optional), address (optional),
    date_of_birth (optional, YYYY-MM-DD), center_id.

    Args:
        db: Database session
        payload: Dict with lead creation data
        user_id: ID of the user creating the lead (for audit context)

    Returns:
        Created Lead object

    Raises:
        ValueError: If duplicate exists, center not found, or validation fails
    """
    from backend.core.staging import check_duplicate_lead
    from datetime import timedelta
    from urllib.parse import quote
    import os

    player_name = payload.get("player_name")
    phone = payload.get("phone")
    if not player_name or not phone:
        raise ValueError("player_name and phone are required")

    center_id = payload.get("center_id")
    if not center_id:
        raise ValueError("center_id is required")

    if check_duplicate_lead(db, player_name, phone):
        raise ValueError("A lead with this name and phone number already exists")

    center = db.get(Center, center_id)
    if not center:
        raise ValueError(f"Center {center_id} not found")

    date_of_birth = payload.get("date_of_birth")
    dob_parsed = None
    if date_of_birth:
        try:
            dob_parsed = date.fromisoformat(date_of_birth)
        except (ValueError, TypeError):
            raise ValueError("date_of_birth must be YYYY-MM-DD")

    now = datetime.utcnow()
    initial_followup = now + timedelta(hours=24)
    new_lead = Lead(
        created_time=now,
        last_updated=now,
        player_name=player_name,
        phone=phone,
        email=payload.get("email"),
        address=payload.get("address"),
        date_of_birth=dob_parsed,
        center_id=center_id,
        status="New",
        public_token=str(uuid.uuid4()),
        next_followup_date=initial_followup,
    )

    db.add(new_lead)
    db.commit()
    db.refresh(new_lead)

    # In-app notification (Low Priority)
    try:
        from backend.core.notifications import notify_center_users
        base_url = os.getenv("CRM_BASE_URL", "").strip().rstrip("/")
        link = f"{base_url}/leads?search={quote(new_lead.phone or '')}" if base_url else None
        center_name = center.display_name or center.city or "Unknown"
        notify_center_users(
            db,
            new_lead.center_id,
            type="SALES_ALERT",
            title=f"New Lead: {new_lead.player_name or 'Unknown'}",
            message=f"New lead added manually at {center_name}. Phone: {new_lead.phone or '—'}.",
            link=link,
            priority="low",
        )
    except Exception as e:
        logger.exception("New lead in-app notification failed: %s", e)

    return new_lead


def send_enrollment_link(db: Session, lead_id: int) -> dict:
    """
    Set enrollment link sent timestamps for a lead. Must be in Trial Attended status.
    Returns dict with link and expires_at.
    """
    from datetime import timedelta
    import os

    lead = get_lead_by_id(db, lead_id)
    if not lead:
        raise ValueError("Lead not found")
    if lead.status != "Trial Attended":
        raise ValueError("Lead must be in Trial Attended status")
    now = datetime.utcnow()
    expires = now + timedelta(days=7)
    lead.enrollment_link_sent_at = now
    lead.link_expires_at = expires
    lead.last_updated = now
    db.add(lead)
    db.commit()
    db.refresh(lead)
    base_url = os.getenv("NEXT_PUBLIC_APP_URL", os.getenv("APP_URL", "https://example.com")).rstrip("/")
    link = f"{base_url}/join/{lead.public_token}" if lead.public_token else ""
    return {"message": "Enrollment link sent", "link": link, "expires_at": expires.isoformat()}


def update_lead_subscription_fields(
    db: Session,
    lead_id: int,
    subscription_plan: Optional[str] = None,
    subscription_start_date: Optional[date] = None,
    subscription_end_date: Optional[date] = None,
) -> None:
    """Update subscription fields on a lead. Auto-calculates end_date from plan if needed."""
    from datetime import timedelta

    lead = get_lead_by_id(db, lead_id)
    if not lead:
        raise ValueError("Lead not found")
    if subscription_plan is not None:
        lead.subscription_plan = subscription_plan
    if subscription_start_date is not None:
        lead.subscription_start_date = subscription_start_date
        if subscription_plan and not subscription_end_date:
            if subscription_plan == "Monthly":
                lead.subscription_end_date = subscription_start_date + timedelta(days=30)
            elif subscription_plan == "Quarterly":
                lead.subscription_end_date = subscription_start_date + timedelta(days=90)
            elif subscription_plan == "6 Months":
                lead.subscription_end_date = subscription_start_date + timedelta(days=180)
            elif subscription_plan == "Yearly":
                lead.subscription_end_date = subscription_start_date + timedelta(days=365)
    elif subscription_plan and lead.subscription_start_date and not subscription_end_date and not lead.subscription_end_date:
        if subscription_plan == "Monthly":
            lead.subscription_end_date = lead.subscription_start_date + timedelta(days=30)
        elif subscription_plan == "Quarterly":
            lead.subscription_end_date = lead.subscription_start_date + timedelta(days=90)
        elif subscription_plan == "6 Months":
            lead.subscription_end_date = lead.subscription_start_date + timedelta(days=180)
        elif subscription_plan == "Yearly":
            lead.subscription_end_date = lead.subscription_start_date + timedelta(days=365)
    if subscription_end_date is not None:
        lead.subscription_end_date = subscription_end_date
    db.add(lead)
    db.commit()
    db.refresh(lead)


def notify_trial_scheduled(db: Session, lead_id: int) -> None:
    """Send trial scheduled notification for a lead. No-op if lead not found."""
    import os
    from urllib.parse import quote
    from backend.core.notifications import notify_center_users

    lead = get_lead_by_id(db, lead_id)
    if not lead or not lead.center_id:
        return
    try:
        base_url = os.getenv("CRM_BASE_URL", "").strip().rstrip("/")
        link = f"{base_url}/leads?search={quote(lead.phone or '')}" if base_url and lead.phone else None
        notify_center_users(
            db, lead.center_id,
            type="SALES_ALERT",
            title=f"Trial Scheduled: {lead.player_name or 'Unknown'}",
            message="A trial has been scheduled for this lead.",
            link=link,
            priority="low",
        )
    except Exception:
        pass


def can_coach_update_lead_metadata(db: Session, lead_id: int, user_id: int) -> bool:
    """Check if a coach can update metadata for this lead (must be in their assigned batches)."""
    coach_batch_ids = list(db.exec(
        select(BatchCoachLink.batch_id).where(BatchCoachLink.user_id == user_id)
    ).all())
    if not coach_batch_ids:
        return False
    lead = get_lead_by_id(db, lead_id)
    if not lead:
        return False
    lead_in_batch = (
        (lead.trial_batch_id and lead.trial_batch_id in coach_batch_ids)
        or (lead.permanent_batch_id and lead.permanent_batch_id in coach_batch_ids)
    )
    if lead_in_batch:
        return True
    student = db.exec(select(Student).where(Student.lead_id == lead_id)).first()
    if not student:
        return False
    links = db.exec(
        select(StudentBatchLink.batch_id).where(
            StudentBatchLink.student_id == student.id,
            StudentBatchLink.batch_id.in_(coach_batch_ids),
        )
    ).all()
    return len(list(links)) > 0


def get_lead_player_name(db: Session, lead_id: Optional[int]) -> str:
    """Get player name for a lead, or 'Unknown' if not found."""
    if not lead_id:
        return "Unknown"
    lead = db.get(Lead, lead_id)
    return lead.player_name if lead else "Unknown"
