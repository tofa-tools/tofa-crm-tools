"""
Lead management business logic.
Framework-agnostic lead CRUD operations.
"""
from sqlmodel import Session, select, func
from typing import List, Optional, Tuple
from datetime import datetime
from backend.models import Lead, Center, Comment, User, BatchCoachLink, Batch, StudentBatchLink
from sqlalchemy import or_
import pandas as pd
import uuid


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
    loss_reason_filter: Optional[str] = None  # Filter by loss_reason
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
    
    # Get total count
    total = db.exec(count_query).one()
    
    # Apply ordering based on sort_by parameter
    if sort_by == "score":
        # Sort by score descending (highest first)
        query = query.order_by(Lead.score.desc(), Lead.created_time.desc())
    elif sort_by == "freshness":
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
    
    leads = list(db.exec(query).all())
    return leads, total


def get_lead_by_id(db: Session, lead_id: int) -> Optional[Lead]:
    """Get a lead by ID."""
    return db.get(Lead, lead_id)


def update_lead(
    db: Session,
    lead_id: int,
    status: str,
    next_date: Optional[str] = None,
    comment: Optional[str] = None,
    user_id: Optional[int] = None,
    player_age_category: Optional[str] = None,  # New parameter for age category update
    trial_batch_id: Optional[int] = None,  # New parameter for batch assignment
    permanent_batch_id: Optional[int] = None  # New parameter for batch assignment
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
        age_category: Optional new age category
        
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
    old_age_category = lead.player_age_category
    
    # Validate Joined status requires permanent_batch_id BEFORE status change
    if status == "Joined":
        # Check if permanent_batch_id is being set in this update OR already exists
        if permanent_batch_id is None or permanent_batch_id == 0:
            # Not setting it now, check if it already exists
            if not lead.permanent_batch_id:
                raise ValueError("BATCH_REQUIRED: A permanent batch must be assigned before setting status to 'Joined'.")
    
    # Update status
    if lead.status != status:
        lead.status = status
        # Auto-set do_not_contact for Dead/Not Interested status
        if status == "Dead/Not Interested":
            lead.do_not_contact = True
            # Auto-clear next_followup_date for Dead status
            if lead.next_followup_date:
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
        if user_id:
            log_status_change(db, lead_id, user_id, old_status, status)
    
    # Update age category if provided
    if player_age_category and player_age_category != lead.player_age_category:
        lead.player_age_category = player_age_category
        if user_id:
            log_field_update(
                db, lead_id, user_id,
                'player_age_category',
                old_age_category,
                player_age_category
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
    
    # Update last_updated timestamp
    lead.last_updated = datetime.utcnow()
    
    # Handle Nurture status: if status is Nurture and no new date provided, clear follow-up date
    if status == "Nurture" and not next_date:
        if lead.next_followup_date:
            old_date_str = lead.next_followup_date.isoformat()
            lead.next_followup_date = None
            if user_id:
                log_field_update(
                    db, lead_id, user_id,
                    'next_followup_date',
                    old_date_str,
                    None
                )
    # Update next follow-up date
    elif next_date and next_date != "None":
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
    
    # Recalculate score after update
    from backend.core.lead_scoring import update_lead_score
    update_lead_score(db, lead)
    
    return lead


def create_lead_from_meta(
    db: Session,
    phone: str,
    name: str,
    email: Optional[str],
    center_tag: str,
    age_category: str,
    address: Optional[str],
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
        age_category: Player age category
        address: Address (optional)
        user_id: Optional user ID for audit log
        
    Returns:
        Created or updated Lead object
        
    Raises:
        ValueError: If center not found or phone is missing
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
    
    now = datetime.now()
    new_lead = Lead(
        created_time=now,
        last_updated=now,  # Set last_updated to same as created_time for new leads
        player_name=name if name else "Unknown",
        player_age_category=age_category if age_category else "Unknown",
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
    
    # Calculate and set initial score
    from backend.core.lead_scoring import update_lead_score
    update_lead_score(db, new_lead)
    
    return new_lead


def import_leads_from_dataframe(db: Session, df: pd.DataFrame, meta_col: str) -> tuple[int, List[str]]:
    """
    Import leads from a pandas DataFrame.
    
    Args:
        db: Database session
        df: DataFrame with lead data
        meta_col: Name of column containing center meta tags
        
    Returns:
        Tuple of (number of leads created, list of error messages)
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
        
        new_lead = Lead(
            created_time=now,  # Always use current time for CSV imports
            last_updated=now,  # Set last_updated to same as created_time for new leads
            player_name=player_name_val,
            player_age_category=row.get('player_age_category', 'Unknown'),
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
    
    db.commit()
    # After committing, refresh all newly added leads to calculate scores
    from backend.core.lead_scoring import update_lead_score
    for lead in db.exec(select(Lead).where(Lead.score == 0)).all():
        update_lead_score(db, lead)
    db.commit() # Commit score updates
    
    return count, errors
