"""
Subscription and auto-expiry logic for students.
Framework-agnostic subscription management with grace period support.
"""
from sqlmodel import Session, select
from datetime import date, datetime, timedelta
from typing import List
from backend.models import Student, Lead, AuditLog


def check_subscription_expirations(db: Session) -> List[int]:
    """
    Check for expired subscriptions and manage grace period logic.
    
    Logic:
    - For each student with subscription_end_date in the past:
      - If today <= (subscription_end_date + 4 days): Set in_grace_period = True
      - If today > (subscription_end_date + 4 days): Move to 'Nurture' and set is_active = False
    
    Args:
        db: Database session
        
    Returns:
        List of student IDs that were processed
    """
    today = date.today()
    
    # Find all active students with subscription_end_date in the past
    expired_students = db.exec(
        select(Student).where(
            Student.subscription_end_date.isnot(None),
            Student.subscription_end_date < today,
            Student.is_active == True
        )
    ).all()
    
    processed_student_ids = []
    
    for student in expired_students:
        end_date = student.subscription_end_date
        grace_period_end = end_date + timedelta(days=4)
        
        if today <= grace_period_end:
            # Within grace period (0-4 days after expiry)
            if not student.in_grace_period:
                student.in_grace_period = True
                student.renewal_intent = False  # Reset if grace period just started
                db.add(student)
                processed_student_ids.append(student.id)
        else:
            # Beyond grace period (>4 days after expiry)
            # Move associated lead to On Break and deactivate student
            if student.lead:
                lead = student.lead
                old_status = lead.status
                if lead.status == "Joined":
                    lead.status = "On Break"
                    lead.next_followup_date = None
                    lead.last_updated = datetime.utcnow()
                    
                    # Add Audit Log entry
                    audit_log = AuditLog(
                        lead_id=lead.id,
                        user_id=None,  # System-generated
                        action_type='status_change',
                        description='System: Subscription expired beyond grace period; student moved to On Break.',
                        old_value=old_status,
                        new_value="On Break",
                        timestamp=datetime.utcnow()
                    )
                    db.add(audit_log)
                    db.add(lead)
            
            # Deactivate student
            student.is_active = False
            student.in_grace_period = False
            student.renewal_intent = False
            db.add(student)
            processed_student_ids.append(student.id)
    
    if processed_student_ids:
        db.commit()
    
    return processed_student_ids

