"""
Analytics and business intelligence functions.
Framework-agnostic analytics utilities.
"""
from sqlmodel import Session, select, func, and_, or_
from typing import Dict, List, Tuple, Optional, Any
from datetime import datetime, timedelta, date, time
from backend.models import Lead, AuditLog, Batch, BatchCoachLink, Attendance, User, Center, Student, StudentBatchLink
from backend.core.staging import get_staging_leads

# Simple 5-minute cache for analytics (avoids DB hit on every page refresh)
_ANALYTICS_CACHE: Dict[str, Tuple[Any, datetime]] = {}
_CACHE_TTL = timedelta(minutes=5)


def _cached(key: str, fn, *args, **kwargs):
    """Return cached result if fresh, else compute and cache."""
    now = datetime.utcnow()
    if key in _ANALYTICS_CACHE:
        val, expiry = _ANALYTICS_CACHE[key]
        if expiry > now:
            return val
    result = fn(*args, **kwargs)
    _ANALYTICS_CACHE[key] = (result, now + _CACHE_TTL)
    return result


def get_student_milestones(db: Session, student_id: int) -> Dict[str, any]:
    """
    Calculate milestones for a student based on attendance.
    
    Args:
        db: Database session
        student_id: Student ID
        
    Returns:
        Dictionary with:
        - total_present: Total number of 'Present' attendance records
        - current_milestone: The milestone the student is closest to (10, 25, 50, 100)
        - next_milestone: The next milestone to reach
        - sessions_until_next: Number of sessions needed to reach next milestone
        - report_unlocked: True if student has reached a 15-session milestone with no report yet
        - current_session_count: Total 'Present' sessions
        - sessions_until_next_report: Sessions needed until next 15-session milestone
    """
    from backend.models import Student
    
    # Count 'Present' attendance records
    total_present = db.exec(
        select(func.count(Attendance.id)).where(
            Attendance.student_id == student_id,
            Attendance.status == 'Present'
        )
    ).first() or 0
    
    # Get student to access skill reports from Lead's extra_data (reports are stored there)
    student = db.get(Student, student_id)
    skill_reports = []
    
    # Skill reports are stored in Lead.extra_data, so we need to get the lead
    if student and student.lead_id:
        from backend.models import Lead
        lead = db.get(Lead, student.lead_id)
        if lead and lead.extra_data and isinstance(lead.extra_data, dict):
            skill_reports = lead.extra_data.get('skill_reports', [])
    
    # Check existing report milestones (15, 30, 45, 60, etc.)
    existing_report_milestones = set()
    for report in skill_reports:
        if isinstance(report, dict) and 'milestone_sessions' in report:
            existing_report_milestones.add(report['milestone_sessions'])
    
    # Calculate report milestones (multiples of 15)
    report_milestones = [15, 30, 45, 60, 75, 90, 105, 120]  # Can extend as needed
    report_unlocked = False
    sessions_until_next_report = None
    next_report_milestone = None
    highest_unreported_milestone = None
    milestone_debt = []  # Track all unreported milestones that have been passed
    
    # MILESTONE DEBT SYSTEM: Check ALL milestones the student has passed
    # If they're at 17 sessions and passed 15 but haven't reported it, report_unlocked should stay True
    for milestone in sorted(report_milestones, reverse=True):
        if total_present >= milestone:
            # Student has reached this milestone
            if milestone not in existing_report_milestones:
                # This milestone hasn't been reported yet - it's a debt
                milestone_debt.append(milestone)
                if highest_unreported_milestone is None:
                    highest_unreported_milestone = milestone
    
    # If there are any unreported milestones (debt), unlock the report
    if milestone_debt:
        report_unlocked = True
    
    # Find the next milestone to reach (for progress display)
    for milestone in report_milestones:
        if total_present < milestone:
            next_report_milestone = milestone
            sessions_until_next_report = milestone - total_present
            break
    
    # If student is past a milestone but hasn't reported it, show debt status
    if highest_unreported_milestone and total_present > highest_unreported_milestone:
        # Student is past the milestone but hasn't reported it
        # Calculate how many sessions past the milestone
        sessions_past_milestone = total_present - highest_unreported_milestone
        # For display purposes, set sessions_until_next_report to 0 to indicate debt
        sessions_until_next_report = 0
    
    # Legacy milestone values (10, 25, 50, 100) for celebration
    milestone_values = [10, 25, 50, 100]
    current_milestone = None
    next_milestone = None
    sessions_until_next = None
    
    # Find current and next milestone
    for milestone in milestone_values:
        if total_present >= milestone:
            current_milestone = milestone
        else:
            next_milestone = milestone
            sessions_until_next = milestone - total_present
            break
    
    return {
        "total_present": total_present,
        "current_session_count": total_present,  # Alias for clarity
        "current_milestone": current_milestone,
        "next_milestone": next_milestone,
        "sessions_until_next": sessions_until_next,
        "report_unlocked": report_unlocked,
        "sessions_until_next_report": sessions_until_next_report,
        "next_report_milestone": next_report_milestone,
        "highest_unreported_milestone": highest_unreported_milestone,  # For debt display
        "milestone_debt": milestone_debt,  # List of all unreported milestones passed
        "has_milestone_debt": len(milestone_debt) > 0,  # Boolean flag for easy checking
    }


def calculate_conversion_rates(db: Session, user_id: Optional[int] = None) -> Dict[str, float]:
    """
    Calculate conversion rates between status transitions using SQL grouping.
    
    Returns a dictionary with conversion rates like:
    {
        'New->Called': 0.75,  # 75% of New leads become Called
        'Called->Trial Scheduled': 0.50,  # 50% of Called leads become Trial Scheduled
        ...
    }
    """
    # Transition counts: (old_value, new_value) -> count
    trans_q = (
        select(AuditLog.old_value, AuditLog.new_value, func.count(AuditLog.id).label("cnt"))
        .where(
            AuditLog.action_type == "status_change",
            AuditLog.old_value.isnot(None),
            AuditLog.new_value.isnot(None),
        )
    )
    if user_id:
        trans_q = trans_q.where(AuditLog.user_id == user_id)
    trans_q = trans_q.group_by(AuditLog.old_value, AuditLog.new_value)
    trans_rows = db.exec(trans_q).all()

    # Status counts: old_value -> total transitions from that status
    status_q = (
        select(AuditLog.old_value, func.count(AuditLog.id).label("cnt"))
        .where(
            AuditLog.action_type == "status_change",
            AuditLog.old_value.isnot(None),
            AuditLog.new_value.isnot(None),
        )
    )
    if user_id:
        status_q = status_q.where(AuditLog.user_id == user_id)
    status_q = status_q.group_by(AuditLog.old_value)
    status_rows = db.exec(status_q).all()

    status_counts = {row.old_value: row.cnt for row in status_rows}
    conversion_rates: Dict[str, float] = {}
    for row in trans_rows:
        transition_key = f"{row.old_value}->{row.new_value}"
        total = status_counts.get(row.old_value, 1)
        conversion_rates[transition_key] = row.cnt / total if total > 0 else 0.0
    return conversion_rates


