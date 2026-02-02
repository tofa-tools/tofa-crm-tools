"""
Public preferences business logic.
Framework-agnostic operations for public lead preferences.
"""
from sqlmodel import Session, select
from typing import Optional, Dict, List, Any
from backend.models import Lead, Batch, Center


# Must match @tofa/core AGE_CATEGORIES: U5, U7, U9, U11, U13, U15, U17, Senior
def get_nearest_age_categories(age_category: str) -> List[str]:
    """
    Get nearest age categories for fallback when exact match not found.
    Order matches core: U5, U7, U9, U11, U13, U15, U17, Senior.
    """
    age_order = ["U5", "U7", "U9", "U11", "U13", "U15", "U17", "Senior"]
    
    if age_category not in age_order:
        # If unknown category, return all in order
        return age_order
    
    idx = age_order.index(age_category)
    nearest = [age_category]  # Start with exact match
    
    # Add next higher categories
    if idx < len(age_order) - 1:
        nearest.append(age_order[idx + 1])
    if idx < len(age_order) - 2:
        nearest.append(age_order[idx + 2])
    
    # Add previous lower categories (if U7 kid, show U9, but not lower)
    # Actually, for U7, we only want U9/U11, not lower
    # So we don't add lower categories
    
    return nearest


def get_lead_preferences_by_token(db: Session, token: str) -> Optional[Dict[str, Any]]:
    """
    Get lead preferences data by public token.
    
    Args:
        db: Database session
        token: Public token for the lead
        
    Returns:
        Dictionary with player_name, center_name, batches (filtered by age), 
        demo_batches (with nearest age fallback), and current preferences
        None if token not found
    """
    # Find lead by token
    lead = db.exec(select(Lead).where(Lead.public_token == token)).first()
    if not lead:
        return None
    
    # Get center
    center = db.get(Center, lead.center_id) if lead.center_id else None
    if not center:
        return None
    
    # Get all batches at this center (we'll filter by age category in Python since batches can have multiple categories)
    all_center_batches = db.exec(
        select(Batch).where(Batch.center_id == center.id)
    ).all()
    
    # Filter batches that match the lead's age category (for permanent batch)
    # Batch age_category can be comma-separated like "U11,U13", so we check if lead's category is in the list
    batches = []
    for batch in all_center_batches:
        if batch.age_category:
            batch_categories = [cat.strip() for cat in batch.age_category.split(',')]
            if lead.player_age_category in batch_categories:
                batches.append(batch)
    
    # Get demo batches - try exact age category first, then nearest age categories
    age_categories_to_try = get_nearest_age_categories(lead.player_age_category)
    demo_batches = []
    seen_batch_ids = set()
    
    for age_cat in age_categories_to_try:
        for batch in all_center_batches:
            if batch.id not in seen_batch_ids and batch.age_category:
                batch_categories = [cat.strip() for cat in batch.age_category.split(',')]
                if age_cat in batch_categories:
                    demo_batches.append(batch)
                    seen_batch_ids.add(batch.id)
    
    # Format batches for response (permanent batches)
    batches_list = []
    for batch in batches:
        # Build schedule string
        schedule_parts = []
        if batch.is_mon:
            schedule_parts.append("Mon")
        if batch.is_tue:
            schedule_parts.append("Tue")
        if batch.is_wed:
            schedule_parts.append("Wed")
        if batch.is_thu:
            schedule_parts.append("Thu")
        if batch.is_fri:
            schedule_parts.append("Fri")
        if batch.is_sat:
            schedule_parts.append("Sat")
        if batch.is_sun:
            schedule_parts.append("Sun")
        
        schedule_str = ", ".join(schedule_parts) if schedule_parts else "No schedule"
        
        time_str = ""
        if batch.start_time and batch.end_time:
            # Format time as HH:MM AM/PM
            start_formatted = batch.start_time.strftime('%I:%M %p').lstrip('0')
            end_formatted = batch.end_time.strftime('%I:%M %p').lstrip('0')
            time_str = f"{start_formatted} - {end_formatted}"
        
        batches_list.append({
            "id": batch.id,
            "name": batch.name,
            "age_category": batch.age_category,
            "schedule": schedule_str,
            "time": time_str,
            "max_capacity": batch.max_capacity,
        })
    
    # Format demo batches for response
    demo_batches_list = []
    for batch in demo_batches:
        schedule_parts = []
        if batch.is_mon:
            schedule_parts.append("Mon")
        if batch.is_tue:
            schedule_parts.append("Tue")
        if batch.is_wed:
            schedule_parts.append("Wed")
        if batch.is_thu:
            schedule_parts.append("Thu")
        if batch.is_fri:
            schedule_parts.append("Fri")
        if batch.is_sat:
            schedule_parts.append("Sat")
        if batch.is_sun:
            schedule_parts.append("Sun")
        
        schedule_str = ", ".join(schedule_parts) if schedule_parts else "No schedule"
        
        time_str = ""
        if batch.start_time and batch.end_time:
            start_formatted = batch.start_time.strftime('%I:%M %p').lstrip('0')
            end_formatted = batch.end_time.strftime('%I:%M %p').lstrip('0')
            time_str = f"{start_formatted} - {end_formatted}"
        
        # Mark if it's a different age category than the lead
        # Check if lead's age category is in the batch's comma-separated age categories
        batch_categories = [cat.strip() for cat in batch.age_category.split(',')] if batch.age_category else []
        is_different_age = lead.player_age_category not in batch_categories
        
        demo_batches_list.append({
            "id": batch.id,
            "name": batch.name,
            "age_category": batch.age_category,
            "schedule": schedule_str,
            "time": time_str,
            "max_capacity": batch.max_capacity,
            "is_different_age": is_different_age,  # Flag to show this is nearest age, not exact
        })
    
    return {
        "player_name": lead.player_name,
        "center_name": center.display_name,
        "player_age_category": lead.player_age_category,  # Include lead's age category
        "batches": batches_list,  # Permanent batches (exact age match)
        "demo_batches": demo_batches_list,  # Demo batches (with nearest age fallback)
        "preferred_batch_id": lead.preferred_batch_id,
        "preferred_demo_batch_id": lead.trial_batch_id,  # Use trial_batch_id for demo preference
        "preferred_call_time": lead.preferred_call_time,
        "preferred_timing_notes": lead.preferred_timing_notes,
        "status": lead.status,
        "reschedule_count": lead.reschedule_count or 0,
    }


