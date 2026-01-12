"""
Attendance management business logic.
Framework-agnostic attendance operations.
"""
from sqlmodel import Session, select
from typing import List, Optional
from datetime import date, datetime
from backend.models import Attendance, Lead, Batch, BatchCoachLink, User, AuditLog
from backend.core.audit import log_lead_activity


def check_coach_batch_assignment(
    db: Session,
    user_id: int,
    batch_id: int
) -> bool:
    """
    Verify that a coach (user) is assigned to a batch.
    
    Args:
        db: Database session
        user_id: User ID of the coach
        batch_id: Batch ID to check
        
    Returns:
        True if coach is assigned to the batch, False otherwise
    """
    assignment = db.exec(
        select(BatchCoachLink).where(
            BatchCoachLink.user_id == user_id,
            BatchCoachLink.batch_id == batch_id
        )
    ).first()
    return assignment is not None


def record_attendance(
    db: Session,
    lead_id: int,
    batch_id: int,
    user_id: int,
    date: date,
    status: str,
    remarks: Optional[str] = None,
    internal_note: Optional[str] = None
) -> Attendance:
    """
    Record attendance for a lead in a batch.
    
    Args:
        db: Database session
        lead_id: Lead ID (student)
        batch_id: Batch ID
        user_id: User ID of the coach recording attendance
        date: Date of attendance
        status: Attendance status ('Present', 'Absent', 'Excused', 'Late')
        remarks: Optional remarks
        
    Returns:
        Created Attendance record
        
    Raises:
        ValueError: If coach is not assigned to the batch or lead/batch not found
    """
    # Verify coach is assigned to the batch
    if not check_coach_batch_assignment(db, user_id, batch_id):
        raise ValueError(f"Coach {user_id} is not assigned to batch {batch_id}")
    
    # Verify lead exists
    lead = db.get(Lead, lead_id)
    if not lead:
        raise ValueError(f"Lead {lead_id} not found")
    
    # Verify batch exists
    batch = db.get(Batch, batch_id)
    if not batch:
        raise ValueError(f"Batch {batch_id} not found")
    
    # Check if this lead has been converted to a student
    from backend.models import Student
    student = db.exec(
        select(Student).where(Student.lead_id == lead_id)
    ).first()
    
    # Create attendance record
    attendance = Attendance(
        lead_id=lead_id,
        student_id=student.id if student else None,  # Set student_id if converted to student
        batch_id=batch_id,
        user_id=user_id,
        date=date,
        status=status,
        remarks=remarks,
        recorded_at=datetime.utcnow()
    )
    
    db.add(attendance)
    
    # Auto-update lead status and next_followup_date based on attendance
    if status == "Present" and lead.status == "Trial Scheduled":
        old_status = lead.status
        lead.status = "Trial Attended"
        lead.last_updated = datetime.utcnow()
        
        # Set next_followup_date to 24 hours from now for Present (triggers Hot card for Sales)
        from datetime import timedelta
        lead.next_followup_date = datetime.utcnow() + timedelta(hours=24)
        
        # Save coach feedback if provided (internal_note)
        if internal_note:
            if not lead.extra_data:
                lead.extra_data = {}
            if "coach_trial_feedback" not in lead.extra_data:
                lead.extra_data["coach_trial_feedback"] = []
            lead.extra_data["coach_trial_feedback"].append({
                "note": internal_note,
                "date": date.isoformat(),
                "coach_id": user_id,
                "timestamp": datetime.utcnow().isoformat()
            })
        
        # Log the automatic status promotion
        coach = db.get(User, user_id)
        coach_name = coach.full_name if coach else f"Coach {user_id}"
        player_name = lead.player_name
        batch_name = batch.name
        
        # Log status change using proper audit function
        from backend.core.audit import log_status_change
        log_status_change(
            db=db,
            lead_id=lead_id,
            user_id=user_id,
            old_status=old_status,
            new_status="Trial Attended"
        )
        
        log_lead_activity(
            db=db,
            lead_id=lead_id,
            user_id=user_id,
            action_type="status_change",
            description=f"Lead status automatically promoted to Trial Attended after successful check-in by Coach {coach_name} for {batch_name}. Next follow-up set to 24 hours (Hot card triggered)",
            old_value=old_status,
            new_value="Trial Attended"
        )
    elif status == "Absent" and lead.status == "Trial Scheduled":
        # For Trial Scheduled leads who are absent:
        # Keep status as 'Trial Scheduled'
        # Automatically move next_followup_date to Tomorrow at 10:00 AM (triggers Reschedule card)
        from datetime import timedelta, time as dt_time
        tomorrow = date + timedelta(days=1)
        lead.next_followup_date = datetime.combine(tomorrow, dt_time(10, 0))
        lead.last_updated = datetime.utcnow()
        
        # Increment reschedule_count for 2-strike rule
        lead.reschedule_count = (lead.reschedule_count or 0) + 1
        
        # Log the reschedule trigger
        coach = db.get(User, user_id)
        coach_name = coach.full_name if coach else f"Coach {user_id}"
        player_name = lead.player_name
        batch_name = batch.name
        
        log_lead_activity(
            db=db,
            lead_id=lead_id,
            user_id=user_id,
            action_type="attendance_reschedule",
            description=f"Trial student {player_name} was absent. Next follow-up scheduled for tomorrow at 10:00 AM (Reschedule card triggered)",
            old_value=None,
            new_value=f"Reschedule scheduled for {tomorrow.isoformat()} 10:00 AM"
        )
        
        # 2-Strike Rule: If reschedule_count >= 2, auto-mark as Dead
        if lead.reschedule_count >= 2:
            old_status = lead.status
            lead.status = "Dead/Not Interested"
            lead.do_not_contact = True
            lead.loss_reason = "Repeated No-Show"
            lead.loss_reason_notes = f"Automatically marked as Dead after {lead.reschedule_count} absences"
            
            # Log the automatic status change using proper audit function
            from backend.core.audit import log_status_change
            log_status_change(
                db=db,
                lead_id=lead_id,
                user_id=user_id,
                old_status=old_status,
                new_status="Dead/Not Interested"
            )
            
            log_lead_activity(
                db=db,
                lead_id=lead_id,
                user_id=user_id,
                action_type="status_change",
                description=f"Lead automatically marked as Dead/Not Interested after {lead.reschedule_count} absences (2-Strike Rule)",
                old_value=old_status,
                new_value="Dead/Not Interested"
            )
    
    db.commit()
    db.refresh(attendance)
    
    # Log attendance in audit log with detailed information
    coach = db.get(User, user_id)
    coach_name = coach.full_name if coach else f"Coach {user_id}"
    player_name = lead.player_name
    batch_name = batch.name
    
    log_lead_activity(
        db=db,
        lead_id=lead_id,
        user_id=user_id,
        action_type="attendance_recorded",
        description=f"Coach {coach_name} marked {player_name} as {status} for {batch_name}",
        old_value=None,
        new_value=status
    )
    
    return attendance