def get_conversion_funnel(db: Session) -> Dict:
    """
    Business-focused conversion funnel:
    - Engagement: (Leads with preferences set / Total Leads)
    - Commitment: (Trial Scheduled / Total Leads)
    - Success: (Joined / Trial Attended) - Trial Attended approximated by Trial Scheduled count
    """
    total_leads = db.exec(select(func.count(Lead.id))).first() or 0
    if total_leads == 0:
        return {
            "engagement": {"rate": 0.0, "numerator": 0, "denominator": 0},
            "commitment": {"rate": 0.0, "numerator": 0, "denominator": 0},
            "success": {"rate": 0.0, "numerator": 0, "denominator": 0},
        }

    # Engagement: Leads with preferences set (preferred_batch_id or preferred_call_time)
    with_prefs = db.exec(
        select(func.count(Lead.id)).where(
            or_(Lead.preferred_batch_id.isnot(None), Lead.preferred_call_time.isnot(None))
        )
    ).first() or 0
    eng_rate = with_prefs / total_leads if total_leads > 0 else 0.0

    # Commitment: Trial Scheduled count
    trial_scheduled = db.exec(
        select(func.count(Lead.id)).where(Lead.status == "Trial Scheduled")
    ).first() or 0
    commitment_rate = trial_scheduled / total_leads if total_leads > 0 else 0.0

    # Success: Joined / Trial Attended. Use Trial Scheduled as proxy for Trial Attended (includes current + those who moved on)
    joined = db.exec(select(func.count(Lead.id)).where(Lead.status == "Joined")).first() or 0
    trial_attended = trial_scheduled + joined
    success_rate = joined / trial_attended if trial_attended > 0 else 0.0

    return {
        "engagement": {"rate": eng_rate, "numerator": with_prefs, "denominator": total_leads},
        "commitment": {"rate": commitment_rate, "numerator": trial_scheduled, "denominator": total_leads},
        "success": {"rate": success_rate, "numerator": joined, "denominator": trial_attended},
    }


def get_conversion_funnel_cached(db: Session) -> Dict:
    """Cached version of get_conversion_funnel (5 min TTL)."""
    return _cached("funnel", get_conversion_funnel, db)


def calculate_average_time_to_contact_cached(db: Session) -> Optional[float]:
    """Cached version of calculate_average_time_to_contact (5 min TTL)."""
    return _cached("time_to_contact", calculate_average_time_to_contact, db)


def get_conversion_rates_cached(db: Session) -> Dict:
    """Cached conversion rates + funnel (5 min TTL)."""
    def _fetch(_db):
        return {"conversion_rates": calculate_conversion_rates(_db), "funnel": get_conversion_funnel(_db)}
    return _cached("conversion_rates", _fetch, db)


def calculate_average_time_to_contact(db: Session) -> Optional[float]:
    """
    Calculate average time (in hours) from Parent Preference Submission to status changing to 'Called'.
    
    Uses preference_submitted_at in lead.extra_data (set when preferences are submitted via public form)
    and AuditLog for when status changed to 'Called'.
    
    Returns average hours, or None if no data available.
    """
    # First "Called" timestamp per lead via SQL (single query)
    first_called_q = (
        select(AuditLog.lead_id, func.min(AuditLog.timestamp).label("first_called"))
        .where(
            AuditLog.action_type == "status_change",
            AuditLog.new_value == "Called",
            AuditLog.lead_id.isnot(None),
        )
        .group_by(AuditLog.lead_id)
    )
    first_called_rows = db.exec(first_called_q).all()
    if not first_called_rows:
        return None

    lead_ids = [r.lead_id for r in first_called_rows if r.lead_id]
    if not lead_ids:
        return None

    # Batch-fetch leads with preference_submitted_at (single query, filter by id in list)
    leads = db.exec(select(Lead).where(Lead.id.in_(lead_ids))).all()
    lead_pref: Dict[int, str] = {}
    for lead in leads:
        if lead and lead.extra_data and isinstance(lead.extra_data, dict):
            pref = lead.extra_data.get("preference_submitted_at")
            if pref:
                lead_pref[lead.id] = pref

    total_hours = 0.0
    count = 0
    for row in first_called_rows:
        lead_id = row.lead_id
        pref_at = lead_pref.get(lead_id) if lead_id else None
        if not pref_at:
            continue
        try:
            pref_time = datetime.fromisoformat(pref_at.replace("Z", "+00:00"))
            ct = row.first_called.replace(tzinfo=None) if row.first_called.tzinfo else row.first_called
            pt = pref_time.replace(tzinfo=None) if pref_time.tzinfo else pref_time
            hours = (ct - pt).total_seconds() / 3600.0
            if 0 <= hours <= 8760:  # Sanity: 0 to 1 year
                total_hours += hours
                count += 1
        except (ValueError, TypeError):
            continue

    return total_hours / count if count > 0 else None


def get_status_distribution(db: Session) -> Dict[str, int]:
    """
    Get count of leads per status.
    
    Returns dictionary like: {'New': 50, 'Called': 30, 'Joined': 20, ...}
    """
    query = select(Lead.status, func.count(Lead.id)).group_by(Lead.status)
    results = db.exec(query).all()
    
    return {status: count for status, count in results}


