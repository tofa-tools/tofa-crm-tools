"""
Pending Student Reports analytics logic.
Framework-agnostic business logic for identifying students waiting for progress reports.
"""
from sqlmodel import Session, select, func
from typing import List, Dict
from datetime import datetime, timedelta
from backend.models import Lead, SkillEvaluation, AuditLog


def get_pending_student_reports(
    db: Session
) -> List[Dict]:
    """
    Get list of students (Leads with status 'Joined') who have new evaluations
    but haven't had a report sent since their last evaluation.
    
    Logic:
    1. Filter for leads where status == 'Joined' (Students)
    2. Find those with SkillEvaluation created in the last 48 hours
    3. Exclude students who already have AuditLog entry with action 'REPORT_SENT'
       since their last evaluation
    
    Returns:
        List of dictionaries with student information:
        {
            "lead_id": int,
            "player_name": str,
            "center_id": int,
            "center_name": str,
            "batch_id": int | None,
            "batch_name": str | None,
            "last_evaluation_date": str (ISO format),
            "total_evaluations": int
        }
    """
    # Calculate 48 hours ago
    forty_eight_hours_ago = datetime.utcnow() - timedelta(hours=48)
    
    # Get all students (status == 'Joined')
    students = db.exec(
        select(Lead).where(Lead.status == "Joined")
    ).all()
    
    pending_students = []
    
    for student in students:
        # Get the most recent evaluation for this student
        latest_evaluation = db.exec(
            select(SkillEvaluation)
            .where(SkillEvaluation.lead_id == student.id)
            .order_by(SkillEvaluation.created_at.desc())
            .limit(1)
        ).first()
        
        if not latest_evaluation:
            continue  # No evaluations yet, skip
        
        # Check if evaluation was created in the last 48 hours
        if latest_evaluation.created_at < forty_eight_hours_ago:
            continue  # Evaluation is older than 48 hours, skip
        
        # Check if there's a REPORT_SENT audit log entry after this evaluation
        report_sent_after_eval = db.exec(
            select(AuditLog)
            .where(
                AuditLog.lead_id == student.id,
                AuditLog.action_type == "REPORT_SENT",
                AuditLog.timestamp >= latest_evaluation.created_at
            )
            .order_by(AuditLog.timestamp.desc())
            .limit(1)
        ).first()
        
        if report_sent_after_eval:
            continue  # Report already sent since last evaluation, skip
        
        # Get total evaluation count for this student
        total_evaluations = db.exec(
            select(func.count(SkillEvaluation.id))
            .where(SkillEvaluation.lead_id == student.id)
        ).scalar() or 0
        
        # Get batch information
        batch_id = student.permanent_batch_id
        batch_name = None
        if batch_id:
            from backend.models import Batch
            batch = db.get(Batch, batch_id)
            if batch:
                batch_name = batch.name
        
        # Get center information
        center_name = None
        if student.center_id:
            from backend.models import Center
            center = db.get(Center, student.center_id)
            if center:
                center_name = center.display_name
        
        pending_students.append({
            "lead_id": student.id,
            "player_name": student.player_name,
            "center_id": student.center_id,
            "center_name": center_name,
            "batch_id": batch_id,
            "batch_name": batch_name,
            "last_evaluation_date": latest_evaluation.created_at.isoformat(),
            "total_evaluations": total_evaluations
        })
    
    # Sort by last evaluation date (most recent first)
    pending_students.sort(
        key=lambda x: x["last_evaluation_date"],
        reverse=True
    )
    
    return pending_students

