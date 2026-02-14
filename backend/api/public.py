"""
Public API routes (no authentication required).
Delegates all logic to backend.core.
"""
from fastapi import APIRouter, Depends, HTTPException, Body

from backend.api.deps import get_session
from backend.core.public_preferences import (
    get_lead_preferences_by_token,
    update_lead_preferences_by_token,
    record_lead_feedback_by_token,
)
from backend.core.enrollment import (
    get_join_page_data,
    submit_lead_enrollment,
    submit_join_public,
)
from backend.schemas.leads import LeadPreferencesRead, LeadPreferencesUpdate
from backend.schemas.students import StudentRead
from pydantic import BaseModel
from typing import Optional
from sqlmodel import Session

router = APIRouter()


@router.get("/lead-preferences/{token}", response_model=LeadPreferencesRead)
def get_lead_preferences_public(token: str, db: Session = Depends(get_session)):
    """Get lead preferences by public token (no auth)."""
    preferences_data = get_lead_preferences_by_token(db, token)
    if not preferences_data:
        raise HTTPException(status_code=404, detail="Lead not found")
    return preferences_data


@router.put("/lead-preferences/{token}")
def update_lead_preferences_public(
    token: str,
    preferences: LeadPreferencesUpdate,
    db: Session = Depends(get_session),
):
    """Update lead preferences by public token (no auth)."""
    try:
        updated_lead = update_lead_preferences_by_token(
            db,
            token,
            preferred_batch_id=preferences.preferred_batch_id,
            preferred_demo_batch_id=preferences.preferred_demo_batch_id,
            preferred_call_time=preferences.preferred_call_time,
            preferred_timing_notes=preferences.preferred_timing_notes,
            loss_reason=preferences.loss_reason,
            loss_reason_notes=preferences.loss_reason_notes,
        )
        if not updated_lead:
            raise HTTPException(status_code=404, detail="Lead not found")
        return {"message": "Preferences updated successfully"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/join/{token}")
def get_join_page_public(token: str, db: Session = Depends(get_session)):
    """Get lead or student info for the public Enrollment & Payment page (no auth)."""
    try:
        return get_join_page_data(db, token)
    except ValueError as e:
        if "not found" in str(e).lower():
            raise HTTPException(status_code=404, detail=str(e))
        raise HTTPException(status_code=400, detail=str(e))


class PublicEnrollmentSubmit(BaseModel):
    email: str
    subscription_plan: str
    start_date: str
    batch_id: int
    utr_number: Optional[str] = None
    payment_proof_url: Optional[str] = None
    kit_size: Optional[str] = None
    medical_info: Optional[str] = None
    secondary_contact: Optional[str] = None


@router.post("/lead-enrollment/{token}")
def submit_enrollment_public(
    token: str,
    body: PublicEnrollmentSubmit,
    db: Session = Depends(get_session),
):
    """Submit enrollment (no auth). For leads with enrollment link sent."""
    try:
        payload = body.model_dump()
        return submit_lead_enrollment(db, token, payload)
    except ValueError as e:
        msg = str(e)
        if "not found" in msg.lower():
            raise HTTPException(status_code=404, detail=msg)
        raise HTTPException(status_code=400, detail=msg)


class PublicJoinSubmit(BaseModel):
    kit_size: Optional[str] = None
    secondary_contact: Optional[str] = None
    medical_info: Optional[str] = None
    utr_number: Optional[str] = None
    payment_proof_url: Optional[str] = None


@router.post("/join/{token}")
def submit_join_public_endpoint(
    token: str,
    body: PublicJoinSubmit,
    db: Session = Depends(get_session),
):
    """Submit enrollment and payment details (no auth). Converts lead to student."""
    try:
        payload = body.model_dump()
        student = submit_join_public(db, token, payload)
        return StudentRead.from_student(student)
    except ValueError as e:
        msg = str(e)
        if "not found" in msg.lower():
            raise HTTPException(status_code=404, detail=msg)
        raise HTTPException(status_code=400, detail=msg)


class LeadFeedbackBody(BaseModel):
    """JSON body for lead feedback (no auth)."""
    loss_reason: str
    loss_reason_notes: Optional[str] = None


@router.put("/lead-feedback/{token}")
def record_lead_feedback_public(
    token: str,
    body: LeadFeedbackBody = Body(...),
    db: Session = Depends(get_session),
):
    """Record feedback from a lead who is not interested (no auth). Accepts JSON body."""
    try:
        updated_lead = record_lead_feedback_by_token(
            db, token, loss_reason=body.loss_reason, loss_reason_notes=body.loss_reason_notes
        )
        if not updated_lead:
            raise HTTPException(status_code=404, detail="Lead not found")
        return {"message": "Feedback recorded successfully. We have removed you from our contact list."}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