def get_command_center_analytics(
    db: Session,
    user: User,
    target_date: Optional[date] = None
) -> Dict:
    """
    Get command center analytics based on user role.
    
    For Sales (team_lead, team_member):
    - Today's Progress: (Leads updated/commented today / Total leads due today)
    - Pending Trials: Count of leads with status 'New' or 'Called' (not yet booked for trial)
    - Overdue: Count of leads with next_followup_date in the past
    - Trial Show-Up: (Trials marked Present today / Total Trials scheduled for today)
    
    For Coach:
    - Session Coverage: (Attendance records created today / Total Batches scheduled for today)
    - New Arrivals: Count of 'Trial Scheduled' leads assigned to coach's batches for today
    - Skill Report Backlog: Count of 'Joined' students in coach's batches with no skill report in last 60 days
    - Capacity Warning: Count of assigned batches at >90% max_capacity
    
    Args:
        db: Database session
        user: Current user
        target_date: Date to calculate metrics for (defaults to today)
        
    Returns:
        Dictionary with role-specific metrics
    """
    if target_date is None:
        target_date = date.today()
    
    from datetime import time
    today_start = datetime.combine(target_date, time.min)
    today_end = datetime.combine(target_date, time.max)
    
    if user.role == "coach":
        return _get_coach_command_center_analytics(db, user, target_date, today_start, today_end)
    else:
        result = _get_sales_command_center_analytics(db, user, target_date, today_start, today_end)
        
        # Add new batch opportunities for sales users
        if user.role in ["team_lead", "team_member"]:
            result["new_batch_opportunities"] = get_new_batch_opportunities(db, user)
        
        # For team_lead, add executive analytics
        if user.role == "team_lead":
            result["executive_data"] = _get_executive_analytics(db)
        
        return result


