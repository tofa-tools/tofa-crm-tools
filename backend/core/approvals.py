"""
Core logic for status change approval requests.
"""
from sqlmodel import Session, select
from typing import List, Optional
from datetime import datetime
from backend.models import StatusChangeRequest, Lead, User, Student, StudentBatchLink
from backend.core.leads import update_lead
from backend.core.audit import log_field_update


def create_request(
    db: Session,
    lead_id: int,
    requested_by_id: int,
    current_status: str,
    requested_status: str,
    reason: str
) -> StatusChangeRequest:
    """
    Create a new status change request.
    Only regular users can create requests (team leads can directly change status).
    """
    # Verify lead exists
    lead = db.get(Lead, lead_id)
    if not lead:
        raise ValueError(f"Lead {lead_id} not found")
    
    # Verify current status matches
    if lead.status != current_status:
        raise ValueError(f"Lead status mismatch. Current: {lead.status}, Expected: {current_status}")
    
    # Verify requested_by is a regular user
    user = db.get(User, requested_by_id)
    if not user:
        raise ValueError(f"User {requested_by_id} not found")
    
    if user.role == "team_lead":
        raise ValueError("Team leads cannot create approval requests. They can change status directly.")
    
    # Create request
    request = StatusChangeRequest(
        lead_id=lead_id,
        requested_by_id=requested_by_id,
        current_status=current_status,
        requested_status=requested_status,
        reason=reason,
        request_status="pending"
    )
    
    db.add(request)
    db.commit()
    db.refresh(request)
    return request


def get_pending_requests(db: Session) -> List[StatusChangeRequest]:
    """Get all pending status change requests."""
    statement = select(StatusChangeRequest).where(
        StatusChangeRequest.request_status == "pending"
    ).order_by(StatusChangeRequest.created_at.desc())
    
    return list(db.exec(statement).all())


def get_request_by_id(db: Session, request_id: int) -> Optional[StatusChangeRequest]:
    """Get a status change request by ID."""
    return db.get(StatusChangeRequest, request_id)


def resolve_request(
    db: Session,
    request_id: int,
    resolved_by_id: int,
    approved: bool,
    resolution_note: Optional[str] = None
) -> StatusChangeRequest:
    """
    Resolve a status change request (approve or reject).
    Only team leads can resolve requests.
    If approved, automatically update the lead status and log the change.
    """
    request = db.get(StatusChangeRequest, request_id)
    if not request:
        raise ValueError(f"Request {request_id} not found")
    
    if request.request_status != "pending":
        raise ValueError(f"Request {request_id} is already resolved")
    
    # Verify resolver is a team lead
    resolver = db.get(User, resolved_by_id)
    if not resolver:
        raise ValueError(f"User {resolved_by_id} not found")
    
    if resolver.role != "team_lead":
        raise ValueError("Only team leads can resolve approval requests")
    
    # Update request status
    request.request_status = "approved" if approved else "rejected"
    request.resolved_at = datetime.utcnow()
    request.resolved_by_id = resolved_by_id
    
    # If approved, update the lead status
    if approved:
        lead = db.get(Lead, request.lead_id)
        if not lead:
            raise ValueError(f"Lead {request.lead_id} not found")
        
        old_status = lead.status
        new_status = request.requested_status
        
        # HIGH-IMPACT REVERSAL: Handle reverting from 'Joined' status (Ghost Student cleanup)
        # Note: update_lead will handle the deletion, but we want to ensure it happens in this transaction
        if old_status == "Joined" and new_status != "Joined":
            # Find and delete associated Student record and batch links
            student = db.exec(
                select(Student).where(Student.lead_id == request.lead_id)
            ).first()
            
            if student:
                # Get resolver name for audit log
                resolver = db.get(User, resolved_by_id)
                resolver_name = resolver.full_name if resolver else "Unknown"
                
                # Delete all StudentBatchLink entries for this student
                batch_links = db.exec(
                    select(StudentBatchLink).where(StudentBatchLink.student_id == student.id)
                ).all()
                for link in batch_links:
                    db.delete(link)
                
                # Delete the Student record
                db.delete(student)
                db.flush()  # Ensure deletion happens before commit
                
                # Log the deletion to audit log
                from backend.core.audit import log_lead_activity
                log_lead_activity(
                    db=db,
                    lead_id=request.lead_id,
                    user_id=resolved_by_id,
                    action_type='student_deleted',
                    description=f'System: Student record deleted following status reversal approval by {resolver_name}.',
                    old_value='Student Record',
                    new_value='Deleted'
                )
        
        # Update lead status (update_lead will also check for Joined reversal, but we've already handled it)
        update_lead(
            db=db,
            lead_id=request.lead_id,
            status=new_status,
            user_id=resolved_by_id,
            comment=f"Status reversed from '{old_status}' to '{new_status}'. Reason: {request.reason}"
        )
        
        # Log the field update
        log_field_update(
            db=db,
            lead_id=request.lead_id,
            user_id=resolved_by_id,
            field_name='status',
            old_value=old_status,
            new_value=new_status
        )
    
    db.add(request)
    db.commit()
    db.refresh(request)
    return request


def get_requests_for_lead(db: Session, lead_id: int) -> List[StatusChangeRequest]:
    """Get all status change requests for a specific lead."""
    statement = select(StatusChangeRequest).where(
        StatusChangeRequest.lead_id == lead_id
    ).order_by(StatusChangeRequest.created_at.desc())
    
    return list(db.exec(statement).all())

