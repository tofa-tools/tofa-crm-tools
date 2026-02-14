"""
Lead management and staging API routes.
Skinny router: validates request, calls core, returns response.
"""
import json
import io
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Body, BackgroundTasks
from sqlmodel import Session
from typing import Optional, Dict
from datetime import datetime
import pandas as pd

from backend.api.deps import get_current_user, get_session
from backend.core.leads import (
    get_leads_for_user,
    update_lead,
    get_lead_by_id,
    import_leads_from_dataframe,
    increment_nudge_count,
    verify_and_enroll_from_pending,
    create_manual_lead,
    send_enrollment_link,
    update_lead_subscription_fields,
    notify_trial_scheduled,
    can_coach_update_lead_metadata,
)
from backend.core.audit import get_audit_logs_for_lead
from backend.core.bulk_operations import (
    bulk_update_lead_status,
    bulk_update_lead_assignment,
    verify_leads_accessible,
)
from backend.core.centers import get_all_centers
from backend.core.import_validation import preview_import_data, auto_detect_column_mapping
from backend.core.lead_metadata import update_lead_metadata
from backend.core.lead_privacy import serialize_leads_for_user
from backend.core.report_audit import log_report_sent
from backend.core.skills import create_skill_evaluation, get_skill_summary_for_lead
from backend.core.staging import create_staging_lead, get_staging_leads, promote_staging_lead
from backend.core.students import get_student_with_relations
from backend.models import User
from backend.schemas.leads import LeadRead
from backend.schemas.bulk import BulkUpdateStatusRequest, BulkAssignCenterRequest

router = APIRouter()


