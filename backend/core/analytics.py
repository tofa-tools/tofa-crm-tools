"""
Analytics and business intelligence functions.
Framework-agnostic analytics utilities.
"""
from sqlmodel import Session, select, func, and_, or_
from typing import Dict, List, Tuple, Optional
from datetime import datetime, timedelta, date, time
from backend.models import Lead, AuditLog, Batch, BatchCoachLink, Attendance, User, Center


def calculate_conversion_rates(db: Session, user_id: Optional[int] = None) -> Dict[str, float]:
    """
    Calculate conversion rates between status transitions.
    
    Returns a dictionary with conversion rates like:
    {
        'New->Called': 0.75,  # 75% of New leads become Called
        'Called->Trial Scheduled': 0.50,  # 50% of Called leads become Trial Scheduled
        'Trial Scheduled->Joined': 0.20,  # 20% of Trial Scheduled leads join
        ...
    }
    """
    # Get all status change audit logs
    query = select(AuditLog).where(AuditLog.action_type == 'status_change')
    
    if user_id:
        query = query.where(AuditLog.user_id == user_id)
    
    status_changes = db.exec(query).all()
    
    # Count transitions
    transition_counts: Dict[str, int] = {}  # 'old->new': count
    status_counts: Dict[str, int] = {}  # status: count of leads that reached this status
    
    for change in status_changes:
        if change.old_value and change.new_value:
            transition_key = f"{change.old_value}->{change.new_value}"
            transition_counts[transition_key] = transition_counts.get(transition_key, 0) + 1
            status_counts[change.old_value] = status_counts.get(change.old_value, 0) + 1
    
    # Calculate conversion rates
    conversion_rates: Dict[str, float] = {}
    for transition, count in transition_counts.items():
        old_status = transition.split('->')[0]
        total_leads_in_old_status = status_counts.get(old_status, 1)  # Avoid division by zero
        conversion_rate = count / total_leads_in_old_status if total_leads_in_old_status > 0 else 0.0
        conversion_rates[transition] = conversion_rate
    
    return conversion_rates


def calculate_average_time_to_contact(db: Session) -> Optional[float]:
    """
    Calculate average time (in hours) from lead creation to first status change.
    
    Returns average hours, or None if no data available.
    """
    # Get all status change audit logs ordered by lead_id and timestamp
    query = (
        select(AuditLog)
        .where(AuditLog.action_type == 'status_change')
        .order_by(AuditLog.lead_id, AuditLog.timestamp.asc())
    )
    
    status_changes = db.exec(query).all()
    
    if not status_changes:
        return None
    
    # Group by lead_id and get the first status change for each lead
    first_changes_by_lead: Dict[int, datetime] = {}
    for change in status_changes:
        if change.lead_id not in first_changes_by_lead:
            first_changes_by_lead[change.lead_id] = change.timestamp
    
    # Get created_time for each lead
    total_hours = 0.0
    count = 0
    
    for lead_id, first_change_time in first_changes_by_lead.items():
        lead = db.get(Lead, lead_id)
        if lead:
            time_diff = first_change_time - lead.created_time
            hours = time_diff.total_seconds() / 3600.0
            total_hours += hours
            count += 1
    
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
    
    For Sales (team_lead, regular_user):
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
        if user.role in ["team_lead", "regular_user"]:
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
    
    # Count expiring soon (Joined leads with subscription_end_date between today and today + 7 days)
    today_date = date.today()
    seven_days_from_today = today_date + timedelta(days=7)
    # Need to query all Joined leads (not filtered by base_query which excludes Joined)
    joined_query = select(Lead).where(Lead.status == "Joined")
    if user.role != "team_lead":
        center_ids = [c.id for c in user.centers]
        if center_ids:
            joined_query = joined_query.where(Lead.center_id.in_(center_ids))
    all_joined_leads = list(db.exec(joined_query).all())
    expiring_soon_count = len([
        l for l in all_joined_leads
        if l.subscription_end_date
        and l.subscription_end_date >= today_date
        and l.subscription_end_date <= seven_days_from_today
    ])
    
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
                "age_category": batch.age_category,
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
        
        # Count total expected attendance (sum of all scheduled sessions)
        # For each batch, count how many days it should have run in last 7 days
        expected_attendance = 0
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
        
        avg_attendance_pct = (total_attendance / expected_attendance * 100) if expected_attendance > 0 else 0.0
        
        attendance_leaderboard.append({
            "center_id": center.id,
            "center_name": center.display_name,
            "average_attendance_pct": round(avg_attendance_pct, 1),
            "total_attendance": total_attendance,
            "expected_attendance": expected_attendance,
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
                    coach_compliance.append({
                        "batch_id": batch.id,
                        "batch_name": batch.name,
                        "center_name": center.display_name if center else "Unknown",
                    "date": check_date.isoformat(),
                    "expected_students": student_count,
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
    all_users = db.exec(select(User).where(User.role.in_(["team_lead", "regular_user"]))).all()
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
    
    return {
        "attendance_leaderboard": attendance_leaderboard,
        "batch_utilization": batch_utilization,
        "coach_compliance": coach_compliance,
        "loss_analysis": loss_analysis,
        "top_loss_reason": top_loss_reason,
        "total_dead_leads": total_dead,
        "orphaned_leads_count": orphaned_leads_count,
        "orphaned_batches_count": orphaned_batches_count,
        "top_closers": top_closers,
        "speed_demons": speed_demons,
        "coach_compliance_list": coach_compliance_list,
    }
