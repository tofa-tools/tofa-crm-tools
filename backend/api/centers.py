"""
Center management API routes.
"""
from fastapi import APIRouter, Depends, HTTPException, Body

from backend.api.deps import get_current_user, get_session
from backend.core.centers import get_all_centers, create_center, update_center
from backend.models import User
from backend.schemas.centers import CenterCreate, CenterUpdate
from sqlmodel import Session

router = APIRouter()


@router.get("", tags=["Centers"])
def get_centers(
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Get all centers."""
    return get_all_centers(db)


@router.post("", tags=["Centers"])
def create_center_endpoint(
    body: CenterCreate = Body(...),
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Create a new center (team leads only). Accepts JSON body."""
    if current_user.role != "team_lead":
        raise HTTPException(status_code=403, detail="Only team leads can create centers")

    try:
        new_center = create_center(
            db,
            display_name=body.display_name,
            meta_tag_name=body.meta_tag_name,
            city=body.city,
            location=body.location or "",
            map_link=body.map_link,
            group_email=body.group_email,
        )
        return new_center
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/{center_id}", tags=["Centers"])
def update_center_endpoint(
    center_id: int,
    body: CenterUpdate = Body(...),
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Update an existing center (team leads only). Accepts JSON body."""
    if current_user.role != "team_lead":
        raise HTTPException(status_code=403, detail="Only team leads can update centers")

    # Build kwargs from body, excluding None values
    kwargs = body.model_dump(exclude_unset=True)

    try:
        updated_center = update_center(db=db, center_id=center_id, **kwargs)
        return updated_center
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
