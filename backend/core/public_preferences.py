"""
Public preferences business logic.
Framework-agnostic operations for public lead preferences.
"""
from datetime import datetime, timedelta
from urllib.parse import quote
from sqlmodel import Session, select, and_
from typing import Optional, Dict, List, Any
from backend.models import Lead, Batch, Center, User, UserCenterLink
from backend.core.age_utils import calculate_age

LINK_EXPIRY_DAYS = 7


def _to_maps_url(location: str) -> str:
    """Convert location string to Google Maps URL (use as-is if already a URL)."""
    if not location or not location.strip():
        return ""
    s = location.strip()
    if s.startswith("http://") or s.startswith("https://"):
        return s
    return f"https://www.google.com/maps/search/?api=1&query={quote(s)}"


def get_lead_preferences_by_token(db: Session, token: str) -> Optional[Dict[str, Any]]:
    """
    Get lead preferences data by public token.
    
    Args:
        db: Database session
        token: Public token for the lead
        
    Returns:
        Dictionary with player_name, center_name, batches (all active batches at center),
        demo_batches, and current preferences. No age-based filtering - parents see all sessions.
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

    # Time-based expiry: if lead created >7 days ago and preferences not yet submitted, treat as expired
    prefs_submitted = getattr(lead, "preferences_submitted", False)
    created = lead.created_time
    if isinstance(created, datetime):
        cutoff = datetime.utcnow() - timedelta(days=LINK_EXPIRY_DAYS)
        created_naive = created.replace(tzinfo=None) if created.tzinfo else created
        if not prefs_submitted and created_naive < cutoff:
            # Build minimal response with center_head for Contact button
            location_link = ""
            map_link = getattr(center, "map_link", None)
            if map_link and str(map_link).strip():
                location_link = map_link.strip()
            else:
                search_parts = [center.display_name]
                if center.location and center.location.strip():
                    search_parts.append(center.location.strip())
                query = " ".join(search_parts)
                location_link = _to_maps_url(query) if query else ""
            center_head: Optional[Dict[str, Any]] = None
            links = db.exec(
                select(UserCenterLink).where(UserCenterLink.center_id == center.id)
            ).all()
            user_ids = [l.user_id for l in links if l.user_id]
            if user_ids:
                users = db.exec(
                    select(User)
                    .where(and_(User.id.in_(user_ids), User.is_active == True, User.role == "team_member"))
                    .order_by(User.id.asc())
                ).all()
                if users:
                    u = users[0]
                    center_head = {"name": u.full_name or u.email, "phone": u.phone or None}
            return {
                "player_name": lead.player_name,
                "center_name": center.display_name,
                "preferences_submitted": False,
                "link_expired": True,
                "location_link": location_link,
                "center_head": center_head,
                "player_age": None,
                "batches": [],
                "demo_batches": [],
                "preferred_batch_id": None,
                "preferred_demo_batch_id": None,
                "preferred_call_time": None,
                "preferred_timing_notes": None,
                "status": lead.status,
                "reschedule_count": lead.reschedule_count or 0,
            }
    
    # Get ALL active batches at this center (center + is_active only; no age filtering)
    batches = list(db.exec(
        select(Batch).where(
            and_(Batch.center_id == center.id, Batch.is_active == True)
        )
    ).all())
    demo_batches = batches.copy()

    # Lead age for display only (never used for filtering)
    lead_age = calculate_age(lead.date_of_birth)

    # Location link: Prefer center.map_link; else Google Maps search for [display_name] + [location]
    map_link = getattr(center, "map_link", None)
    if map_link and str(map_link).strip():
        location_link = map_link.strip()
    else:
        search_parts = [center.display_name]
        if center.location and center.location.strip():
            search_parts.append(center.location.strip())
        query = " ".join(search_parts)
        location_link = _to_maps_url(query) if query else ""

    # Center head: Team Member assigned to this center; if multiple, pick the one created first (lowest id)
    center_head: Optional[Dict[str, Any]] = None
    links = db.exec(
        select(UserCenterLink).where(UserCenterLink.center_id == center.id)
    ).all()
    user_ids = [l.user_id for l in links if l.user_id]
    if user_ids:
        users = db.exec(
            select(User)
            .where(and_(User.id.in_(user_ids), User.is_active == True, User.role == "team_member"))
            .order_by(User.id.asc())
        ).all()
        if users:
            u = users[0]
            center_head = {
                "name": u.full_name or u.email,
                "phone": u.phone or None,
            }

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
            "min_age": getattr(batch, 'min_age', 0),
            "max_age": getattr(batch, 'max_age', 99),
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
        
        is_different_age = False  # Same age filter used for demo
        
        demo_batches_list.append({
            "id": batch.id,
            "name": batch.name,
            "min_age": getattr(batch, 'min_age', 0),
            "max_age": getattr(batch, 'max_age', 99),
            "schedule": schedule_str,
            "time": time_str,
            "max_capacity": batch.max_capacity,
            "is_different_age": is_different_age,  # Flag to show this is nearest age, not exact
        })
    
    # Privacy: never return lead.phone, lead.email, or lead.address to public link
    return {
        "player_name": lead.player_name,
        "link_expired": False,
        "center_name": center.display_name,
        "preferences_submitted": getattr(lead, "preferences_submitted", False),
        "location_link": location_link,
        "center_head": center_head,
        "player_age": lead_age,  # Age derived from DOB
        "batches": batches_list,  # All active batches at center (no age filter)
        "demo_batches": demo_batches_list,  # Same; age is label-only
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

    # Submit-once: reject preference updates if already submitted (allow loss_reason path)
    if getattr(lead, 'preferences_submitted', False) and not loss_reason:
        raise ValueError("Preferences have already been submitted.")
    
    # Validate preferred_batch_id if provided (must be at same center)
    if preferred_batch_id is not None:
        batch = db.get(Batch, preferred_batch_id)
        if not batch:
            raise ValueError(f"Batch {preferred_batch_id} not found")
        if batch.center_id != lead.center_id:
            raise ValueError("Batch must be at the same center as the lead")
    
    # Validate preferred_demo_batch_id if provided (demo batch - can be nearest age)
    if preferred_demo_batch_id is not None:
        demo_batch = db.get(Batch, preferred_demo_batch_id)
        if not demo_batch:
            raise ValueError(f"Demo batch {preferred_demo_batch_id} not found")
        # Ensure batch is at the same center
        if demo_batch.center_id != lead.center_id:
            raise ValueError("Demo batch must be at the same center as the lead")
    
    # Store old status for audit logging
    old_status = lead.status
    
    # Handle loss reason (dead/not interested)
    if loss_reason:
        lead.status_at_loss = lead.status  # Stage when they said no
        lead.loss_reason = loss_reason
        lead.loss_reason_notes = loss_reason_notes
        lead.status = 'Dead/Not Interested'
        lead.do_not_contact = True
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

        # Store preference submission timestamp for analytics (time-to-contact)
        if lead.extra_data is None:
            lead.extra_data = {}
        if isinstance(lead.extra_data, dict) and (preferred_batch_id is not None or preferred_call_time is not None or preferred_demo_batch_id is not None):
            from datetime import datetime
            lead.extra_data["preference_submitted_at"] = datetime.utcnow().isoformat()

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
    
    lead.preferences_submitted = True
    db.add(lead)
    db.commit()
    db.refresh(lead)

    # Preference response alert to Center Head (only when preferences submitted, not loss)
    # Runs after commit so lead and center are persisted.
    if not loss_reason and (preferred_batch_id is not None or preferred_demo_batch_id is not None or preferred_call_time is not None):
        import logging
        from backend.core.emails import send_internal_notification, get_crm_base_url
        _log = logging.getLogger(__name__)
        lead_name = lead.player_name or "Player"
        center_name = "Unknown"
        if lead.center_id:
            center = db.get(Center, lead.center_id)
            center_name = (center.display_name or center.city or "Unknown") if center else "Unknown"
        try:
            preferred_batch_name = "—"
            if preferred_batch_id is not None:
                b = db.get(Batch, preferred_batch_id)
                preferred_batch_name = b.name if b else str(preferred_batch_id)
            elif preferred_demo_batch_id is not None:
                b = db.get(Batch, preferred_demo_batch_id)
                preferred_batch_name = b.name if b else str(preferred_demo_batch_id)
            call_time = preferred_call_time or "—"
            base_url = get_crm_base_url()
            link = f"{base_url}/leads?search={quote(lead.phone or '')}" if lead.phone else f"{base_url}/leads"
            subject = f"🎯 INTENT RECEIVED: {lead_name} - ({center_name})"
            current_status = (lead.status or "—").strip() or "—"
            body = (
                f"Player Name: {lead_name}\n"
                f"Current Status: {current_status}\n"
                f"Preferred Batch: {preferred_batch_name}\n"
                f"Best Time to Call: {call_time}\n"
                f"Link: {link}"
            )
            print(f"Attempting to send intent email for {lead_name} (center_id={lead.center_id})")
            send_internal_notification(
                db,
                lead.center_id,
                subject,
                body,
                card_heading="A parent has just submitted their training preferences!",
                highlight_labels={"Preferred Batch", "Best Time to Call"},
            )
            # High-priority bell: Preferences Received (Email + Bell)
            try:
                from backend.core.notifications import notify_center_users
                notify_center_users(
                    db, lead.center_id,
                    type="SALES_ALERT",
                    title=f"🎯 Intent: {lead_name} submitted preferences",
                    message=f"Preferred Batch: {preferred_batch_name}. Call Time: {call_time}.",
                    link=link,
                    priority="high",
                )
            except Exception as _:
                pass
        except Exception as e:
            print(f"[Intent email] FAILED for {lead_name}: {e}")
            _log.exception("Preference response email alert failed: %s", e)

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
    
    # Store old status for audit logging and lifecycle stage at loss
    old_status = lead.status
    lead.status_at_loss = old_status
    
    # Update lead with feedback
    lead.status = 'Dead/Not Interested'
    lead.loss_reason = loss_reason
    lead.loss_reason_notes = loss_reason_notes
    lead.do_not_contact = True
    lead.next_followup_date = None
    lead.last_updated = datetime.utcnow()
    lead.preferences_submitted = True  # Submit-once
    
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