def get_attendance_history(
    db: Session,
    lead_id: int,
    user: User,
    limit: Optional[int] = None
) -> List[Attendance]:
    """
    Get attendance history for a specific lead.
    
    Args:
        db: Database session
        lead_id: Lead ID
        user: Current user requesting the history
        limit: Optional limit on number of records to return
        
    Returns:
        List of Attendance records
        
    Raises:
        ValueError: If lead not found or user doesn't have access
    """
    # Verify lead exists
    lead = db.get(Lead, lead_id)
    if not lead:
        raise ValueError(f"Lead {lead_id} not found")
    
    # Build query
    if user.role == "team_lead":
        # Team leads can see all attendance
        query = select(Attendance).where(Attendance.lead_id == lead_id)
    elif user.role == "coach":
        # Coaches can only see attendance for their batches
        # Get batch IDs assigned to this coach
        batch_assignments = db.exec(
            select(BatchCoachLink.batch_id).where(BatchCoachLink.user_id == user.id)
        ).all()
        batch_ids = list(batch_assignments)
        
        if not batch_ids:
            return []  # Coach has no batches, return empty
        
        from sqlalchemy import or_
        query = select(Attendance).where(
            Attendance.lead_id == lead_id,
            Attendance.batch_id.in_(batch_ids)
        )
    else:
        # Regular users: check if lead belongs to their centers
        center_ids = [c.id for c in user.centers]
        if not center_ids or lead.center_id not in center_ids:
            raise ValueError("Not authorized to view attendance for this lead")
        
        query = select(Attendance).where(Attendance.lead_id == lead_id)
    
    # Order by date descending (most recent first)
    query = query.order_by(Attendance.date.desc(), Attendance.recorded_at.desc())
    
    if limit:
        query = query.limit(limit)
    
    return list(db.exec(query).all())


def get_batch_attendance_for_date(
    db: Session,
    batch_id: int,
    date: date,
    user: User
) -> List[Attendance]:
    """
    Get all attendance records for a batch on a specific date.
    
    Args:
        db: Database session
        batch_id: Batch ID
        date: Date to get attendance for
        user: Current user
        
    Returns:
        List of Attendance records
        
    Raises:
        ValueError: If user doesn't have access to the batch
    """
    # Verify access
    if user.role == "team_lead":
        pass  # Team leads can see all
    elif user.role == "coach":
        if not check_coach_batch_assignment(db, user.id, batch_id):
            raise ValueError("Not authorized to view attendance for this batch")
    else:
        # Regular users can see if the batch's center is in their centers
        batch = db.get(Batch, batch_id)
        if not batch:
            raise ValueError(f"Batch {batch_id} not found")
        
        center_ids = [c.id for c in user.centers]
        if batch.center_id not in center_ids:
            raise ValueError("Not authorized to view attendance for this batch")
    
    query = select(Attendance).where(
        Attendance.batch_id == batch_id,
        Attendance.date == date
    ).order_by(Attendance.recorded_at.desc())
    
    return list(db.exec(query).all())

