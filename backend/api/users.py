"""
User and authentication API routes.
"""
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlmodel import Session

from backend.api.deps import get_current_user, get_session, limiter
from backend.core.auth import create_access_token
from backend.core.users import (
    verify_user_credentials,
    create_user,
    update_user,
    toggle_user_status,
    get_user_with_centers,
    get_all_users_with_centers,
)
from backend.models import User
from backend.schemas.users import UserCreateSchema, UserUpdateSchema

router = APIRouter()


@router.post("/token", tags=["Auth"])
@limiter.limit("5/minute")
async def login(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_session),
):
    """Login endpoint - returns JWT token. Rate limited to 5 attempts per minute per IP."""
    try:
        user = verify_user_credentials(db, form_data.username, form_data.password)
        if not user:
            raise HTTPException(status_code=401, detail="Incorrect email or password")
    except ValueError as e:
        msg = str(e)
        if "72 bytes" in msg or "password" in msg.lower() and "truncate" in msg.lower():
            msg = "Incorrect email or password"
        raise HTTPException(status_code=401, detail=msg)

    access_token = create_access_token(data={"sub": user.email})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "role": user.role,
    }


@router.get("/me", tags=["Users"])
async def get_current_user_info(
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Get current user information, including center_ids for coaches."""
    result = get_user_with_centers(db, current_user.id)
    if not result:
        raise HTTPException(status_code=404, detail="User not found")
    return result


@router.get("/users", tags=["Users"])
def get_users(
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Get all users (team leads only)."""
    if current_user.role != "team_lead":
        raise HTTPException(status_code=403, detail="Only team leads can view all users")
    return get_all_users_with_centers(db)


@router.post("/users", tags=["Users"])
def create_user_endpoint(
    user_data: UserCreateSchema,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Create a new user (team leads only)."""
    if current_user.role != "team_lead":
        raise HTTPException(status_code=403, detail="Only team leads can create users")

    try:
        new_user = create_user(
            db=db,
            email=user_data.email,
            password=user_data.password,
            full_name=user_data.full_name,
            role=user_data.role,
            center_ids=user_data.center_ids,
            phone=user_data.phone,
        )
        return {
            "id": new_user.id,
            "email": new_user.email,
            "full_name": new_user.full_name,
            "role": new_user.role,
            "phone": new_user.phone,
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/users/{user_id}", tags=["Users"])
def update_user_endpoint(
    user_id: int,
    user_data: UserUpdateSchema,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Update an existing user (team leads only)."""
    if current_user.role != "team_lead":
        raise HTTPException(status_code=403, detail="Only team leads can update users")

    try:
        updated_user = update_user(
            db=db,
            user_id=user_id,
            full_name=user_data.full_name,
            phone=user_data.phone,
            role=user_data.role,
            is_active=user_data.is_active,
            password=user_data.password,
            center_ids=user_data.center_ids,
        )
        return {
            "id": updated_user.id,
            "email": updated_user.email,
            "full_name": updated_user.full_name,
            "phone": updated_user.phone,
            "role": updated_user.role,
            "is_active": updated_user.is_active,
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/users/{user_id}/toggle-status", tags=["Users"])
def toggle_user_status_endpoint(
    user_id: int,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Toggle a user's active status (team leads only)."""
    if current_user.role != "team_lead":
        raise HTTPException(status_code=403, detail="Only team leads can toggle user status")

    if current_user.id == user_id:
        raise HTTPException(status_code=400, detail="You cannot deactivate your own account")

    try:
        updated_user = toggle_user_status(db=db, user_id=user_id)
        return {
            "id": updated_user.id,
            "email": updated_user.email,
            "full_name": updated_user.full_name,
            "role": updated_user.role,
            "is_active": updated_user.is_active,
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
