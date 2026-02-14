"""
Batch management API routes.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session
from typing import Optional
from datetime import datetime

from backend.api.deps import get_current_user, get_session
from backend.core.batches import (
    create_batch,
    assign_coach_to_batch,
    assign_coaches_to_batch,
    get_coach_batches,
    get_all_batches,
    get_batch_coaches,
    update_batch,
    delete_batch,
)
from backend.core.reactivations import get_potential_reactivations
from backend.core.lead_privacy import serialize_leads_for_user
from backend.models import User

router = APIRouter()


@router.get("/my-batches", tags=["Batches"])
def get_my_batches_endpoint(
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Get batches assigned to the current user (coaches only)."""
    if current_user.role != "coach":
        raise HTTPException(status_code=403, detail="Only coaches can view their assigned batches")

    batches = get_coach_batches(db, current_user.id)
    return {"batches": batches, "count": len(batches)}


@router.get("", tags=["Batches"])
def get_batches_endpoint(
    center_id: Optional[int] = None,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """
    Get all batches, optionally filtered by center.
    Team Leads see all batches (active and inactive).
    Coaches and Sales see only active batches.
    """
    batches = get_all_batches(db, user=current_user, center_id=center_id)

    batches_with_coaches = []
    for batch in batches:
        schedule_days = []
        if batch.is_mon:
            schedule_days.append("Mon")
        if batch.is_tue:
            schedule_days.append("Tue")
        if batch.is_wed:
            schedule_days.append("Wed")
        if batch.is_thu:
            schedule_days.append("Thu")
        if batch.is_fri:
            schedule_days.append("Fri")
        if batch.is_sat:
            schedule_days.append("Sat")
        if batch.is_sun:
            schedule_days.append("Sun")
        schedule_string = ", ".join(schedule_days) if schedule_days else "No days selected"

        batch_dict = {
            "id": batch.id,
            "name": batch.name,
            "center_id": batch.center_id,
            "min_age": batch.min_age,
            "max_age": batch.max_age,
            "max_capacity": batch.max_capacity,
            "is_mon": batch.is_mon,
            "is_tue": batch.is_tue,
            "is_wed": batch.is_wed,
            "is_thu": batch.is_thu,
            "is_fri": batch.is_fri,
            "is_sat": batch.is_sat,
            "is_sun": batch.is_sun,
            "start_time": batch.start_time.strftime("%H:%M:%S") if batch.start_time else None,
            "end_time": batch.end_time.strftime("%H:%M:%S") if batch.end_time else None,
            "start_date": batch.start_date.isoformat() if batch.start_date else None,
            "is_active": batch.is_active,
            "schedule_days": schedule_string,
            "coaches": [
                {"id": c.id, "full_name": c.full_name, "email": c.email}
                for c in get_batch_coaches(db, batch.id)
            ],
        }
        batches_with_coaches.append(batch_dict)

    return batches_with_coaches


@router.get("/{batch_id}/potential-reactivations", tags=["Batches"])
def get_potential_reactivations_endpoint(
    batch_id: int,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """
    Get potential leads to re-activate for a new batch.
    Returns leads with matching center and age group that are in Nurture, On Break,
    or Dead with 'Timing Mismatch' reason, and do_not_contact is False.
    """
    if current_user.role not in ["team_lead", "team_member"]:
        raise HTTPException(status_code=403, detail="Only sales roles can view reactivations")

    try:
        leads = get_potential_reactivations(db, batch_id)
        serialized_leads = serialize_leads_for_user(leads, current_user.role)
        return {"leads": serialized_leads, "count": len(serialized_leads)}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("", tags=["Batches"])
def create_batch_endpoint(
    name: str,
    center_id: int,
    min_age: int = 0,
    max_age: int = 99,
    max_capacity: int = 20,
    is_mon: bool = False,
    is_tue: bool = False,
    is_wed: bool = False,
    is_thu: bool = False,
    is_fri: bool = False,
    is_sat: bool = False,
    is_sun: bool = False,
    start_time: Optional[str] = None,
    end_time: Optional[str] = None,
    start_date: Optional[str] = None,
    is_active: bool = True,
    coach_ids: Optional[str] = None,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Create a new batch (team leads only)."""
    if current_user.role != "team_lead":
        raise HTTPException(status_code=403, detail="Only team leads can create batches")

    coach_ids_list = None
    if coach_ids:
        try:
            coach_ids_list = [int(id.strip()) for id in coach_ids.split(",") if id.strip()]
            if not coach_ids_list:
                raise HTTPException(status_code=400, detail="At least one coach must be assigned to the batch")
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid coach_ids format. Use comma-separated integers")
    else:
        raise HTTPException(status_code=400, detail="At least one coach must be assigned to the batch")

    start_date_obj = None
    if start_date:
        try:
            start_date_obj = datetime.fromisoformat(start_date).date()
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid start_date format: {start_date}. Use YYYY-MM-DD")

    try:
        if max_age < min_age:
            raise HTTPException(status_code=400, detail="max_age must be >= min_age")
        new_batch = create_batch(
            db=db,
            name=name,
            center_id=center_id,
            min_age=min_age,
            max_age=max_age,
            max_capacity=max_capacity,
            is_mon=is_mon,
            is_tue=is_tue,
            is_wed=is_wed,
            is_thu=is_thu,
            is_fri=is_fri,
            is_sat=is_sat,
            is_sun=is_sun,
            start_time=start_time,
            end_time=end_time,
            start_date=start_date_obj,
            is_active=is_active,
            coach_ids=coach_ids_list,
        )
        return {"status": "created", "batch": new_batch}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{batch_id}/assign-coach", tags=["Batches"])
def assign_coach_to_batch_endpoint(
    batch_id: int,
    user_id: Optional[int] = None,
    coach_ids: Optional[str] = None,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Assign coach(es) to a batch (team leads only)."""
    if current_user.role != "team_lead":
        raise HTTPException(status_code=403, detail="Only team leads can assign coaches")

    if coach_ids:
        try:
            coach_ids_list = [int(id.strip()) for id in coach_ids.split(",") if id.strip()]
            if not coach_ids_list:
                raise HTTPException(status_code=400, detail="At least one coach must be assigned")

            assign_coaches_to_batch(db, batch_id, coach_ids_list)
            return {"status": "assigned", "batch_id": batch_id, "coach_ids": coach_ids_list}
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
    elif user_id:
        try:
            assign_coach_to_batch(db, batch_id, user_id)
            return {"status": "assigned", "batch_id": batch_id, "user_id": user_id}
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
    else:
        raise HTTPException(status_code=400, detail="Either user_id or coach_ids must be provided")


@router.put("/{batch_id}", tags=["Batches"])
def update_batch_endpoint(
    batch_id: int,
    name: Optional[str] = None,
    center_id: Optional[int] = None,
    min_age: Optional[int] = None,
    max_age: Optional[int] = None,
    max_capacity: Optional[int] = None,
    is_mon: Optional[bool] = None,
    is_tue: Optional[bool] = None,
    is_wed: Optional[bool] = None,
    is_thu: Optional[bool] = None,
    is_fri: Optional[bool] = None,
    is_sat: Optional[bool] = None,
    is_sun: Optional[bool] = None,
    start_time: Optional[str] = None,
    end_time: Optional[str] = None,
    start_date: Optional[str] = None,
    is_active: Optional[bool] = None,
    coach_ids: Optional[str] = None,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Update a batch (team leads only)."""
    if current_user.role != "team_lead":
        raise HTTPException(status_code=403, detail="Only team leads can update batches")

    coach_ids_list = None
    if coach_ids:
        try:
            coach_ids_list = [int(id.strip()) for id in coach_ids.split(",") if id.strip()]
            if not coach_ids_list:
                raise HTTPException(
                    status_code=400,
                    detail="coach_ids cannot be empty. To remove all coaches, use assign-coach endpoint",
                )
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid coach_ids format. Use comma-separated integers")

    start_date_obj = None
    if start_date:
        try:
            start_date_obj = datetime.fromisoformat(start_date).date()
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid start_date format: {start_date}. Use YYYY-MM-DD")

    try:
        if min_age is not None and max_age is not None and max_age < min_age:
            raise HTTPException(status_code=400, detail="max_age must be >= min_age")
        updated_batch = update_batch(
            db=db,
            batch_id=batch_id,
            name=name,
            center_id=center_id,
            min_age=min_age,
            max_age=max_age,
            max_capacity=max_capacity,
            is_mon=is_mon,
            is_tue=is_tue,
            is_wed=is_wed,
            is_thu=is_thu,
            is_fri=is_fri,
            is_sat=is_sat,
            is_sun=is_sun,
            start_time=start_time,
            end_time=end_time,
            start_date=start_date_obj,
            is_active=is_active,
            coach_ids=coach_ids_list,
        )
        return {"status": "updated", "batch": updated_batch}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/{batch_id}", tags=["Batches"])
def delete_batch_endpoint(
    batch_id: int,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Delete a batch (team leads only)."""
    if current_user.role != "team_lead":
        raise HTTPException(status_code=403, detail="Only team leads can delete batches")

    try:
        delete_batch(db, batch_id)
        return {"status": "deleted", "batch_id": batch_id}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
