"""
Student management and subscription API routes.
Skinny router: validates request, calls core, returns response.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session
from typing import Optional
from datetime import datetime
from pydantic import BaseModel

from backend.api.deps import get_current_user, get_session
from backend.core.students import (
    get_all_students,
    get_student_by_lead_id,
    get_student_by_public_token,
    get_student_with_relations,
    get_payment_unverified_students,
    update_renewal_intent_by_token,
    send_grace_nudge,
    can_user_view_student_milestones,
    verify_student_payment,
    submit_renewal_confirmation,
    update_student,
)
from backend.core.analytics import get_student_milestones
from backend.core.lead_privacy import mask_student_for_coach
from backend.models import User

router = APIRouter()


# --- ROSTER ---
@router.get("")
def get_students_endpoint(
    center_id: Optional[int] = None,
    is_active: Optional[bool] = None,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    from backend.schemas.students import StudentRead

    center_ids_arg = None
    if current_user.role in ("team_member", "observer"):
        user_center_ids = [c.id for c in current_user.centers]
        if not user_center_ids:
            students = []
        else:
            center_ids_arg = user_center_ids

    if center_ids_arg is not None and len(center_ids_arg) == 0:
        students = []
    else:
        students = get_all_students(
            db,
            center_id=center_id if current_user.role == "team_lead" else None,
            center_ids=center_ids_arg,
            is_active=is_active,
        )

    result = []
    for student in students:
        student_data = StudentRead.from_student(student)
        if current_user.role == "coach":
            student_dict = student_data.model_dump()
            masked_dict = mask_student_for_coach(student_dict)
            result.append(masked_dict)
        else:
            result.append(student_data.model_dump())
    return result


@router.get("/payment-unverified")
def get_payment_unverified_students_endpoint(
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "team_lead":
        raise HTTPException(status_code=403, detail="Only Team Lead can view payment audit")
    return get_payment_unverified_students(db)


@router.patch("/{student_id}/verify-payment")
@router.post("/{student_id}/verify-payment")
def verify_student_payment_endpoint(
    student_id: int,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "team_lead":
        raise HTTPException(status_code=403, detail="Only Team Lead can verify payment")
    try:
        verify_student_payment(db, student_id, current_user.id)
        return {"status": "ok", "is_payment_verified": True}
    except ValueError as e:
        if "not found" in str(e).lower():
            raise HTTPException(status_code=404, detail=str(e))
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/by-lead/{lead_id}")
def get_student_by_lead_endpoint(
    lead_id: int,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    from backend.schemas.students import StudentRead

    student = get_student_by_lead_id(db, lead_id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found for this lead")
    if current_user.role != "team_lead":
        user_center_ids = [c.id for c in current_user.centers]
        if student.center_id not in user_center_ids:
            raise HTTPException(status_code=403, detail="Not authorized to view this student")
    student_with_relations = get_student_with_relations(db, student.id)
    return StudentRead.from_student(student_with_relations).model_dump()


# --- PUBLIC RENEWAL (no auth) - must be before /{student_id} ---
@router.put("/renew/{public_token}")
def update_renewal_intent_endpoint(
    public_token: str,
    db: Session = Depends(get_session),
):
    try:
        return update_renewal_intent_by_token(db, public_token)
    except ValueError as e:
        msg = str(e)
        if "invalid" in msg.lower() or "not found" in msg.lower():
            raise HTTPException(status_code=404, detail=msg)
        raise HTTPException(status_code=400, detail=msg)


class RenewConfirmSubmit(BaseModel):
    subscription_plan: str
    subscription_start_date: str
    utr_number: Optional[str] = None
    payment_proof_url: Optional[str] = None
    kit_size: Optional[str] = None
    medical_info: Optional[str] = None
    secondary_contact: Optional[str] = None


@router.post("/renew-confirm/{public_token}")
def renew_confirm_public(
    public_token: str,
    body: RenewConfirmSubmit,
    db: Session = Depends(get_session),
):
    try:
        payload = body.model_dump()
        submit_renewal_confirmation(db, public_token, payload)
        return {"message": "Renewal submitted. We will verify your payment and get in touch."}
    except ValueError as e:
        msg = str(e)
        if "invalid" in msg.lower() or "not found" in msg.lower():
            raise HTTPException(status_code=404, detail=msg)
        raise HTTPException(status_code=400, detail=msg)


@router.get("/by-token/{public_token}")
def get_student_by_token_endpoint(
    public_token: str,
    db: Session = Depends(get_session),
):
    student = get_student_by_public_token(db, public_token)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found for this link")
    from backend.schemas.students import StudentRead
    return StudentRead.from_student(student)


# --- BY STUDENT ID ---
@router.put("/{student_id}")
def update_student_endpoint(
    student_id: int,
    center_id: Optional[int] = None,
    subscription_plan: Optional[str] = None,
    subscription_start_date: Optional[str] = None,
    subscription_end_date: Optional[str] = None,
    payment_proof_url: Optional[str] = None,
    student_batch_ids: Optional[str] = None,
    is_active: Optional[bool] = None,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    from backend.schemas.students import StudentRead

    student = get_student_with_relations(db, student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    if current_user.role != "team_lead":
        user_center_ids = [c.id for c in current_user.centers]
        if student.center_id not in user_center_ids:
            raise HTTPException(status_code=403, detail="Not authorized to update this student")

    batch_ids_list = None
    if student_batch_ids is not None:
        batch_ids_list = []
        if student_batch_ids:
            try:
                batch_ids_list = [int(x.strip()) for x in student_batch_ids.split(",") if x.strip()]
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid student_batch_ids format. Use comma-separated integers")

    parsed_start_date = None
    parsed_end_date = None
    if subscription_start_date:
        try:
            parsed_start_date = datetime.fromisoformat(subscription_start_date).date()
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid subscription_start_date format: {subscription_start_date}")
    if subscription_end_date:
        try:
            parsed_end_date = datetime.fromisoformat(subscription_end_date).date()
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid subscription_end_date format: {subscription_end_date}")

    try:
        update_student(
            db=db,
            student_id=student_id,
            user_id=current_user.id,
            user_role=current_user.role,
            center_id=center_id,
            subscription_plan=subscription_plan,
            subscription_start_date=parsed_start_date,
            subscription_end_date=parsed_end_date,
            payment_proof_url=payment_proof_url,
            student_batch_ids=batch_ids_list,
            is_active=is_active,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    updated_student = get_student_with_relations(db, student_id)
    return StudentRead.from_student(updated_student)


@router.get("/{student_id}/milestones")
def get_student_milestones_endpoint(
    student_id: int,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    student = get_student_with_relations(db, student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    user_center_ids = [c.id for c in current_user.centers]
    if not can_user_view_student_milestones(db, student_id, current_user.id, current_user.role, user_center_ids):
        raise HTTPException(status_code=403, detail="Not authorized to view this student")
    return get_student_milestones(db, student_id)


@router.post("/{student_id}/grace-nudge")
def send_grace_nudge_endpoint(
    student_id: int,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    student = get_student_with_relations(db, student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    if current_user.role != "team_lead":
        user_center_ids = [c.id for c in current_user.centers]
        if student.center_id not in user_center_ids:
            raise HTTPException(status_code=403, detail="Not authorized to update this student")
    try:
        return send_grace_nudge(db, student_id, current_user.id)
    except ValueError as e:
        msg = str(e)
        if "not found" in msg.lower():
            raise HTTPException(status_code=404, detail=msg)
        raise HTTPException(status_code=400, detail=msg)


@router.post("/{student_id}/send-welcome-email")
def send_welcome_email_endpoint(
    student_id: int,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    from backend.core.emails import send_welcome_email

    student = get_student_with_relations(db, student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    if current_user.role != "team_lead":
        user_center_ids = [c.id for c in current_user.centers]
        if student.center_id not in user_center_ids:
            raise HTTPException(status_code=403, detail="Not authorized for this student")
    try:
        result = send_welcome_email(db, student_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"message": "Welcome email sent", "to": result["to"]}


# --- SUBSCRIPTIONS ---
subscriptions_router = APIRouter()


@subscriptions_router.post("/run-expiry-check")
def run_subscription_expiry_check(
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "team_lead":
        raise HTTPException(status_code=403, detail="Only team leads can trigger subscription expiry check")
    from backend.core.subscriptions import check_subscription_expirations
    expired_lead_ids = check_subscription_expirations(db)
    return {"status": "success", "expired_count": len(expired_lead_ids), "expired_lead_ids": expired_lead_ids}