def update_lead_preferences_by_token(
    db: Session,
    token: str,
    preferred_batch_id: Optional[int] = None,
    preferred_demo_batch_id: Optional[int] = None,
    preferred_call_time: Optional[str] = None,
    preferred_timing_notes: Optional[str] = None,
    loss_reason: Optional[str] = None,
    loss_reason_notes: Optional[str] = None
) -> Optional[Lead]:
    """
    Update lead preferences by public token.
    
    Args:
        db: Database session
        token: Public token for the lead
        preferred_batch_id: Preferred batch ID
        preferred_call_time: Preferred call time
        preferred_timing_notes: Preferred timing notes
        
    Returns:
        Updated Lead object, or None if token not found
    """
    # Find lead by token
    lead = db.exec(select(Lead).where(Lead.public_token == token)).first()
    if not lead:
        return None
    
    # Validate preferred_batch_id if provided (permanent batch - must match age)
    if preferred_batch_id is not None:
        batch = db.get(Batch, preferred_batch_id)
        if not batch:
            raise ValueError(f"Batch {preferred_batch_id} not found")
        # Ensure batch is at the same center and matches age category
        if batch.center_id != lead.center_id:
            raise ValueError("Batch must be at the same center as the lead")
        # Check if lead's age category is in the batch's comma-separated age categories
        if batch.age_category:
            batch_categories = [cat.strip() for cat in batch.age_category.split(',')]
            if lead.player_age_category not in batch_categories:
                raise ValueError("Batch must match the lead's age category")
        else:
            raise ValueError("Batch must match the lead's age category")
    
    # Validate preferred_demo_batch_id if provided (demo batch - can be nearest age)
    if preferred_demo_batch_id is not None:
        demo_batch = db.get(Batch, preferred_demo_batch_id)
        if not demo_batch:
            raise ValueError(f"Demo batch {preferred_demo_batch_id} not found")
        # Ensure batch is at the same center
        if demo_batch.center_id != lead.center_id:
            raise ValueError("Demo batch must be at the same center as the lead")
        # Note: Demo batch can be different age category (U7 kid can choose U9/U11 batch)
    
    # Store old status for audit logging
    old_status = lead.status
    
    # Handle loss reason (dead/not interested)
    if loss_reason:
        lead.loss_reason = loss_reason
        lead.loss_reason_notes = loss_reason_notes
        lead.status = 'Dead/Not Interested'
    else:
        # Update preferences (only if not marking as lost)
        if preferred_batch_id is not None:
            lead.preferred_batch_id = preferred_batch_id
        if preferred_demo_batch_id is not None:
            lead.trial_batch_id = preferred_demo_batch_id  # Store demo preference in trial_batch_id
        if preferred_call_time is not None:
            lead.preferred_call_time = preferred_call_time
        if preferred_timing_notes is not None:
            lead.preferred_timing_notes = preferred_timing_notes
        
        # Update status to "Followed up with message" if preferences were provided and status is "New", "Nurture", or "On Break"
        if preferred_batch_id is not None and lead.status in ['New', 'Nurture', 'On Break']:
            lead.status = 'Followed up with message'
            # Reset counters when re-activating from Nurture or On Break
            if old_status in ['Nurture', 'On Break']:
                lead.reschedule_count = 0
                lead.nudge_count = 0
                # Also reset grace_nudge_count if there's an associated student
                # If coming from 'On Break', re-activate the student
                from backend.models import Student
                student = db.exec(select(Student).where(Student.lead_id == lead.id)).first()
                if student:
                    student.grace_nudge_count = 0
                    if old_status == 'On Break':
                        student.is_active = True  # Re-activate student
                    db.add(student)
    
    # Update last_updated timestamp and set next_followup_date to now
    # This ensures the lead appears at top of Sales Rep's Action Queue immediately
    from datetime import datetime
    lead.last_updated = datetime.utcnow()
    lead.next_followup_date = datetime.utcnow()
    
    # Log the status change if it occurred
    if old_status != lead.status:
        from backend.core.audit import log_status_change, log_lead_activity
        log_status_change(
            db,
            lead_id=lead.id,
            user_id=None,  # Public update, no user ID
            old_status=old_status,
            new_status=lead.status
        )
        log_lead_activity(
            db,
            lead_id=lead.id,
            user_id=None,
            action_type='status_change',
            description='Status updated via public preference form',
            old_value=old_status,
            new_value=lead.status
        )
    
    db.add(lead)
    db.commit()
    db.refresh(lead)
    
    return lead


