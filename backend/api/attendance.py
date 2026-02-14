"""
Attendance and check-in API routes.
"""
from fastapi import APIRouter, Depends, HTTPException, Body
from sqlmodel import Session
from typing import Optional
from datetime import date, datetime

from backend.api.deps import get_current_user, get_session
from backend.core.attendance import record_attendance, get_attendance_history
from backend.schemas.attendance import AttendanceCreate, AttendanceRead
from backend.models import User, Student

router = APIRouter()


def _resolve_lead_id_from_body(db: Session, body: AttendanceCreate) -> int:
    """Resolve lead_id from body.lead_id or body.student_id."""
    if body.lead_id:
        return body.lead_id
    # Look up lead_id from student
    student = db.get(Student, body.student_id)
    if not student:
        raise ValueError(f"Student {body.student_id} not found")
    return student.lead_id


@router.post("/check-in")
def check_in_attendance(
    body: AttendanceCreate = Body(...),
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Record attendance for a lead in a batch (coach must be assigned to batch).
    Accepts JSON body with either lead_id (trial) or student_id (active student).
    """
    try:
        lead_id = _resolve_lead_id_from_body(db, body)
        attendance_date = body.date or date.today()
        attendance = record_attendance(
            db=db,
            lead_id=lead_id,
            batch_id=body.batch_id,
            user_id=current_user.id,
            date=attendance_date,
            status=body.status,
            remarks=body.remarks,
            internal_note=body.internal_note,
        )
        return AttendanceRead.model_validate(attendance)
    except ValueError as e:
        msg = str(e)
        if "not found" in msg.lower():
            raise HTTPException(status_code=404, detail=msg)
        if "not assigned" in msg.lower() or "not authorized" in msg.lower():
            raise HTTPException(status_code=403, detail=msg)
        raise HTTPException(status_code=400, detail=msg)


@router.get("/history/{lead_id}")
def get_attendance_history_endpoint(
    lead_id: int,
    limit: Optional[int] = None,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Get attendance history for a lead. Team leads see all; coaches see only their batches; others see if lead in their centers."""
    try:
        records = get_attendance_history(db, lead_id, current_user, limit=limit)
        return [AttendanceRead.model_validate(r) for r in records]
    except ValueError as e:
        msg = str(e)
        if "not found" in msg.lower():
            raise HTTPException(status_code=404, detail=msg)
        if "not authorized" in msg.lower():
            raise HTTPException(status_code=403, detail=msg)
        raise HTTPException(status_code=400, detail=msg)
