"""
Public enrollment and join page logic.
Framework-agnostic; no FastAPI dependencies.
"""
import os
from sqlmodel import Session, select
from sqlalchemy import and_
from typing import Optional, Dict, Any
from datetime import datetime, date as date_type, timedelta

from backend.models import Lead, Student, Center, Batch


def get_join_page_data(db: Session, token: str) -> Dict[str, Any]:
    """
    Get lead or student info for the public Enrollment & Payment page.
    Returns type 'lead' (new enrollment) or 'student' (renewal), and fields for form/UPI.
    Raises ValueError if lead not found.
    """
    lead = db.exec(select(Lead).where(Lead.public_token == token)).first()
    if not lead:
        raise ValueError("Lead not found")
    center = db.get(Center, lead.center_id) if lead.center_id else None
    center_name = center.display_name if center else "Unknown"
    student = db.exec(
        select(Student).where(and_(Student.lead_id == lead.id, Student.is_active == True))
    ).first()
    if student:
        return {
            "type": "student",
            "lead_id": lead.id,
            "student_id": student.id,
            "player_name": lead.player_name,
            "center_name": center_name,
            "plan_name": student.subscription_plan or "Monthly",
            "plan_price": getattr(student, "_plan_price", None),
        }
    batches_list = []
    if lead.center_id:
        batches = db.exec(
            select(Batch).where(
                and_(Batch.center_id == lead.center_id, Batch.is_active == True)
            )
        ).all()
        for b in batches:
            schedule_parts = []
            if b.is_mon: schedule_parts.append("Mon")
            if b.is_tue: schedule_parts.append("Tue")
            if b.is_wed: schedule_parts.append("Wed")
            if b.is_thu: schedule_parts.append("Thu")
            if b.is_fri: schedule_parts.append("Fri")
            if b.is_sat: schedule_parts.append("Sat")
            if b.is_sun: schedule_parts.append("Sun")
            schedule_str = ", ".join(schedule_parts) if schedule_parts else "No schedule"
            time_str = ""
            if b.start_time and b.end_time:
                time_str = f"{b.start_time.strftime('%I:%M %p').lstrip('0')} - {b.end_time.strftime('%I:%M %p').lstrip('0')}"
            batches_list.append({
                "id": b.id,
                "name": b.name,
                "min_age": getattr(b, "min_age", 0),
                "max_age": getattr(b, "max_age", 99),
                "schedule": schedule_str,
                "time": time_str,
            })
    link_expires_at = getattr(lead, "link_expires_at", None)
    return {
        "type": "lead",
        "lead_id": lead.id,
        "player_name": lead.player_name,
        "center_name": center_name,
        "plan_price": None,
        "link_expires_at": link_expires_at.isoformat() if link_expires_at else None,
        "batches": batches_list,
    }


def submit_lead_enrollment(db: Session, token: str, payload: Dict[str, Any]) -> Dict[str, str]:
    """
    Submit enrollment for leads with enrollment link sent.
    Sets status to 'Payment Pending Verification', stores pending_subscription_data.
    Raises ValueError on validation failure.
    """
    from backend.core.audit import log_lead_activity, log_status_change

    lead = db.exec(select(Lead).where(Lead.public_token == token)).first()
    if not lead:
        raise ValueError("Lead not found")
    utr = (payload.get("utr_number") or "").strip().replace(" ", "")
    has_utr = len(utr) == 12 and utr.isdigit()
    payment_proof = payload.get("payment_proof_url") or ""
    has_screenshot = bool(payment_proof.strip())
    if not has_utr and not has_screenshot:
        raise ValueError("Provide at least one: UTR (12 digits) or payment screenshot")
    if utr and (len(utr) != 12 or not utr.isdigit()):
        raise ValueError("UTR/Reference number must be exactly 12 digits")
    if not payload.get("email") or not str(payload["email"]).strip():
        raise ValueError("Email is required")
    if not payload.get("subscription_plan"):
        raise ValueError("Subscription plan is required")
    if not payload.get("start_date"):
        raise ValueError("Start date is required")
    batch_id = payload.get("batch_id")
    batch = db.get(Batch, batch_id)
    if not batch or batch.center_id != lead.center_id:
        raise ValueError("Invalid batch for this center")
    try:
        start_date = date_type.fromisoformat(str(payload["start_date"]))
    except (ValueError, TypeError):
        raise ValueError("Invalid start date format (use YYYY-MM-DD)")
    old_status = lead.status
    lead.status = "Payment Pending Verification"
    lead.email = str(payload["email"]).strip()
    lead.last_updated = datetime.utcnow()
    lead.pending_subscription_data = {
        "email": lead.email,
        "subscription_plan": payload["subscription_plan"],
        "start_date": payload["start_date"],
        "batch_id": batch_id,
        "utr_number": utr if has_utr else None,
        "payment_proof_url": payment_proof.strip() if has_screenshot else None,
        "kit_size": payload.get("kit_size"),
        "medical_info": payload.get("medical_info"),
        "secondary_contact": payload.get("secondary_contact"),
    }
    db.add(lead)
    db.commit()
    db.refresh(lead)
    log_status_change(db, lead.id, None, old_status, lead.status)
    log_lead_activity(
        db, lead.id, None, action_type="enrollment_submitted",
        description=f"Enrollment submitted via public page. Plan: {payload['subscription_plan']}. UTR: {utr or '—'}, screenshot: {'yes' if has_screenshot else 'no'}. Pending verification.",
    )
    return {"message": "Enrollment submitted. We will verify your payment and get in touch."}