def _get_sales_command_center_analytics(
    db: Session,
    user: User,
    target_date: date,
    today_start: datetime,
    today_end: datetime
) -> Dict:
    """Get sales-focused command center analytics."""
    # Base query for user's leads
    base_query = select(Lead).where(
        Lead.status.notin_(["Joined", "Dead/Not Interested", "Nurture"])
    )
    
    # Filter by user's centers (unless team_lead)
    if user.role != "team_lead":
        center_ids = [c.id for c in user.centers]
        if center_ids:
            base_query = base_query.where(Lead.center_id.in_(center_ids))
        else:
            # User has no centers, return zeros
            return {
                "today_progress": 0.0,
                "today_progress_count": 0,
                "today_total_due": 0,
                "unscheduled": 0,
                "overdue": 0,
                "trial_show_up_rate": 0.0,
                "trial_show_up_count": 0,
                "trial_total_scheduled": 0,
                "hot_trials_count": 0,
                "reschedule_count": 0,
                "post_trial_no_response_count": 0,
                "expiring_soon_count": 0,
                "staging_leads_count": 0,
                "nudge_failures_count": 0,
            }
    
    all_leads = list(db.exec(base_query).all())
    
    # Today's Progress: Leads updated/commented today / Total leads due today
    leads_due_today = [l for l in all_leads if l.next_followup_date and l.next_followup_date.date() == target_date]
    total_due_today = len(leads_due_today)
    
    # Count leads updated or commented today
    updated_today_ids = set()
    # Check last_updated timestamp
    for lead in leads_due_today:
        if lead.last_updated and lead.last_updated >= today_start and lead.last_updated <= today_end:
            updated_today_ids.add(lead.id)
    
    # Check comments/audit logs from today
    comments_today = db.exec(
        select(AuditLog.lead_id).where(
            and_(
                AuditLog.timestamp >= today_start,
                AuditLog.timestamp <= today_end,
                AuditLog.action_type.in_(["comment_added", "status_change"])
            )
        )
    ).all()
    updated_today_ids.update(comments_today)
    
    today_progress_count = len(updated_today_ids)
    today_progress = (today_progress_count / total_due_today * 100) if total_due_today > 0 else 0.0
    
    # Pending Trials: Leads with status 'New' or 'Called' (not yet booked for trial)
    unscheduled = len([l for l in all_leads if l.status in ["New", "Called"]])
    
    # Overdue: Leads with next_followup_date in the past
    overdue = len([l for l in all_leads if l.next_followup_date and l.next_followup_date.date() < target_date])
    
    # Trial Show-Up: Trials marked Present today / Total Trials scheduled for today
    trials_today = [l for l in all_leads if l.status == "Trial Scheduled" and l.next_followup_date and l.next_followup_date.date() == target_date]
    trial_total_scheduled = len(trials_today)
    
    # Count trials marked as Present today via attendance
    trial_ids = [l.id for l in trials_today]
    trials_marked_present = 0
    if trial_ids:
        present_attendance = db.exec(
            select(func.count(Attendance.id)).where(
                and_(
                    Attendance.lead_id.in_(trial_ids),
                    Attendance.date == target_date,
                    Attendance.status == "Present"
                )
            )
        ).first()
        trials_marked_present = present_attendance or 0
    
    trial_show_up_rate = (trials_marked_present / trial_total_scheduled * 100) if trial_total_scheduled > 0 else 0.0
    
    # Hot Trials: Count leads with status 'Trial Attended' where last_updated is within the last 24 hours
    hot_trials_cutoff = datetime.utcnow() - timedelta(hours=24)
    hot_trials_count = len([
        l for l in all_leads 
        if l.status == "Trial Attended" 
        and l.last_updated 
        and l.last_updated >= hot_trials_cutoff
    ])
    
    # Reschedule Count: Count leads that were absent and need rescheduling
    # Logic: status == 'Trial Scheduled' AND (next_followup_date is tomorrow at 10:00 AM OR has Absent attendance in last 24h)
    tomorrow_date = target_date + timedelta(days=1)
    tomorrow_10am = datetime.combine(tomorrow_date, time(10, 0))
    tomorrow_10am_end = datetime.combine(tomorrow_date, time(10, 0, 59))
    
    # Find leads with next_followup_date set to tomorrow at 10:00 AM
    reschedule_leads_by_date = [
        l for l in all_leads
        if l.status == "Trial Scheduled"
        and l.next_followup_date
        and l.next_followup_date >= tomorrow_10am
        and l.next_followup_date <= tomorrow_10am_end
    ]
    
    # Find leads with Absent attendance records in the last 24 hours
    absent_cutoff = datetime.utcnow() - timedelta(hours=24)
    absent_attendance_lead_ids = db.exec(
        select(Attendance.lead_id).where(
            and_(
                Attendance.status == "Absent",
                Attendance.recorded_at >= absent_cutoff
            )
        ).distinct()
    ).all()
    
    # Get leads with Absent attendance that are still Trial Scheduled
    absent_leads = [
        l for l in all_leads
        if l.id in absent_attendance_lead_ids
        and l.status == "Trial Scheduled"
    ]
    
    # Combine both sets (using set to avoid duplicates)
    reschedule_lead_ids = set([l.id for l in reschedule_leads_by_date] + [l.id for l in absent_leads])
    reschedule_count = len(reschedule_lead_ids)
    
    # Post-Trial No Response: Leads with status == 'Trial Attended' AND last_updated < (now - 24 hours) AND NOT Joined
    post_trial_no_response_cutoff = datetime.utcnow() - timedelta(hours=24)
    post_trial_no_response_count = len([
        l for l in all_leads
        if l.status == "Trial Attended"
        and l.last_updated
        and l.last_updated < post_trial_no_response_cutoff
        and l.status != "Joined"  # Already filtered by base_query, but explicit for clarity
    ])
    
    # Count expiring soon (Active students with subscription_end_date between today and today + 7 days)
    today_date = date.today()
    seven_days_from_today = today_date + timedelta(days=7)
    
    # Query Student table for expiring subscriptions
    student_query = select(Student).where(
        Student.is_active == True,
        Student.subscription_end_date.isnot(None),
        Student.subscription_end_date >= today_date,
        Student.subscription_end_date <= seven_days_from_today
    )
    
    # Filter by user's centers if not team_lead
    if user.role != "team_lead":
        center_ids = [c.id for c in user.centers]
        if center_ids:
            student_query = student_query.where(Student.center_id.in_(center_ids))
            # Execute query and count
            expiring_students = list(db.exec(student_query).all())
            expiring_soon_count = len(expiring_students)
        else:
            # User has no centers, return 0
            expiring_soon_count = 0
    else:
        # Team lead sees all centers
        expiring_students = list(db.exec(student_query).all())
        expiring_soon_count = len(expiring_students)
    
    # Nurture Re-engage: Count leads with status 'Nurture' where last_updated was > 5 days ago
    five_days_ago = datetime.utcnow() - timedelta(days=5)
    nurture_query = select(Lead).where(
        Lead.status == "Nurture",
        or_(
            (Lead.last_updated.is_(None) & (Lead.created_time <= five_days_ago)),
            (Lead.last_updated.isnot(None) & (Lead.last_updated <= five_days_ago))
        )
    )
    
    # Filter by user's centers if not team_lead
    if user.role != "team_lead":
        center_ids = [c.id for c in user.centers]
        if center_ids:
            nurture_query = nurture_query.where(Lead.center_id.in_(center_ids))
            nurture_leads = list(db.exec(nurture_query).all())
            nurture_reengage_count = len(nurture_leads)
        else:
            nurture_reengage_count = 0
    else:
        nurture_leads = list(db.exec(nurture_query).all())
        nurture_reengage_count = len(nurture_leads)
    
    # On Break: Count all leads with status 'On Break'
    on_break_query = select(Lead).where(Lead.status == "On Break")
    
    # Filter by user's centers if not team_lead
    if user.role != "team_lead":
        center_ids = [c.id for c in user.centers]
        if center_ids:
            on_break_query = on_break_query.where(Lead.center_id.in_(center_ids))
            on_break_leads = list(db.exec(on_break_query).all())
            on_break_count = len(on_break_leads)
        else:
            on_break_count = 0
    else:
        on_break_leads = list(db.exec(on_break_query).all())
        on_break_count = len(on_break_leads)
    
    # Returning Soon: Count leads with status 'On Break' where next_followup_date is within next 7 days
    seven_days_from_now = datetime.utcnow() + timedelta(days=7)
    returning_soon_query = select(Lead).where(
        Lead.status == "On Break",
        Lead.next_followup_date.isnot(None),
        Lead.next_followup_date >= datetime.utcnow(),
        Lead.next_followup_date <= seven_days_from_now
    )
    
    # Filter by user's centers if not team_lead
    if user.role != "team_lead":
        center_ids = [c.id for c in user.centers]
        if center_ids:
            returning_soon_query = returning_soon_query.where(Lead.center_id.in_(center_ids))
            returning_soon_leads = list(db.exec(returning_soon_query).all())
            returning_soon_count = len(returning_soon_leads)
        else:
            returning_soon_count = 0
    else:
        returning_soon_leads = list(db.exec(returning_soon_query).all())
        returning_soon_count = len(returning_soon_leads)
    
    # Milestones: Count students who hit a milestone (10, 25, 50, 100 sessions) in the last 7 days
    milestones_count = 0
    seven_days_ago = datetime.utcnow() - timedelta(days=7)
    
    # Get all active students
    all_students_query = select(Student).where(Student.is_active == True)
    if user.role != "team_lead":
        center_ids = [c.id for c in user.centers]
        if center_ids:
            all_students_query = all_students_query.where(Student.center_id.in_(center_ids))
    
    all_students = list(db.exec(all_students_query).all())
    
    for student in all_students:
        # Count 'Present' attendance records for this student
        present_count = db.exec(
            select(func.count(Attendance.id)).where(
                Attendance.student_id == student.id,
                Attendance.status == 'Present'
            )
        ).first() or 0
        
        # Check if this student hit a milestone (10, 25, 50, 100)
        milestone_values = [10, 25, 50, 100]
        hit_milestone = False
        
        for milestone in milestone_values:
            # Check if student just crossed this milestone (between milestone and milestone + 7 sessions)
            if present_count >= milestone and present_count < milestone + 7:
                # Check if there's an attendance record in the last 7 days
                recent_attendance = db.exec(
                    select(Attendance).where(
                        Attendance.student_id == student.id,
                        Attendance.status == 'Present',
                        Attendance.date >= seven_days_ago.date()
                    ).order_by(Attendance.date.desc()).limit(1)
                ).first()
                
                if recent_attendance:
                    hit_milestone = True
                    break
        
        if hit_milestone:
            milestones_count += 1
    
    # Staging/field capture leads count (for team_lead and team_member)
    staging_leads = get_staging_leads(db=db, user=user)
    staging_leads_count = len(staging_leads)

    # Nudge Failures: Preference link sent but not clicked within 48h (needs_escalation)
    # Leads with status 'Followed up with message', preferences not submitted, and sent/updated > 48h ago
    forty_eight_h_ago = datetime.utcnow() - timedelta(hours=48)
    nudge_failure_query = select(Lead).where(
        Lead.status == "Followed up with message",
        Lead.preferences_submitted == False,
    )
    if user.role != "team_lead":
        center_ids = [c.id for c in user.centers]
        if center_ids:
            nudge_failure_query = nudge_failure_query.where(Lead.center_id.in_(center_ids))
    nudge_failure_leads = list(db.exec(nudge_failure_query).all())
    nudge_failures_count = 0
    for l in nudge_failure_leads:
        sent_at = None
        if l.extra_data and isinstance(l.extra_data, dict) and l.extra_data.get("preference_link_sent_at"):
            try:
                sent_at = datetime.fromisoformat(l.extra_data["preference_link_sent_at"].replace("Z", "+00:00"))
                if sent_at.tzinfo:
                    sent_at = sent_at.replace(tzinfo=None)
            except (ValueError, TypeError):
                pass
        if sent_at is None:
            sent_at = l.last_updated or (l.created_time if hasattr(l, "created_time") else None)
        if sent_at and sent_at < forty_eight_h_ago:
            nudge_failures_count += 1
            l.needs_escalation = True
            db.add(l)
    if nudge_failures_count > 0:
        db.commit()

    return {
        "today_progress": round(today_progress, 1),
        "today_progress_count": today_progress_count,
        "today_total_due": total_due_today,
        "unscheduled": unscheduled,
        "overdue": overdue,
        "trial_show_up_rate": round(trial_show_up_rate, 1),
        "trial_show_up_count": trials_marked_present,
        "trial_total_scheduled": trial_total_scheduled,
        "hot_trials_count": hot_trials_count,
        "reschedule_count": reschedule_count,
        "post_trial_no_response_count": post_trial_no_response_count,
        "expiring_soon_count": expiring_soon_count,
        "nurture_reengage_count": nurture_reengage_count,
        "milestones_count": milestones_count,
        "on_break_count": on_break_count,
        "returning_soon_count": returning_soon_count,
        "staging_leads_count": staging_leads_count,
        "nudge_failures_count": nudge_failures_count,
    }