def record_lead_feedback_by_token(
    db: Session,
    token: str,
    loss_reason: str,
    loss_reason_notes: Optional[str] = None
) -> Optional[Lead]:
    """
    Record feedback from a lead who is not interested (via public feedback page).
    Sets status to 'Dead/Not Interested', do_not_contact to True, saves loss_reason,
    and deactivates associated student if exists.
    
    Args:
        db: Database session
        token: Public token for the lead
        loss_reason: Reason for not joining
        loss_reason_notes: Optional additional notes
        
    Returns:
        Updated Lead object, or None if token not found
    """
    from datetime import datetime
    from backend.core.audit import log_status_change, log_lead_activity
    from backend.models import Student
    
    # Find lead by token
    lead = db.exec(select(Lead).where(Lead.public_token == token)).first()
    if not lead:
        return None
    
    # Store old status for audit logging
    old_status = lead.status
    
    # Update lead with feedback
    lead.status = 'Dead/Not Interested'
    lead.loss_reason = loss_reason
    lead.loss_reason_notes = loss_reason_notes
    lead.do_not_contact = True
    lead.next_followup_date = None
    lead.last_updated = datetime.utcnow()
    
    # Deactivate associated student if exists (for renewal "NO" path)
    student = db.exec(select(Student).where(Student.lead_id == lead.id)).first()
    if student:
        student.is_active = False
        db.add(student)
        log_lead_activity(
            db,
            lead_id=lead.id,
            user_id=None,
            action_type='student_deactivated',
            description=f'Student deactivated due to non-renewal feedback: {loss_reason}',
            old_value='True',
            new_value='False'
        )
    
    # Log the status change
    log_status_change(
        db,
        lead_id=lead.id,
        user_id=None,  # Public update, no user ID
        old_status=old_status,
        new_status=lead.status
    )
    log_lead_activity(
        db,
        lead_id=lead.id,
        user_id=None,
        action_type='status_change',
        description=f'Feedback recorded via public form: {loss_reason}',
        old_value=old_status,
        new_value=lead.status
    )
    
    db.add(lead)
    db.commit()
    db.refresh(lead)
    
    return lead

