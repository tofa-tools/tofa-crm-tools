"""
Approval request API routes (status reversals, deactivations, universal requests).
Skinny router: validates request, calls core, returns response.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session
from typing import Optional

from backend.api.deps import get_current_user, get_session
from backend.core.approvals import (
    create_request,
    get_pending_requests_formatted,
    get_lead_requests_formatted,
    resolve_request,
)
from backend.models import User

router = APIRouter()


@router.post("/create")
def create_approval_request_endpoint(
    body: dict,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Submit a universal approval request (team leads and team members only)."""
    if current_user.role not in ("team_lead", "team_member"):
        raise HTTPException(status_code=403, detail="Access denied")
    try:
        req = create_request(
            db=db,
            requested_by_id=current_user.id,
            request_type=body.get("request_type", ""),
            reason=body.get("reason", ""),
            current_value=body.get("current_value", ""),
            requested_value=body.get("requested_value", ""),
            lead_id=body.get("lead_id"),
            student_id=body.get("student_id"),
        )
        if body.get("request_type") == "STATUS_REVERSAL":
            from backend.core.emails import send_internal_notification
            send_internal_notification(
                db,
                None,
                "Action Required: Approval Needed",
                "A Team Member has requested a status reversal. Please review and resolve the approval request.",
            )
        return {"status": "success", "message": "Request submitted for approval", "request_id": req.id}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/pending")
def get_pending_approval_requests_endpoint(
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Get pending approval requests. Team leads see all; team members see only their own."""
    if current_user.role not in ("team_lead", "team_member"):
        raise HTTPException(status_code=403, detail="Access denied")
    formatted = get_pending_requests_formatted(db, current_user.id, current_user.role)
    return {"requests": formatted, "count": len(formatted)}


@router.post("/{request_id}/resolve")
def resolve_approval_request_endpoint(
    request_id: int,
    approved: bool,
    resolution_note: Optional[str] = None,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Approve or reject an approval request (team leads only)."""
    if current_user.role != "team_lead":
        raise HTTPException(status_code=403, detail="Only team leads can resolve requests")
    try:
        req = resolve_request(
            db=db,
            request_id=request_id,
            resolved_by_id=current_user.id,
            approved=approved,
            resolution_note=resolution_note,
        )
        return {
            "status": "success",
            "message": f"Request {'approved' if approved else 'rejected'}",
            "request": {"id": req.id, "request_status": req.status},
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/lead/{lead_id}")
def get_lead_requests_endpoint(
    lead_id: int,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Get all approval requests for a specific lead."""
    return {"requests": get_lead_requests_formatted(db, lead_id)}