def _get_coach_command_center_analytics(
    db: Session,
    user: User,
    target_date: date,
    today_start: datetime,
    today_end: datetime
) -> Dict:
    """Get coach-focused command center analytics."""
    # Get coach's assigned batches
    batch_assignments = db.exec(
        select(BatchCoachLink.batch_id).where(BatchCoachLink.user_id == user.id)
    ).all()
    batch_ids = list(batch_assignments)
    
    if not batch_ids:
        # Coach has no batches
        return {
            "session_coverage": 0.0,
            "session_attendance_count": 0,
            "session_total_batches": 0,
            "new_arrivals": 0,
            "skill_report_backlog": 0,
            "capacity_warning": 0,
        }
    
    # Check if target_date is a scheduled day for any batch
    day_of_week = target_date.weekday()  # 0 = Monday, 6 = Sunday
    day_flags = {
        0: Batch.is_mon,
        1: Batch.is_tue,
        2: Batch.is_wed,
        3: Batch.is_thu,
        4: Batch.is_fri,
        5: Batch.is_sat,
        6: Batch.is_sun,
    }
    day_flag = day_flags.get(day_of_week)
    
    if day_flag is None:
        scheduled_batches = []
    else:
        scheduled_batches = db.exec(
            select(Batch).where(
                and_(
                    Batch.id.in_(batch_ids),
                    day_flag == True
                )
            )
        ).all()
    total_batches_today = len(scheduled_batches)
    
    # Session Coverage: Attendance records created today / Total batches scheduled
    session_attendance_count = db.exec(
        select(func.count(Attendance.id)).where(
            and_(
                Attendance.batch_id.in_(batch_ids),
                Attendance.date == target_date
            )
        )
    ).first() or 0
    
    session_coverage = (session_attendance_count / total_batches_today * 100) if total_batches_today > 0 else 0.0
    
    # New Arrivals: Trial Scheduled leads in coach's batches for today
    trial_batch_ids = [b.id for b in scheduled_batches]
    new_arrivals = 0
    if trial_batch_ids:
        new_arrivals = db.exec(
            select(func.count(Lead.id)).where(
                and_(
                    Lead.trial_batch_id.in_(trial_batch_ids),
                    Lead.status == "Trial Scheduled",
                    or_(
                        Lead.next_followup_date.is_(None),
                        Lead.next_followup_date >= today_start,
                        Lead.next_followup_date <= today_end
                    )
                )
            )
        ).first() or 0
    
    # Skill Report Backlog: Joined students with no skill report in last 60 days
    joined_leads_in_batches = db.exec(
        select(Lead.id).where(
            and_(
                or_(
                    Lead.trial_batch_id.in_(batch_ids),
                    Lead.permanent_batch_id.in_(batch_ids)
                ),
                Lead.status == "Joined"
            )
        )
    ).all()
    
    skill_report_backlog = 0
    cutoff_date = target_date - timedelta(days=60)
    for lead_id in joined_leads_in_batches:
        lead = db.get(Lead, lead_id)
        if not lead or not lead.extra_data:
            skill_report_backlog += 1
            continue
        
        # Check if extra_data has skill_report with recent timestamp
        skill_reports = lead.extra_data.get("skill_reports", [])
        if not skill_reports:
            skill_report_backlog += 1
            continue
        
        # Get most recent report date
        most_recent = None
        for report in skill_reports:
            if isinstance(report, dict) and "timestamp" in report:
                try:
                    report_date = datetime.fromisoformat(report["timestamp"]).date()
                    if most_recent is None or report_date > most_recent:
                        most_recent = report_date
                except (ValueError, TypeError):
                    continue
        
        if most_recent is None or most_recent < cutoff_date:
            skill_report_backlog += 1
    
    # Capacity Warning: Batches at >90% capacity
    capacity_warning = 0
    for batch in db.exec(select(Batch).where(Batch.id.in_(batch_ids))).all():
        # Count leads in this batch (both trial and permanent)
        lead_count = db.exec(
            select(func.count(Lead.id)).where(
                or_(
                    Lead.trial_batch_id == batch.id,
                    Lead.permanent_batch_id == batch.id
                )
            )
        ).first() or 0
        
        if batch.max_capacity > 0:
            capacity_percentage = (lead_count / batch.max_capacity) * 100
            if capacity_percentage > 90:
                capacity_warning += 1
    
    return {
        "session_coverage": round(session_coverage, 1),
        "session_attendance_count": session_attendance_count,
        "session_total_batches": total_batches_today,
        "new_arrivals": new_arrivals,
        "skill_report_backlog": skill_report_backlog,
        "capacity_warning": capacity_warning,
    }


def get_new_batch_opportunities(db: Session, user: User, hours_back: int = 48) -> List[Dict]:
    """
    Get batches created in the user's assigned centers within the last N hours.
    Returns batches with potential reactivation counts.
    
    Args:
        db: Database session
        user: Current user
        hours_back: Number of hours to look back (default 48)
        
    Returns:
        List of dictionaries with batch info and reactivation count
    """
    from datetime import timedelta
    from backend.core.reactivations import get_potential_reactivations
    
    cutoff_time = datetime.utcnow() - timedelta(hours=hours_back)
    
    # Get user's assigned centers
    if user.role == "team_lead":
        # Team leads see all centers
        center_ids = [c.id for c in db.exec(select(Center)).all()]
    else:
        # Regular users see their assigned centers
        center_ids = [c.id for c in user.centers]
    
    if not center_ids:
        return []
    
    # Get batches created in last N hours in user's centers
    # Note: Batch model doesn't have created_time, so we'll use a different approach
    # For now, we'll return all batches and let the frontend filter by a reasonable timeframe
    # This is a limitation - ideally batches would have a created_time field
    batches = db.exec(
        select(Batch).where(Batch.center_id.in_(center_ids))
    ).all()
    
    opportunities = []
    for batch in batches:
        reactivation_leads = get_potential_reactivations(db, batch.id)
        if reactivation_leads:
            center = db.get(Center, batch.center_id)
            opportunities.append({
                "batch_id": batch.id,
                "batch_name": batch.name,
                "center_id": batch.center_id,
                "center_name": center.display_name if center else "Unknown",
                "min_age": batch.min_age,
                "max_age": batch.max_age,
                "reactivation_count": len(reactivation_leads),
            })
    
    return opportunities