# --- IMPORT ---
@router.post("/preview")
async def preview_leads(
    file: UploadFile = File(...),
    column_mapping: Optional[str] = None,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "team_lead":
        raise HTTPException(status_code=403, detail="Only Team Leads can preview imports")

    file_extension = file.filename.split(".")[-1].lower() if file.filename else ""
    try:
        content = await file.read()
        df = None
        if file_extension in ["xlsx", "xls"]:
            df = pd.read_excel(io.BytesIO(content))
        else:
            for enc in ["utf-16", "utf-8-sig", "utf-8", "cp1252", "latin1"]:
                try:
                    df = pd.read_csv(io.BytesIO(content), encoding=enc, sep=None, engine="python")
                    break
                except Exception:
                    continue
            if df is None:
                raise ValueError("Could not decode CSV file. Please try saving the file as 'CSV UTF-8'.")

        if df.empty:
            return {"total_rows": 0, "valid_rows": 0, "preview_data": {"valid": [], "invalid": []}}

        df.columns = [str(c).strip() for c in df.columns]
        mapping_dict = json.loads(column_mapping) if column_mapping else auto_detect_column_mapping(df)
        known_centers = get_all_centers(db)
        preview_result = preview_import_data(df, mapping_dict, known_centers)
        preview_result["detected_mapping"] = mapping_dict
        return preview_result
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Preview Error: {str(e)}")


@router.post("/upload")
async def upload_leads(
    file: UploadFile = File(...),
    column_mapping: Optional[str] = None,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    background_tasks: BackgroundTasks = None,
):
    if current_user.role != "team_lead":
        raise HTTPException(status_code=403, detail="Only Team Leads can import data")

    file_extension = file.filename.split(".")[-1].lower() if file.filename else ""
    try:
        content = await file.read()
        df = None
        if file_extension in ["xlsx", "xls"]:
            df = pd.read_excel(io.BytesIO(content))
        else:
            for enc in ["utf-16", "utf-8-sig", "utf-8", "cp1252", "latin1"]:
                try:
                    df = pd.read_csv(io.BytesIO(content), encoding=enc, sep=None, engine="python")
                    break
                except Exception:
                    continue
            if df is None:
                raise ValueError("Could not decode CSV file.")

        df.columns = [str(c).strip() for c in df.columns]
        mapping = json.loads(column_mapping) if column_mapping else auto_detect_column_mapping(df)
        inv_map = {v: k for k, v in mapping.items()}
        df_mapped = df.rename(columns=inv_map)
        count, errors, summary_list = import_leads_from_dataframe(db, df_mapped, "center")
        if background_tasks and summary_list:
            from backend.core.emails import send_import_summary_background
            for s in summary_list:
                background_tasks.add_task(
                    send_import_summary_background,
                    s["center_id"],
                    s["center_name"],
                    s["count"],
                )
        return {"status": "success", "leads_added": count, "errors": errors}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Upload Error: {str(e)}")


# --- BULK ---
@router.post("/bulk/status")
def bulk_update_status(
    request: BulkUpdateStatusRequest,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    accessible_lead_ids = verify_leads_accessible(db, request.lead_ids, current_user)
    if len(accessible_lead_ids) != len(request.lead_ids):
        return {
            "updated_count": 0,
            "errors": ["Some leads are not accessible or not found"],
            "accessible_lead_ids": accessible_lead_ids,
        }
    return bulk_update_lead_status(
        db=db,
        lead_ids=accessible_lead_ids,
        new_status=request.new_status,
        user_id=current_user.id,
    )


@router.post("/bulk/assign")
def bulk_assign_center(
    request: BulkAssignCenterRequest,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "team_lead":
        raise HTTPException(status_code=403, detail="Only team leads can reassign leads")
    accessible_lead_ids = verify_leads_accessible(db, request.lead_ids, current_user)
    if len(accessible_lead_ids) != len(request.lead_ids):
        return {
            "updated_count": 0,
            "errors": ["Some leads are not accessible or not found"],
            "accessible_lead_ids": accessible_lead_ids,
        }
    return bulk_update_lead_assignment(
        db=db,
        lead_ids=accessible_lead_ids,
        new_center_id=request.center_id,
        user_id=current_user.id,
    )


# --- PIPELINE ---
@router.get("/my_leads")
def get_my_leads(
    limit: Optional[int] = None,
    offset: int = 0,
    status: Optional[str] = None,
    search: Optional[str] = None,
    sort_by: str = "created_time",
    next_follow_up_date: Optional[str] = None,
    filter: Optional[str] = None,
    loss_reason: Optional[str] = None,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    at_risk_filter = filter == "at-risk" if filter else None
    overdue_filter = filter == "overdue" if filter else None
    nudge_failures_filter = filter == "nudge_failures" if filter else None
    status_arg = status if status else ("New" if filter == "new" else None)
    leads, total = get_leads_for_user(
        db,
        current_user,
        limit=limit,
        offset=offset,
        status_filter=status_arg,
        search=search,
        sort_by=sort_by,
        loss_reason_filter=loss_reason,
        next_follow_up_date_filter=next_follow_up_date,
        at_risk_filter=at_risk_filter,
        overdue_filter=overdue_filter,
        nudge_failures_filter=nudge_failures_filter,
    )
    serialized_leads = serialize_leads_for_user(leads, current_user.role)
    return {"leads": serialized_leads, "total": total, "limit": limit, "offset": offset, "sort_by": sort_by}


@router.post("")
async def create_lead_endpoint(
    player_name: str = Body(...),
    phone: str = Body(...),
    email: Optional[str] = Body(None),
    address: Optional[str] = Body(None),
    date_of_birth: Optional[str] = Body(None),
    center_id: int = Body(...),
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in ("team_lead", "team_member"):
        raise HTTPException(status_code=403, detail="Only Team Leads and Team Members can create leads")
    if current_user.role == "team_member":
        user_center_ids = [c.id for c in current_user.centers]
        if center_id not in user_center_ids:
            raise HTTPException(status_code=403, detail="You can only create leads in your assigned centers")
    try:
        payload = {
            "player_name": player_name,
            "phone": phone,
            "email": email,
            "address": address,
            "date_of_birth": date_of_birth,
            "center_id": center_id,
        }
        return create_manual_lead(db, payload, current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/{lead_id}")
def update_lead_endpoint(
    lead_id: int,
    status: str,
    next_date: Optional[str] = None,
    comment: Optional[str] = None,
    date_of_birth: Optional[str] = None,
    trial_batch_id: Optional[int] = None,
    permanent_batch_id: Optional[int] = None,
    student_batch_ids: Optional[str] = None,
    subscription_plan: Optional[str] = None,
    subscription_start_date: Optional[str] = None,
    subscription_end_date: Optional[str] = None,
    payment_proof_url: Optional[str] = None,
    call_confirmation_note: Optional[str] = None,
    loss_reason: Optional[str] = None,
    loss_reason_notes: Optional[str] = None,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    from datetime import date as date_type

    student_batch_ids_list = None
    if student_batch_ids:
        try:
            student_batch_ids_list = [int(x.strip()) for x in student_batch_ids.split(",") if x.strip()]
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid student_batch_ids format. Use comma-separated integers")

    subscription_start_date_obj = None
    subscription_end_date_obj = None
    if subscription_start_date:
        try:
            subscription_start_date_obj = datetime.fromisoformat(subscription_start_date).date()
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid subscription_start_date format: {subscription_start_date}. Use YYYY-MM-DD")
    if subscription_end_date:
        try:
            subscription_end_date_obj = datetime.fromisoformat(subscription_end_date).date()
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid subscription_end_date format: {subscription_end_date}. Use YYYY-MM-DD")

    try:
        updated_lead = update_lead(
            db=db,
            lead_id=lead_id,
            status=status,
            next_date=next_date,
            comment=comment,
            user_id=current_user.id,
            date_of_birth=date_type.fromisoformat(date_of_birth) if (date_of_birth and isinstance(date_of_birth, str)) else None,
            trial_batch_id=trial_batch_id,
            permanent_batch_id=permanent_batch_id,
            student_batch_ids=student_batch_ids_list,
            payment_proof_url=payment_proof_url,
            call_confirmation_note=call_confirmation_note,
            loss_reason=loss_reason,
            loss_reason_notes=loss_reason_notes,
        )

        if subscription_plan is not None or subscription_start_date_obj is not None or subscription_end_date_obj is not None:
            update_lead_subscription_fields(
                db, lead_id,
                subscription_plan=subscription_plan,
                subscription_start_date=subscription_start_date_obj,
                subscription_end_date=subscription_end_date_obj,
            )
        if status == "Trial Scheduled":
            notify_trial_scheduled(db, lead_id)
        updated_lead = get_lead_by_id(db, lead_id)
        if updated_lead:
            return LeadRead.model_validate(updated_lead)
        return {"status": "updated"}
    except ValueError as e:
        error_message = str(e)
        if "CAPACITY_REACHED" in error_message:
            raise HTTPException(status_code=400, detail=error_message)
        raise HTTPException(status_code=400, detail=error_message)


@router.post("/{lead_id}/convert")
def convert_lead_to_student_endpoint(
    lead_id: int,
    subscription_plan: str,
    subscription_start_date: str,
    subscription_end_date: Optional[str] = None,
    payment_proof_url: Optional[str] = None,
    student_batch_ids: Optional[str] = None,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    from backend.core.students import convert_lead_to_student

    lead = get_lead_by_id(db, lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    if current_user.role != "team_lead":
        user_center_ids = [c.id for c in current_user.centers]
        if lead.center_id not in user_center_ids:
            raise HTTPException(status_code=403, detail="Not authorized to convert this lead")

    try:
        subscription_start_date_obj = datetime.fromisoformat(subscription_start_date).date()
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid subscription_start_date format: {subscription_start_date}. Use YYYY-MM-DD")
    subscription_end_date_obj = None
    if subscription_end_date:
        try:
            subscription_end_date_obj = datetime.fromisoformat(subscription_end_date).date()
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid subscription_end_date format: {subscription_end_date}. Use YYYY-MM-DD")

    student_batch_ids_list = []
    if student_batch_ids:
        try:
            student_batch_ids_list = [int(x.strip()) for x in student_batch_ids.split(",") if x.strip()]
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid student_batch_ids format. Use comma-separated integers")

    student_data = {
        "subscription_plan": subscription_plan,
        "subscription_start_date": subscription_start_date_obj,
        "subscription_end_date": subscription_end_date_obj,
        "payment_proof_url": payment_proof_url,
        "student_batch_ids": student_batch_ids_list,
        "center_id": lead.center_id,
    }
    try:
        student = convert_lead_to_student(db=db, lead_id=lead_id, student_data=student_data, user_id=current_user.id)
        from backend.schemas.students import StudentRead
        student_with_relations = get_student_with_relations(db, student.id)
        return StudentRead.from_student(student_with_relations)
    except ValueError as e:
        error_message = str(e)
        if "CAPACITY_REACHED" in error_message:
            raise HTTPException(status_code=400, detail=error_message)
        raise HTTPException(status_code=400, detail=error_message)


@router.post("/{lead_id}/send-enrollment-link")
def send_enrollment_link_endpoint(
    lead_id: int,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    lead = get_lead_by_id(db, lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    if lead.status != "Trial Attended":
        raise HTTPException(status_code=400, detail="Lead must be in Trial Attended status")
    if current_user.role != "team_lead":
        user_center_ids = [c.id for c in current_user.centers]
        if lead.center_id not in user_center_ids:
            raise HTTPException(status_code=403, detail="Not authorized for this lead")
    try:
        return send_enrollment_link(db, lead_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{lead_id}/verify-and-enroll")
def verify_and_enroll_lead_endpoint(
    lead_id: int,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "team_lead":
        raise HTTPException(status_code=403, detail="Only Team Lead can verify and enroll")
    try:
        student = verify_and_enroll_from_pending(db, lead_id, current_user.id)
        from backend.schemas.students import StudentRead
        return StudentRead.from_student(student)
    except ValueError as e:
        msg = str(e)
        if "not found" in msg.lower():
            raise HTTPException(status_code=404, detail=msg)
        raise HTTPException(status_code=400, detail=msg)


@router.put("/{lead_id}/date-of-birth")
def update_date_of_birth_endpoint(
    lead_id: int,
    date_of_birth: Optional[str] = Body(None),
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    from datetime import date as date_type

    lead = get_lead_by_id(db, lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    if current_user.role != "team_lead":
        user_center_ids = [c.id for c in current_user.centers]
        if lead.center_id not in user_center_ids:
            raise HTTPException(status_code=403, detail="Not authorized to update this lead")
    dob_parsed = None
    if date_of_birth:
        try:
            dob_parsed = date_type.fromisoformat(date_of_birth)
        except (ValueError, TypeError):
            raise HTTPException(status_code=400, detail="date_of_birth must be YYYY-MM-DD")
    try:
        updated_lead = update_lead(
            db=db,
            lead_id=lead_id,
            status=lead.status,
            date_of_birth=dob_parsed,
            user_id=current_user.id,
        )
        return {"status": "updated", "date_of_birth": updated_lead.date_of_birth.isoformat() if updated_lead.date_of_birth else None}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.put("/{lead_id}/metadata")
def update_lead_metadata_endpoint(
    lead_id: int,
    metadata: Dict = Body(...),
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    lead = get_lead_by_id(db, lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    if current_user.role == "coach":
        if not can_coach_update_lead_metadata(db, lead_id, current_user.id):
            raise HTTPException(status_code=403, detail="You don't have access to update this lead/student")
        if set(metadata.keys()) != {"skill_reports"}:
            raise HTTPException(status_code=403, detail="Coaches can only update skill reports")
    elif current_user.role != "team_lead":
        user_center_ids = [c.id for c in current_user.centers]
        if lead.center_id not in user_center_ids:
            raise HTTPException(status_code=403, detail="Not authorized to update this lead")
    try:
        updated_lead = update_lead_metadata(db=db, lead_id=lead_id, metadata_updates=metadata, user_id=current_user.id)
        return {"status": "updated", "metadata": updated_lead.extra_data}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/{lead_id}/activity")
def get_lead_activity(
    lead_id: int,
    limit: Optional[int] = 50,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    lead = get_lead_by_id(db, lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    if current_user.role != "team_lead":
        user_center_ids = [c.id for c in current_user.centers]
        if lead.center_id not in user_center_ids:
            raise HTTPException(status_code=403, detail="Not authorized to view this lead")
    logs = get_audit_logs_for_lead(db, lead_id, limit=limit)
    return {"activities": logs}


@router.post("/{lead_id}/report-sent")
async def log_report_sent_endpoint(
    lead_id: int,
    details: Optional[str] = None,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    try:
        audit_log = log_report_sent(
            db=db,
            lead_id=lead_id,
            user_id=current_user.id,
            details=details or "Progress Card shared with parent via WhatsApp",
        )
        return {"status": "success", "audit_log_id": audit_log.id, "message": "Report sent action logged successfully"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{lead_id}/skills")
async def create_skill_evaluation_endpoint(
    lead_id: int,
    technical_score: int,
    fitness_score: int,
    teamwork_score: int,
    discipline_score: int,
    coach_notes: Optional[str] = None,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "coach":
        raise HTTPException(status_code=403, detail="Only coaches can create skill evaluations")
    try:
        return create_skill_evaluation(
            db=db,
            lead_id=lead_id,
            coach_id=current_user.id,
            technical_score=technical_score,
            fitness_score=fitness_score,
            teamwork_score=teamwork_score,
            discipline_score=discipline_score,
            coach_notes=coach_notes,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{lead_id}/skills/summary")
async def get_skill_summary_endpoint(
    lead_id: int,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    lead = get_lead_by_id(db, lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    if current_user.role == "coach":
        user_leads, _ = get_leads_for_user(db, current_user, limit=10000)
        if not any(l.id == lead_id for l in user_leads):
            raise HTTPException(status_code=403, detail="You don't have access to this lead")
    return get_skill_summary_for_lead(db, lead_id)


@router.post("/{lead_id}/nudge")
def send_nudge_endpoint(
    lead_id: int,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    try:
        updated_lead = increment_nudge_count(db, lead_id, current_user.id)
        return {"message": "Nudge sent successfully", "nudge_count": updated_lead.nudge_count}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error sending nudge: {str(e)}")


# --- STAGING (included with prefix="/staging") ---
staging_router = APIRouter()


@staging_router.post("/leads")
async def create_staging_lead_endpoint(
    player_name: str = Body(...),
    phone: str = Body(...),
    email: Optional[str] = Body(None),
    age: Optional[int] = Body(None),
    date_of_birth: Optional[str] = Body(None),
    center_id: int = Body(...),
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in ("coach", "team_lead", "team_member"):
        raise HTTPException(status_code=403, detail="Only coaches and team members can create staging leads")
    from datetime import date as date_type
    dob_parsed = None
    if date_of_birth:
        try:
            dob_parsed = date_type.fromisoformat(date_of_birth)
        except (ValueError, TypeError):
            raise HTTPException(status_code=400, detail="date_of_birth must be YYYY-MM-DD")
    try:
        return create_staging_lead(
            db=db,
            player_name=player_name,
            phone=phone,
            email=email,
            age=age,
            date_of_birth=dob_parsed,
            center_id=center_id,
            created_by_id=current_user.id,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@staging_router.get("/leads")
async def get_staging_leads_endpoint(
    center_id: Optional[int] = None,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in ["team_lead", "team_member"]:
        raise HTTPException(status_code=403, detail="Only Team Leads and Team Members can view staging leads")
    return get_staging_leads(db=db, user=current_user, center_id=center_id)


@staging_router.post("/leads/{staging_id}/promote")
async def promote_staging_lead_endpoint(
    staging_id: int,
    date_of_birth: Optional[str] = Body(None),
    email: Optional[str] = Body(None),
    address: Optional[str] = Body(None),
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in ["team_lead", "team_member"]:
        raise HTTPException(status_code=403, detail="Only Team Leads and Team Members can promote staging leads")
    from datetime import date as date_type
    dob_parsed = None
    if date_of_birth:
        try:
            dob_parsed = date_type.fromisoformat(date_of_birth)
        except (ValueError, TypeError):
            raise HTTPException(status_code=400, detail="date_of_birth must be YYYY-MM-DD")
    try:
        lead = promote_staging_lead(
            db=db,
            staging_id=staging_id,
            date_of_birth=dob_parsed,
            email=email,
            address=address,
            user_id=current_user.id,
        )
        return {"id": lead.id, "player_name": lead.player_name, "phone": lead.phone, "status": lead.status, "center_id": lead.center_id}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
