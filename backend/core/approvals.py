"""
Unified approval request system.
Single table for all Team Member requests. Generic create_request and resolve_request.
"""
from sqlmodel import Session, select
from typing import List, Optional
from datetime import datetime

from backend.models import ApprovalRequest, Lead, User, Student, StudentBatchLink, Center
from backend.core.leads import update_lead
from backend.core.audit import log_field_update, log_lead_activity

REQUEST_TYPES = ("STATUS_REVERSAL", "DEACTIVATE", "CENTER_TRANSFER", "AGE_GROUP", "DATA_UPDATE", "DATE_OF_BIRTH", "BATCH_UPDATE", "SUBSCRIPTION_UPDATE")


def create_request(
    db: Session,
    requested_by_id: int,
    request_type: str,
    reason: str,
    current_value: str = "",
    requested_value: str = "",
    lead_id: Optional[int] = None,
    student_id: Optional[int] = None,
) -> ApprovalRequest:
    """
    Generic create_request for any request_type.
    Team leads cannot create requests (they act directly).
    """
    if request_type not in REQUEST_TYPES:
        raise ValueError(f"Invalid request_type. Allowed: {REQUEST_TYPES}")

    user = db.get(User, requested_by_id)
    if not user:
        raise ValueError(f"User {requested_by_id} not found")
    if user.role == "team_lead":
        raise ValueError("Team leads cannot create approval requests. They act directly.")

    # Validate type-specific requirements
    if request_type == "STATUS_REVERSAL" and not lead_id:
        raise ValueError("lead_id required for STATUS_REVERSAL")
    if request_type == "AGE_GROUP" and not lead_id:
        raise ValueError("lead_id required for AGE_GROUP")
    if request_type == "DEACTIVATE" and not student_id:
        raise ValueError("student_id required for DEACTIVATE")
    if request_type == "CENTER_TRANSFER" and not student_id:
        raise ValueError("student_id required for CENTER_TRANSFER")
    if request_type == "BATCH_UPDATE" and not student_id:
        raise ValueError("student_id required for BATCH_UPDATE")
    if request_type == "SUBSCRIPTION_UPDATE" and not student_id:
        raise ValueError("student_id required for SUBSCRIPTION_UPDATE")

    req = ApprovalRequest(
        requested_by_id=requested_by_id,
        lead_id=lead_id,
        student_id=student_id,
        request_type=request_type,
        current_value=current_value,
        requested_value=requested_value,
        reason=reason,
        status="pending",
    )
    db.add(req)
    db.commit()
    db.refresh(req)
    return req


def get_pending_requests(db: Session) -> List[ApprovalRequest]:
    """Get all pending approval requests."""
    stmt = select(ApprovalRequest).where(
        ApprovalRequest.status == "pending"
    ).order_by(ApprovalRequest.created_at.desc())
    return list(db.exec(stmt).all())


def get_pending_requests_formatted(
    db: Session, user_id: int, user_role: str
) -> List[dict]:
    """Get pending requests formatted for API. Team leads see all; team members see only their own."""
    requests = get_pending_requests(db)
    formatted = []
    for req in requests:
        lead = db.get(Lead, req.lead_id) if req.lead_id else None
        student = db.get(Student, req.student_id) if req.student_id else None
        lead_for_name = lead or (db.get(Lead, student.lead_id) if student else None)
        requester = db.get(User, req.requested_by_id)
        formatted.append({
            "id": req.id,
            "request_type": req.request_type,
            "lead_id": req.lead_id,
            "student_id": req.student_id,
            "lead_name": lead_for_name.player_name if lead_for_name else "Unknown",
            "requested_by_id": req.requested_by_id,
            "requested_by_name": requester.full_name if requester else "Unknown",
            "current_value": req.current_value,
            "requested_value": req.requested_value,
            "reason": req.reason,
            "status": req.status,
            "created_at": req.created_at.isoformat() if req.created_at else None,
        })
    if user_role == "team_member":
        formatted = [r for r in formatted if r["requested_by_id"] == user_id]
    formatted.sort(key=lambda x: x.get("created_at") or "", reverse=True)
    return formatted


