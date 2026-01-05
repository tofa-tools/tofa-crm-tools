"""
User statistics and gamification logic.
Framework-agnostic user activity tracking.
"""
from sqlmodel import Session, select, func
from typing import Optional, Dict
from datetime import datetime, date, timedelta
from backend.models import User, AuditLog, Lead


def get_user_completion_streak(db: Session, user_id: int) -> Dict[str, int]:
    """
    Calculate user's task completion streak.
    
    A "completion day" is defined as a day where the user:
    - Updated at least one lead status (completed a task)
    - Or added at least one comment (showed activity)
    
    Returns:
        Dictionary with:
        {
            "current_streak": 3,  # Days in a row
            "longest_streak": 7,  # Best streak ever
            "total_completion_days": 15  # Total days with activity
        }
    """
    # Get all audit logs for this user (status changes and comments)
    # Note: AuditLog uses action_type field
    query = select(AuditLog).where(
        AuditLog.user_id == user_id
    ).order_by(AuditLog.timestamp.desc())
    
    # Filter in Python since we need to check action_type
    all_logs = list(db.exec(query).all())
    logs = [log for log in all_logs if log.action_type in ["status_change", "comment_added"]]
    
    if not logs:
        return {
            "current_streak": 0,
            "longest_streak": 0,
            "total_completion_days": 0
        }
    
    # Get unique dates with activity
    activity_dates = set()
    for log in logs:
        log_date = log.timestamp.date() if isinstance(log.timestamp, datetime) else log.timestamp
        activity_dates.add(log_date)
    
    activity_dates_list = sorted(list(activity_dates), reverse=True)
    total_completion_days = len(activity_dates_list)
    
    # Calculate current streak (consecutive days from today backwards)
    current_streak = 0
    today = date.today()
    check_date = today
    
    for activity_date in activity_dates_list:
        if activity_date == check_date:
            current_streak += 1
            check_date = check_date - timedelta(days=1)
        elif activity_date < check_date:
            # Gap found, streak broken
            break
    
    # Calculate longest streak
    longest_streak = 1
    if len(activity_dates_list) > 1:
        current_longest = 1
        for i in range(1, len(activity_dates_list)):
            prev_date = activity_dates_list[i-1]
            curr_date = activity_dates_list[i]
            if (prev_date - curr_date).days == 1:
                current_longest += 1
                longest_streak = max(longest_streak, current_longest)
            else:
                current_longest = 1
    
    return {
        "current_streak": current_streak,
        "longest_streak": longest_streak,
        "total_completion_days": total_completion_days
    }


def get_user_today_completion_stats(db: Session, user_id: int, target_date: Optional[date] = None) -> Dict[str, int]:
    """
    Get user's completion stats for today.
    
    Returns:
        {
            "tasks_completed": 5,  # Status changes today
            "comments_added": 3,   # Comments added today
            "leads_updated": 7     # Unique leads updated today
        }
    """
    if target_date is None:
        target_date = date.today()
    
    date_start = datetime.combine(target_date, datetime.min.time())
    date_end = datetime.combine(target_date, datetime.max.time())
    
    # Get all audit logs for today
    query = select(AuditLog).where(
        AuditLog.user_id == user_id,
        AuditLog.timestamp >= date_start,
        AuditLog.timestamp <= date_end
    )
    
    logs = list(db.exec(query).all())
    
    tasks_completed = len([l for l in logs if l.action_type == "status_change"])
    comments_added = len([l for l in logs if l.action_type == "comment_added"])
    leads_updated = len(set([l.lead_id for l in logs]))
    
    return {
        "tasks_completed": tasks_completed,
        "comments_added": comments_added,
        "leads_updated": leads_updated
    }

