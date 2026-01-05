"""
Task queue and calendar management logic.
Framework-agnostic task utilities for lead follow-ups.
"""
from sqlmodel import Session, select, func, and_, or_
from typing import List, Dict, Optional, Tuple
from datetime import datetime, date, timedelta
from backend.models import Lead, User, Center


def get_daily_task_queue(
    db: Session,
    user: User,
    target_date: Optional[date] = None
) -> Dict[str, List[Lead]]:
    """
    Get tasks for the daily queue, organized by priority.
    
    Tasks are ordered by:
    1. Overdue (oldest first) - tasks with next_followup_date < today
    2. Due Today - tasks with next_followup_date == today
    3. Upcoming - tasks with next_followup_date > today (next 7 days)
    
    A task only appears if:
    - The lead's center is assigned to the user (or user is team_lead)
    - The lead is not in "Joined" or "Dead/Not Interested" status
    - The lead has a next_followup_date set
    
    Args:
        db: Database session
        user: User to get tasks for
        target_date: Date to calculate "today" relative to (defaults to today)
        
    Returns:
        Dictionary with keys: 'overdue', 'due_today', 'upcoming'
        Each contains a list of Lead objects
    """
    if target_date is None:
        target_date = date.today()
    
    today_start = datetime.combine(target_date, datetime.min.time())
    today_end = datetime.combine(target_date, datetime.max.time())
    week_end = today_end + timedelta(days=7)
    
    # Base query - leads that are active and have follow-up dates
    query = select(Lead).where(
        and_(
            Lead.next_followup_date.isnot(None),
            Lead.status.notin_(["Joined", "Dead/Not Interested", "Nurture"])
        )
    )
    
    # Filter by user's centers (unless team_lead)
    if user.role != "team_lead":
        user_center_ids = [c.id for c in user.centers]
        if not user_center_ids:
            # User has no centers, return empty results
            return {"overdue": [], "due_today": [], "upcoming": []}
        query = query.where(Lead.center_id.in_(user_center_ids))
    
    leads = list(db.exec(query).all())
    
    # Categorize leads
    overdue = []
    due_today = []
    upcoming = []
    
    for lead in leads:
        if not lead.next_followup_date:
            continue
        
        followup_date = lead.next_followup_date.date() if isinstance(lead.next_followup_date, datetime) else lead.next_followup_date
        
        if followup_date < target_date:
            overdue.append(lead)
        elif followup_date == target_date:
            due_today.append(lead)
        elif followup_date <= target_date + timedelta(days=7):
            upcoming.append(lead)
    
    # Sort overdue by oldest first, upcoming by soonest first
    overdue.sort(key=lambda x: x.next_followup_date)
    upcoming.sort(key=lambda x: x.next_followup_date)
    
    return {
        "overdue": overdue,
        "due_today": due_today,
        "upcoming": upcoming
    }


def get_calendar_month_view(
    db: Session,
    user: User,
    year: int,
    month: int,
    center_ids: Optional[List[int]] = None
) -> Dict[str, Dict[str, int]]:
    """
    Get calendar data for a specific month with workload heatmap.
    
    Args:
        db: Database session
        user: User requesting the calendar
        year: Year (e.g., 2024)
        month: Month (1-12)
        center_ids: Optional list of center IDs to filter by (None = all accessible)
        
    Returns:
        Dictionary mapping date strings (YYYY-MM-DD) to workload data:
        {
            "2024-01-15": {
                "total": 10,
                "high_priority": 3,
                "trials": 2,
                "calls": 8
            },
            ...
        }
    """
    from calendar import monthrange
    
    # Calculate date range for the month
    first_day = date(year, month, 1)
    last_day_num = monthrange(year, month)[1]
    last_day = date(year, month, last_day_num)
    
    month_start = datetime.combine(first_day, datetime.min.time())
    month_end = datetime.combine(last_day, datetime.max.time())
    
    # Base query
    query = select(Lead).where(
        and_(
            Lead.next_followup_date.isnot(None),
            Lead.next_followup_date >= month_start,
            Lead.next_followup_date <= month_end,
            Lead.status.notin_(["Joined", "Dead/Not Interested", "Nurture"])
        )
    )
    
    # Filter by centers
    if user.role != "team_lead":
        user_center_ids = [c.id for c in user.centers]
        if not user_center_ids:
            return {}
        query = query.where(Lead.center_id.in_(user_center_ids))
    elif center_ids:
        query = query.where(Lead.center_id.in_(center_ids))
    
    leads = list(db.exec(query).all())
    
    # Group by date
    calendar_data = {}
    
    for lead in leads:
        if not lead.next_followup_date:
            continue
        
        followup_date = lead.next_followup_date.date() if isinstance(lead.next_followup_date, datetime) else lead.next_followup_date
        date_key = followup_date.isoformat()
        
        if date_key not in calendar_data:
            calendar_data[date_key] = {
                "total": 0,
                "high_priority": 0,  # Overdue or "Trial Scheduled"
                "trials": 0,
                "calls": 0
            }
        
        calendar_data[date_key]["total"] += 1
        
        # High priority: overdue, or status is "Trial Scheduled"
        if followup_date < date.today() or lead.status == "Trial Scheduled":
            calendar_data[date_key]["high_priority"] += 1
        
        # Count by type
        if lead.status == "Trial Scheduled":
            calendar_data[date_key]["trials"] += 1
        elif lead.status in ["Called", "New"]:
            calendar_data[date_key]["calls"] += 1
    
    return calendar_data


def get_daily_stats(
    db: Session,
    user: User,
    target_date: Optional[date] = None
) -> Dict[str, int]:
    """
    Get daily vital stats for the task queue header.
    
    Returns:
        Dictionary with stats like:
        {
            "total_tasks": 12,
            "high_priority": 3,
            "overdue_count": 2,
            "due_today_count": 10
        }
    """
    if target_date is None:
        target_date = date.today()
    
    tasks = get_daily_task_queue(db, user, target_date)
    
    all_tasks = tasks["overdue"] + tasks["due_today"]
    total_tasks = len(all_tasks)
    
    # Count high priority (overdue + trial scheduled)
    high_priority = len(tasks["overdue"]) + len([
        lead for lead in tasks["due_today"]
        if lead.status == "Trial Scheduled"
    ])
    
    return {
        "total_tasks": total_tasks,
        "high_priority": high_priority,
        "overdue_count": len(tasks["overdue"]),
        "due_today_count": len(tasks["due_today"])
    }