def get_lead_requests_formatted(db: Session, lead_id: int) -> List[dict]:
    """Get approval requests for a lead, formatted for API."""
    requests = get_requests_for_lead(db, lead_id)
    formatted = []
    for req in requests:
        requester = db.get(User, req.requested_by_id)
        resolver = db.get(User, req.resolved_by_id) if req.resolved_by_id else None
        formatted.append({
            "id": req.id,
            "type": req.request_type,
            "current_status": req.current_value,
            "requested_status": req.requested_value,
            "reason": req.reason,
            "request_status": req.status,
            "requested_by_name": requester.full_name if requester else "Unknown",
            "resolved_by_name": resolver.full_name if resolver else None,
            "created_at": req.created_at.isoformat() if req.created_at else None,
            "resolved_at": req.resolved_at.isoformat() if req.resolved_at else None,
        })
    formatted.sort(key=lambda x: x.get("created_at") or "", reverse=True)
    return formatted


def get_requests_for_lead(db: Session, lead_id: int) -> List[ApprovalRequest]:
    """Get all approval requests for a lead (any status)."""
    direct = list(db.exec(
        select(ApprovalRequest).where(ApprovalRequest.lead_id == lead_id)
    ).all())
    student_ids = [s.id for s in db.exec(select(Student).where(Student.lead_id == lead_id)).all()]
    if not student_ids:
        return sorted(direct, key=lambda r: r.created_at or datetime.min, reverse=True)
    via_student = list(db.exec(
        select(ApprovalRequest).where(ApprovalRequest.student_id.in_(student_ids))
    ).all())
    seen = {r.id for r in direct}
    for r in via_student:
        if r.id not in seen:
            direct.append(r)
            seen.add(r.id)
    return sorted(direct, key=lambda r: r.created_at or datetime.min, reverse=True)


def resolve_request(
    db: Session,
    request_id: int,
    resolved_by_id: int,
    approved: bool,
    resolution_note: Optional[str] = None,
) -> ApprovalRequest:
    """
    Resolve an approval request. Team leads only.
    When approved: look at request_type, perform the appropriate action, log to Audit.
    """
    req = db.get(ApprovalRequest, request_id)
    if not req:
        raise ValueError(f"Request {request_id} not found")
    if req.status != "pending":
        raise ValueError(f"Request {request_id} is already resolved")

    resolver = db.get(User, resolved_by_id)
    if not resolver or resolver.role != "team_lead":
        raise ValueError("Only team leads can resolve approval requests")

    req.status = "approved" if approved else "rejected"
    req.resolved_at = datetime.utcnow()
    req.resolved_by_id = resolved_by_id

    if approved:
        if req.request_type == "STATUS_REVERSAL":
            _apply_status_reversal(db, req, resolved_by_id)
        elif req.request_type == "AGE_GROUP" or req.request_type == "DATE_OF_BIRTH":
            _apply_date_of_birth(db, req, resolved_by_id)
        elif req.request_type == "DEACTIVATE":
            _apply_deactivate(db, req, resolved_by_id)
        elif req.request_type == "CENTER_TRANSFER":
            _apply_center_transfer(db, req, resolved_by_id)
        elif req.request_type == "BATCH_UPDATE":
            _apply_batch_update(db, req, resolved_by_id)
        elif req.request_type == "SUBSCRIPTION_UPDATE":
            _apply_subscription_update(db, req, resolved_by_id)

    db.add(req)
    db.commit()
    db.refresh(req)
    try:
        from backend.core.notifications import send_notification
        from backend.core.leads import get_lead_player_name
        from urllib.parse import quote
        player_name = get_lead_player_name(db, req.lead_id)
        status_text = "Approved" if approved else "Rejected"
        send_notification(
            db, req.requested_by_id,
            type="GOVERNANCE_ALERT",
            title=f"Request {status_text}: {player_name}",
            message=f"Update: Your status change request for {player_name} has been {status_text}.",
            target_url=f"/leads?search={quote(player_name)}",
            priority="high",
        )
    except Exception:
        pass
    return req


def _apply_status_reversal(db: Session, req: ApprovalRequest, user_id: int) -> None:
    lead = db.get(Lead, req.lead_id) if req.lead_id else None
    if not lead:
        return
    old_status = lead.status
    new_status = req.requested_value or old_status

    if old_status == "Joined" and new_status != "Joined":
        student = db.exec(select(Student).where(Student.lead_id == req.lead_id)).first()
        if student:
            batch_links = db.exec(
                select(StudentBatchLink).where(StudentBatchLink.student_id == student.id)
            ).all()
            for link in batch_links:
                db.delete(link)
            db.delete(student)
            db.flush()
            log_lead_activity(
                db=db, lead_id=req.lead_id, user_id=user_id,
                action_type="student_deleted",
                description=f"Student record deleted following status reversal. Reason: {req.reason}",
                old_value="Student Record", new_value="Deleted",
            )

    update_lead(
        db=db, lead_id=req.lead_id, status=new_status, user_id=user_id,
        comment=f"Status reversed from '{old_status}' to '{new_status}'. Reason: {req.reason}",
    )
    log_field_update(db=db, lead_id=req.lead_id, user_id=user_id, field_name="status", old_value=old_status, new_value=new_status)