def _get_executive_analytics(db: Session) -> Dict:
    """
    Get executive-level analytics for team leads.
    
    Returns:
        Dictionary with:
        - attendance_leaderboard: List of centers with average attendance % for last 7 days
        - batch_utilization: List of batches with very high (>90%) or very low (<30%) utilization
        - coach_compliance: List of batches that happened in last 24h but have 0 attendance records
    """
    today = date.today()
    last_7_days_start = today - timedelta(days=7)
    last_24h_start = datetime.utcnow() - timedelta(hours=24)
    
    # 1. Attendance Leaderboard: Centers with average attendance % for last 7 days
    all_centers = db.exec(select(Center)).all()
    attendance_leaderboard = []
    
    # Calculate previous week range for trend comparison
    last_14_days_start = today - timedelta(days=14)
    previous_7_days_start = last_14_days_start
    previous_7_days_end = last_7_days_start - timedelta(days=1)
    
    for center in all_centers:
        # Get all batches in this center
        center_batches = db.exec(
            select(Batch).where(Batch.center_id == center.id)
        ).all()
        batch_ids = [b.id for b in center_batches]
        
        if not batch_ids:
            continue
        
        # Count total attendance records in last 7 days for this center's batches
        total_attendance = db.exec(
            select(func.count(Attendance.id)).where(
                and_(
                    Attendance.batch_id.in_(batch_ids),
                    Attendance.date >= last_7_days_start,
                    Attendance.date <= today,
                    Attendance.status == "Present"
                )
            )
        ).first() or 0
        
        # Count previous week attendance for trend comparison
        previous_week_attendance = db.exec(
            select(func.count(Attendance.id)).where(
                and_(
                    Attendance.batch_id.in_(batch_ids),
                    Attendance.date >= previous_7_days_start,
                    Attendance.date <= previous_7_days_end,
                    Attendance.status == "Present"
                )
            )
        ).first() or 0
        
        # Count total expected attendance (sum of all scheduled sessions)
        # For each batch, count how many days it should have run in last 7 days
        expected_attendance = 0
        previous_week_expected = 0
        day_attribute_map = {
            0: "is_mon",
            1: "is_tue",
            2: "is_wed",
            3: "is_thu",
            4: "is_fri",
            5: "is_sat",
            6: "is_sun",
        }
        
        for batch in center_batches:
            # Count how many times this batch was scheduled in last 7 days
            for day_offset in range(7):
                check_date = last_7_days_start + timedelta(days=day_offset)
                day_of_week = check_date.weekday()
                day_attr = day_attribute_map.get(day_of_week)
                
                if day_attr and getattr(batch, day_attr, False):
                    # Batch was scheduled this day - count students in batch
                    student_count = db.exec(
                        select(func.count(Lead.id)).where(
                            or_(
                                Lead.trial_batch_id == batch.id,
                                Lead.permanent_batch_id == batch.id
                            ),
                            Lead.status != "Dead/Not Interested"
                        )
                    ).first() or 0
                    expected_attendance += student_count
            
            # Count previous week expected attendance
            for day_offset in range(7):
                check_date = previous_7_days_start + timedelta(days=day_offset)
                day_of_week = check_date.weekday()
                day_attr = day_attribute_map.get(day_of_week)
                
                if day_attr and getattr(batch, day_attr, False):
                    student_count = db.exec(
                        select(func.count(Lead.id)).where(
                            or_(
                                Lead.trial_batch_id == batch.id,
                                Lead.permanent_batch_id == batch.id
                            ),
                            Lead.status != "Dead/Not Interested"
                        )
                    ).first() or 0
                    previous_week_expected += student_count
        
        avg_attendance_pct = (total_attendance / expected_attendance * 100) if expected_attendance > 0 else 0.0
        previous_week_pct = (previous_week_attendance / previous_week_expected * 100) if previous_week_expected > 0 else 0.0
        
        # Calculate trend (up, down, or stable)
        trend = "stable"
        if avg_attendance_pct > previous_week_pct + 1:  # At least 1% increase
            trend = "up"
        elif avg_attendance_pct < previous_week_pct - 1:  # At least 1% decrease
            trend = "down"
        
        attendance_leaderboard.append({
            "center_id": center.id,
            "center_name": center.display_name,
            "average_attendance_pct": round(avg_attendance_pct, 1),
            "total_attendance": total_attendance,
            "expected_attendance": expected_attendance,
            "previous_week_pct": round(previous_week_pct, 1),
            "trend": trend,
        })
    
    # Sort by average attendance descending
    attendance_leaderboard.sort(key=lambda x: x["average_attendance_pct"], reverse=True)
    
    # 2. Batch Utilization: Batches with >90% or <30% utilization
    all_batches = db.exec(select(Batch)).all()
    batch_utilization = []
    
    for batch in all_batches:
        # Count current students in batch
        student_count = db.exec(
            select(func.count(Lead.id)).where(
                or_(
                    Lead.trial_batch_id == batch.id,
                    Lead.permanent_batch_id == batch.id
                ),
                Lead.status != "Dead/Not Interested"
            )
        ).first() or 0
        
        if batch.max_capacity > 0:
            utilization_pct = (student_count / batch.max_capacity) * 100
            if utilization_pct > 90 or utilization_pct < 30:
                center = db.get(Center, batch.center_id)
                batch_utilization.append({
                    "batch_id": batch.id,
                    "batch_name": batch.name,
                    "center_name": center.display_name if center else "Unknown",
                    "utilization_pct": round(utilization_pct, 1),
                    "current_students": student_count,
                    "max_capacity": batch.max_capacity,
                    "status": "overcrowded" if utilization_pct > 90 else "empty",
                })
    
    # 3. Coach Compliance: Batches that happened in last 24h but have 0 attendance records
    # Check yesterday and today
    yesterday = today - timedelta(days=1)
    check_dates = [yesterday, today]
    
    coach_compliance = []
    
    for check_date in check_dates:
        day_of_week = check_date.weekday()
        day_flags = {
            0: Batch.is_mon,
            1: Batch.is_tue,
            2: Batch.is_wed,
            3: Batch.is_thu,
            4: Batch.is_fri,
            5: Batch.is_sat,
            6: Batch.is_sun,
        }
        day_flag = day_flags.get(day_of_week)
        
        if day_flag is None:
            continue
        
        # Get batches scheduled for this day
        scheduled_batches = db.exec(
            select(Batch).where(day_flag == True)
        ).all()
        
        for batch in scheduled_batches:
            # Check if batch has any attendance records for this date
            attendance_count = db.exec(
                select(func.count(Attendance.id)).where(
                    and_(
                        Attendance.batch_id == batch.id,
                        Attendance.date == check_date
                    )
                )
            ).first() or 0
            
            if attendance_count == 0:
                # Check if batch has students (only flag if it should have attendance)
                student_count = db.exec(
                    select(func.count(Lead.id)).where(
                        or_(
                            Lead.trial_batch_id == batch.id,
                            Lead.permanent_batch_id == batch.id
                        ),
                        Lead.status != "Dead/Not Interested"
                    )
                ).first() or 0
                
                if student_count > 0:
                    center = db.get(Center, batch.center_id)
                    # Get coaches assigned to this batch
                    coach_links = db.exec(
                        select(BatchCoachLink).where(BatchCoachLink.batch_id == batch.id)
                    ).all()
                    coaches = []
                    for link in coach_links:
                        coach_user = db.get(User, link.user_id)
                        if coach_user:
                            coaches.append({
                                "coach_id": coach_user.id,
                                "coach_name": coach_user.full_name or coach_user.email,
                                "coach_phone": getattr(coach_user, 'phone', None) or None,
                            })
                    
                    coach_compliance.append({
                        "batch_id": batch.id,
                        "batch_name": batch.name,
                        "center_name": center.display_name if center else "Unknown",
                        "date": check_date.isoformat(),
                        "expected_students": student_count,
                        "coaches": coaches,
                    })
    
    # 4. Loss Analysis: Breakdown of loss_reason across all Dead leads
    dead_leads = db.exec(
        select(Lead).where(Lead.status == "Dead/Not Interested")
    ).all()
    
    loss_reason_counts = {}
    total_dead = len(dead_leads)
    
    for lead in dead_leads:
        reason = lead.loss_reason or "Unknown"
        loss_reason_counts[reason] = loss_reason_counts.get(reason, 0) + 1
    
    # Convert to list format and calculate percentages
    loss_analysis = []
    for reason, count in loss_reason_counts.items():
        percentage = (count / total_dead * 100) if total_dead > 0 else 0
        loss_analysis.append({
            "reason": reason,
            "count": count,
            "percentage": round(percentage, 1),
        })
    
    # Sort by count descending
    loss_analysis.sort(key=lambda x: x["count"], reverse=True)
    
    # Find #1 reason
    top_loss_reason = loss_analysis[0] if loss_analysis else None
    
    # 4b. Loss by Center and by Lifecycle Stage (status_at_loss): Dead/Not Interested and Nurture
    loss_leads = db.exec(
        select(Lead).where(
            Lead.status.in_(["Dead/Not Interested", "Nurture"])
        )
    ).all()
    loss_by_center: Dict[str, Dict[str, int]] = {}
    loss_by_stage: Dict[str, Dict[str, int]] = {}  # stage (e.g. Called, Trial Attended) -> reason -> count
    loss_by_center_and_stage: Dict[str, Dict[str, Dict[str, int]]] = {}  # center -> stage -> reason -> count
    for lead in loss_leads:
        center = db.get(Center, lead.center_id) if lead.center_id else None
        center_name = center.display_name if center else "Unknown"
        stage = getattr(lead, "status_at_loss", None) or "Unknown"
        reason = lead.loss_reason or "Unknown"
        # By center
        if center_name not in loss_by_center:
            loss_by_center[center_name] = {}
        loss_by_center[center_name][reason] = loss_by_center[center_name].get(reason, 0) + 1
        # By stage
        if stage not in loss_by_stage:
            loss_by_stage[stage] = {}
        loss_by_stage[stage][reason] = loss_by_stage[stage].get(reason, 0) + 1
        # By center and stage
        if center_name not in loss_by_center_and_stage:
            loss_by_center_and_stage[center_name] = {}
        if stage not in loss_by_center_and_stage[center_name]:
            loss_by_center_and_stage[center_name][stage] = {}
        loss_by_center_and_stage[center_name][stage][reason] = (
            loss_by_center_and_stage[center_name][stage].get(reason, 0) + 1
        )
    
    # 5. Data Health: Orphaned Leads (status 'New' or 'Called' with center_id NULL)
    orphaned_leads = db.exec(
        select(Lead).where(
            and_(
                or_(
                    Lead.status == "New",
                    Lead.status == "Called"
                ),
                Lead.center_id.is_(None)
            )
        )
    ).all()
    orphaned_leads_count = len(orphaned_leads)
    
    # 6. Data Health: Orphaned Batches (batches with 0 coaches assigned)
    all_batches_for_check = db.exec(select(Batch)).all()
    orphaned_batches_count = 0
    
    for batch in all_batches_for_check:
        coach_count = db.exec(
            select(func.count(BatchCoachLink.user_id)).where(
                BatchCoachLink.batch_id == batch.id
            )
        ).first() or 0
        
        if coach_count == 0:
            orphaned_batches_count += 1
    
    # 7. Sales Leaderboards: Top Closers (Top 3 users by Joined count this month)
    current_month_start = datetime(today.year, today.month, 1)
    current_month_end = datetime(today.year, today.month + 1, 1) if today.month < 12 else datetime(today.year + 1, 1, 1)
    
    # Get all Joined status changes this month
    joined_changes = db.exec(
        select(AuditLog).where(
            and_(
                AuditLog.action_type == "status_change",
                AuditLog.new_value == "Joined",
                AuditLog.user_id.isnot(None),
                AuditLog.timestamp >= current_month_start,
                AuditLog.timestamp < current_month_end
            )
        )
    ).all()
    
    # Count by user_id
    user_joined_counts = {}
    for log_entry in joined_changes:
        if log_entry.user_id:
            user_joined_counts[log_entry.user_id] = user_joined_counts.get(log_entry.user_id, 0) + 1
    
    # Get top 3 and fetch user names
    top_closers = []
    for user_id, count in sorted(user_joined_counts.items(), key=lambda x: x[1], reverse=True)[:3]:
        user = db.get(User, user_id)
        if user:
            top_closers.append({
                "user_id": user_id,
                "user_name": user.full_name or user.email,
                "joined_count": count
            })
    
    # 8. Sales Leaderboards: Speed Demons (Top 3 users by fastest avg time to first contact)
    # For each user, find leads where they created the first AuditLog entry
    # Calculate average time from Lead.created_time to first AuditLog timestamp
    all_users = db.exec(select(User).where(User.role.in_(["team_lead", "team_member"]))).all()
    user_speed_data = {}
    
    for user in all_users:
        if not user.id:
            continue
            
        # Get leads where this user created the first audit log entry
        user_leads = db.exec(
            select(Lead.id, Lead.created_time).where(
                Lead.id.in_(
                    select(AuditLog.lead_id).where(AuditLog.user_id == user.id).distinct()
                )
            )
        ).all()
        
        total_time_minutes = 0
        count = 0
        
        for lead_id, lead_created_time in user_leads:
            # Get first audit log entry for this lead by this user
            first_audit = db.exec(
                select(AuditLog).where(
                    and_(
                        AuditLog.lead_id == lead_id,
                        AuditLog.user_id == user.id
                    )
                ).order_by(AuditLog.timestamp.asc())
            ).first()
            
            if first_audit and lead_created_time:
                time_diff = first_audit.timestamp - lead_created_time
                total_time_minutes += time_diff.total_seconds() / 60
                count += 1
        
        if count > 0:
            avg_minutes = total_time_minutes / count
            user_speed_data[user.id] = {
                "user_id": user.id,
                "user_name": user.full_name or user.email,
                "avg_minutes": round(avg_minutes, 1),
                "lead_count": count
            }
    
    # Get top 3 fastest (lowest avg_minutes)
    speed_demons = sorted(user_speed_data.values(), key=lambda x: x["avg_minutes"])[:3]
    
    # 9. Coach Compliance: For last 30 days, calculate (Sessions with attendance / Total scheduled) * 100 per coach
    last_30_days_start = today - timedelta(days=30)
    all_coaches = db.exec(select(User).where(User.role == "coach")).all()
    coach_compliance_list = []
    
    for coach in all_coaches:
        if not coach.id:
            continue
        
        # Get batches assigned to this coach
        coach_batch_ids = db.exec(
            select(BatchCoachLink.batch_id).where(BatchCoachLink.user_id == coach.id)
        ).all()
        
        if not coach_batch_ids:
            continue
        
        # For each day in last 30 days, count scheduled sessions and sessions with attendance
        total_scheduled = 0
        sessions_with_attendance = 0
        
        for day_offset in range(30):
            check_date = last_30_days_start + timedelta(days=day_offset)
            day_of_week = check_date.weekday()
            
            # Check which batches are scheduled for this day
            day_flags = {
                0: Batch.is_mon,
                1: Batch.is_tue,
                2: Batch.is_wed,
                3: Batch.is_thu,
                4: Batch.is_fri,
                5: Batch.is_sat,
                6: Batch.is_sun,
            }
            day_flag = day_flags.get(day_of_week)
            
            if day_flag is None:
                continue
            
            # Get batches scheduled for this day that this coach is assigned to
            scheduled_batches = db.exec(
                select(Batch).where(
                    and_(
                        Batch.id.in_(coach_batch_ids),
                        day_flag == True
                    )
                )
            ).all()
            
            for batch in scheduled_batches:
                total_scheduled += 1
                
                # Check if there's at least one attendance record for this batch on this date
                attendance_count = db.exec(
                    select(func.count(Attendance.id)).where(
                        and_(
                            Attendance.batch_id == batch.id,
                            Attendance.date == check_date
                        )
                    )
                ).first() or 0
                
                if attendance_count > 0:
                    sessions_with_attendance += 1
        
        compliance_pct = (sessions_with_attendance / total_scheduled * 100) if total_scheduled > 0 else 0
        
        coach_compliance_list.append({
            "coach_id": coach.id,
            "coach_name": coach.full_name or coach.email,
            "compliance_pct": round(compliance_pct, 1),
            "sessions_with_attendance": sessions_with_attendance,
            "total_scheduled": total_scheduled
        })
    
    # Sort by compliance percentage descending
    coach_compliance_list.sort(key=lambda x: x["compliance_pct"], reverse=True)

    # 5. Center Performance: Merge attendance + compliance per center
    name_to_id = {c.display_name: c.id for c in all_centers}
    att_by_center = {a["center_id"]: a for a in attendance_leaderboard}
    compliance_by_center: Dict[int, List[Dict]] = {}
    for item in coach_compliance:
        cid = name_to_id.get(item["center_name"])
        if cid is not None:
            if cid not in compliance_by_center:
                compliance_by_center[cid] = []
            compliance_by_center[cid].append(item)

    center_performance = []
    for center in all_centers:
        att = att_by_center.get(center.id, {
            "average_attendance_pct": 0.0,
            "total_attendance": 0,
            "expected_attendance": 0,
            "previous_week_pct": 0.0,
            "trend": "stable",
        })
        missing = compliance_by_center.get(center.id, [])
        center_performance.append({
            "center_id": center.id,
            "center_name": center.display_name,
            "average_attendance_pct": att.get("average_attendance_pct", 0.0),
            "total_attendance": att.get("total_attendance", 0),
            "expected_attendance": att.get("expected_attendance", 0),
            "previous_week_pct": att.get("previous_week_pct"),
            "trend": att.get("trend", "stable"),
            "compliance_status": "compliant" if len(missing) == 0 else "missing",
            "missing_sessions_count": len(missing),
            "missing_sessions": missing,
        })
    center_performance.sort(key=lambda x: x["average_attendance_pct"], reverse=True)

    return {
        "attendance_leaderboard": attendance_leaderboard,
        "batch_utilization": batch_utilization,
        "coach_compliance": coach_compliance,
        "center_performance": center_performance,
        "loss_analysis": loss_analysis,
        "top_loss_reason": top_loss_reason,
        "loss_by_center": loss_by_center,
        "loss_by_stage": loss_by_stage,
        "loss_by_center_and_stage": loss_by_center_and_stage,
        "total_dead_leads": total_dead,
        "orphaned_leads_count": orphaned_leads_count,
        "orphaned_batches_count": orphaned_batches_count,
        "top_closers": top_closers,
        "speed_demons": speed_demons,
        "coach_compliance_list": coach_compliance_list,
    }
