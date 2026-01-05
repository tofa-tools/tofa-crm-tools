"""
Automatic task creation logic.
Framework-agnostic automation for lead follow-ups.
"""
from sqlmodel import Session, select
from typing import List, Optional
from datetime import datetime, timedelta
from backend.models import Lead


def should_create_idle_lead_task(lead: Lead) -> bool:
    """
    Check if a lead has been idle (no updates) for 3+ days and needs a nudge task.
    
    A lead is considered "idle" if:
    - Status is "Called" (has been contacted but not progressed)
    - last_updated is more than 3 days ago
    - No next_followup_date set (or it's in the past)
    """
    if lead.status != "Called":
        return False
    
    if not lead.last_updated:
        # Use created_time as fallback
        days_idle = (datetime.utcnow() - lead.created_time).days
    else:
        days_idle = (datetime.utcnow() - lead.last_updated).days
    
    # Idle for 3+ days
    if days_idle < 3:
        return False
    
    # No upcoming follow-up date (or it's in the past)
    if lead.next_followup_date:
        if lead.next_followup_date > datetime.utcnow():
            return False  # Already has a future follow-up
    
    return True


def get_idle_leads_needing_tasks(db: Session, user_id: Optional[int] = None) -> List[Lead]:
    """
    Get all leads that need idle nudge tasks created.
    
    Args:
        db: Database session
        user_id: Optional user ID to filter by (for user-specific idle checks)
        
    Returns:
        List of Lead objects that need idle tasks
    """
    query = select(Lead).where(
        Lead.status == "Called",
        Lead.next_followup_date.is_(None) | (Lead.next_followup_date < datetime.utcnow())
    )
    
    if user_id:
        # This would need to be filtered by user's centers
        # For now, return all idle leads
        pass
    
    leads = list(db.exec(query).all())
    
    # Filter to only those that are actually idle (3+ days)
    idle_leads = [lead for lead in leads if should_create_idle_lead_task(lead)]
    
    return idle_leads


def auto_create_followup_task(lead: Lead, days_ahead: int = 1) -> datetime:
    """
    Auto-create a follow-up task by setting next_followup_date.
    
    Args:
        lead: Lead object
        days_ahead: How many days in the future to schedule (default: tomorrow)
        
    Returns:
        The scheduled datetime
    """
    scheduled_date = datetime.utcnow() + timedelta(days=days_ahead)
    # Set to 9 AM local time (you can adjust this)
    scheduled_date = scheduled_date.replace(hour=9, minute=0, second=0, microsecond=0)
    return scheduled_date


def handle_trial_scheduled_auto_tasks(db: Session, lead: Lead) -> None:
    """
    When a lead status changes to "Trial Scheduled", automatically create:
    1. Reminder: 1 hour before the trial (if trial time is known)
    2. Feedback: 24 hours after the trial
    
    Note: This function assumes next_followup_date is the trial date/time.
    If you have a separate trial_date field, use that instead.
    """
    if lead.status != "Trial Scheduled":
        return
    
    if not lead.next_followup_date:
        # No trial date set, can't create reminders
        return
    
    # For now, we'll just ensure next_followup_date is set to the trial date
    # The reminder logic would need to:
    # 1. Create a task 1 hour before trial (if trial time is known)
    # 2. Create a task 24 hours after trial
    
    # This is a placeholder - actual implementation would create separate Task records
    # For now, we rely on next_followup_date being set to the trial date
    pass


def handle_joined_or_dead_cleanup(lead: Lead) -> None:
    """
    When a lead is marked as "Joined" or "Dead/Not Interested",
    clear all future tasks (set next_followup_date to None).
    
    This is called automatically when status changes to these values.
    """
    if lead.status in ["Joined", "Dead/Not Interested"]:
        lead.next_followup_date = None
        # If you have a separate Task table, you'd also delete/invalidate those tasks here