def submit_join_public(db: Session, token: str, payload: Dict[str, Any]) -> Student:
    """
    Submit enrollment and payment details (public join page).
    For renewal: updates existing student with UTR/screenshot, returns Student with relations.
    For new enrollment: converts lead to student, returns Student with relations.
    Raises ValueError on validation failure.
    """
    from backend.core.students import convert_lead_to_student
    from backend.core.audit import log_lead_activity
    from sqlalchemy.orm import selectinload

    lead = db.exec(select(Lead).where(Lead.public_token == token)).first()
    if not lead:
        raise ValueError("Lead not found")
    utr = (payload.get("utr_number") or "").strip().replace(" ", "")
    has_utr = len(utr) == 12 and utr.isdigit()
    payment_proof = payload.get("payment_proof_url") or ""
    has_screenshot = bool(payment_proof.strip())
    if not has_utr and not has_screenshot:
        raise ValueError("Provide at least one: UTR (12 digits) or payment screenshot")
    if utr and (len(utr) != 12 or not utr.isdigit()):
        raise ValueError("UTR/Reference number must be exactly 12 digits")
    existing_student = db.exec(
        select(Student).where(and_(Student.lead_id == lead.id, Student.is_active == True))
    ).first()
    if existing_student:
        existing_student.utr_number = utr if has_utr else (existing_student.utr_number or None)
        existing_student.is_payment_verified = False
        if has_screenshot:
            existing_student.payment_proof_url = payment_proof.strip() if payment_proof else None
        if payload.get("kit_size") is not None:
            existing_student.kit_size = payload.get("kit_size") or None
        if payload.get("medical_info") is not None:
            existing_student.medical_info = payload.get("medical_info") or None
        if payload.get("secondary_contact") is not None:
            existing_student.secondary_contact = payload.get("secondary_contact") or None
        db.add(existing_student)
        db.commit()
        db.refresh(existing_student)
        log_lead_activity(db, lead.id, None, action_type="renewal_utr", description=f"Renewal UTR submitted via public page. UTR: {utr}. Pending Verification.")
        stmt = select(Student).where(Student.id == existing_student.id).options(
            selectinload(Student.lead), selectinload(Student.batches)
        )
        return db.exec(stmt).first()
    today = date_type.today()
    end_date = today + timedelta(days=31)
    student_batch_ids = [lead.preferred_batch_id] if getattr(lead, "preferred_batch_id", None) else []
    student_data = {
        "subscription_plan": "Monthly",
        "subscription_start_date": today,
        "subscription_end_date": end_date,
        "center_id": lead.center_id,
        "utr_number": utr if has_utr else None,
        "payment_proof_url": payment_proof.strip() if has_screenshot else None,
        "is_payment_verified": False,
        "kit_size": payload.get("kit_size") or None,
        "medical_info": payload.get("medical_info") or None,
        "secondary_contact": payload.get("secondary_contact") or None,
        "student_batch_ids": student_batch_ids,
    }
    student = convert_lead_to_student(db=db, lead_id=lead.id, student_data=student_data, user_id=None)
    log_lead_activity(
        db, lead.id, None, action_type="public_enrollment",
        description=f"Student enrolled via public page. UTR: {utr}. Pending Verification.",
    )
    try:
        center = db.get(Center, lead.center_id)
        center_name = (center.display_name or center.city or "Unknown") if center else "Unknown"
        from backend.core.emails import send_payment_received_alert
        send_payment_received_alert(db, lead, center_name, utr if has_utr else None, payment_proof.strip() if has_screenshot else None)
    except Exception:
        pass
    try:
        from backend.core.notifications import notify_center_users
        from urllib.parse import quote
        base_url = os.getenv("CRM_BASE_URL", "").strip().rstrip("/")
        link = f"{base_url}/leads?search={quote(lead.phone or '')}" if base_url and lead.phone else None
        notify_center_users(
            db, lead.center_id,
            type="FINANCE_ALERT",
            title=f"Payment to verify: {lead.player_name or 'Unknown'}",
            message="Parent submitted UTR/payment. Please verify and confirm enrollment.",
            link=link,
            priority="high",
        )
    except Exception:
        pass
    stmt = select(Student).where(Student.id == student.id).options(
        selectinload(Student.lead), selectinload(Student.batches)
    )
    return db.exec(stmt).first()