def _apply_date_of_birth(db: Session, req: ApprovalRequest, user_id: int) -> None:
    lead = db.get(Lead, req.lead_id) if req.lead_id else None
    if not lead:
        return
    from datetime import date as date_type
    new_dob = None
    if req.requested_value:
        try:
            new_dob = date_type.fromisoformat(req.requested_value)
        except (ValueError, TypeError):
            pass
    old_dob_str = lead.date_of_birth.isoformat() if lead.date_of_birth else ""
    new_dob_str = new_dob.isoformat() if new_dob else ""
    update_lead(db=db, lead_id=req.lead_id, status=lead.status, date_of_birth=new_dob, user_id=user_id)
    log_field_update(db=db, lead_id=req.lead_id, user_id=user_id, field_name="date_of_birth", old_value=old_dob_str, new_value=new_dob_str)


def _apply_deactivate(db: Session, req: ApprovalRequest, user_id: int) -> None:
    student = db.get(Student, req.student_id) if req.student_id else None
    if not student:
        return
    student.is_active = False
    db.add(student)
    if student.lead_id:
        log_lead_activity(
            db=db, lead_id=student.lead_id, user_id=user_id,
            action_type="student_deactivated",
            description=f"Student deactivated via approval. Reason: {req.reason}",
            old_value="True", new_value="False",
        )


def _apply_center_transfer(db: Session, req: ApprovalRequest, user_id: int) -> None:
    from backend.core.students import update_student
    student = db.get(Student, req.student_id) if req.student_id else None
    if not student or not student.lead_id:
        return
    try:
        center_id = int(req.requested_value)
    except (ValueError, TypeError):
        return
    update_student(
        db=db, student_id=student.id, user_id=user_id, user_role="team_lead",
        center_id=center_id, student_batch_ids=[],
    )
    log_lead_activity(
        db=db, lead_id=student.lead_id, user_id=user_id,
        action_type="center_transferred",
        description=f"Student transferred to new center. Reason: {req.reason}",
    )


def _apply_batch_update(db: Session, req: ApprovalRequest, user_id: int) -> None:
    """Apply BATCH_UPDATE: requested_value is comma-separated batch IDs."""
    from backend.core.students import update_student
    student = db.get(Student, req.student_id) if req.student_id else None
    if not student:
        return
    try:
        batch_ids = [int(x.strip()) for x in req.requested_value.split(",") if x.strip()]
    except (ValueError, TypeError):
        return
    update_student(
        db=db, student_id=student.id, user_id=user_id, user_role="team_lead",
        student_batch_ids=batch_ids,
    )
    log_lead_activity(
        db=db, lead_id=student.lead_id, user_id=user_id,
        action_type="batch_assignment_updated",
        description=f"Assigned batches updated via approval. Reason: {req.reason}",
    )


def _apply_subscription_update(db: Session, req: ApprovalRequest, user_id: int) -> None:
    """Apply SUBSCRIPTION_UPDATE: requested_value is 'plan|start_date'. Computes end_date from plan."""
    import calendar
    from backend.core.students import update_student
    from datetime import date as date_type
    student = db.get(Student, req.student_id) if req.student_id else None
    if not student:
        return
    parts = req.requested_value.split("|")
    plan = parts[0].strip() if parts else None
    start_str = parts[1].strip() if len(parts) > 1 else None
    start_date = None
    if start_str:
        try:
            start_date = date_type.fromisoformat(start_str)
        except (ValueError, TypeError):
            pass
    if not plan or not start_date:
        return
    plan_months = {"Monthly": 1, "Quarterly": 3, "6 Months": 6, "Yearly": 12}.get(plan, 1)
    new_month = start_date.month + plan_months
    year = start_date.year + (new_month - 1) // 12
    month = (new_month - 1) % 12 + 1
    day = min(start_date.day, calendar.monthrange(year, month)[1])
    end_date = date_type(year, month, day)
    update_student(
        db=db, student_id=student.id, user_id=user_id, user_role="team_lead",
        subscription_plan=plan,
        subscription_start_date=start_date,
        subscription_end_date=end_date,
    )
    log_lead_activity(
        db=db, lead_id=student.lead_id, user_id=user_id,
        action_type="subscription_updated",
        description=f"Subscription updated via approval. Reason: {req.reason}",
    )
