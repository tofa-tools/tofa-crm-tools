"""
Public preferences business logic.
Framework-agnostic operations for public lead preferences.
"""
from sqlmodel import Session, select
from typing import Optional, Dict, List, Any
from backend.models import Lead, Batch, Center


def get_nearest_age_categories(age_category: str) -> List[str]:
    """
    Get nearest age categories for fallback when exact match not found.
    
    Age category order: U7, U9, U11, U13, U15, U17, Senior
    
    Args:
        age_category: The target age category
        
    Returns:
        List of nearest age categories to try
    """
    age_order = ["U7", "U9", "U11", "U13", "U15", "U17", "Senior"]
    
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
    
    # Get batches at this center that match the lead's age category (for permanent batch)
    batches = db.exec(
        select(Batch).where(
            Batch.center_id == center.id,
            Batch.age_category == lead.player_age_category
        )
    ).all()
    
    # Get demo batches - try exact age category first, then nearest age categories
    age_categories_to_try = get_nearest_age_categories(lead.player_age_category)
    demo_batches = []
    seen_batch_ids = set()
    
    for age_cat in age_categories_to_try:
        age_batches = db.exec(
            select(Batch).where(
                Batch.center_id == center.id,
                Batch.age_category == age_cat
            )
        ).all()
        
        for batch in age_batches:
            if batch.id not in seen_batch_ids:
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
        is_different_age = batch.age_category != lead.player_age_category
        
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
        if batch.age_category != lead.player_age_category:
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
    
    # Update preferences
    if preferred_batch_id is not None:
        lead.preferred_batch_id = preferred_batch_id
    if preferred_demo_batch_id is not None:
        lead.trial_batch_id = preferred_demo_batch_id  # Store demo preference in trial_batch_id
    if preferred_call_time is not None:
        lead.preferred_call_time = preferred_call_time
    if preferred_timing_notes is not None:
        lead.preferred_timing_notes = preferred_timing_notes
    
    # Update last_updated timestamp and set next_followup_date to now
    # This ensures the lead appears at top of Sales Rep's Action Queue immediately
    from datetime import datetime
    lead.last_updated = datetime.utcnow()
    lead.next_followup_date = datetime.utcnow()
    
    db.add(lead)
    db.commit()
    db.refresh(lead)
    
    return lead

