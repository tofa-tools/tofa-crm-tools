"""
FastAPI application using core business logic.
All routes delegate to framework-agnostic core functions.
"""
from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session
from typing import List, Optional
import pandas as pd
from datetime import datetime

from backend.core.db import get_session, create_db_and_tables
from backend.core.auth import create_access_token, get_user_email_from_token
from backend.core.users import verify_user_credentials, create_user, get_all_users, get_user_by_email
from backend.core.leads import (
    get_leads_for_user, update_lead, create_lead_from_meta, import_leads_from_dataframe
)
from backend.core.centers import get_all_centers, create_center
from backend.models import User, Center
from backend.schemas.users import UserCreateSchema

# FastAPI OAuth2 scheme for token extraction
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")


# FastAPI dependency for getting current user
async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_session)
) -> User:
    """
    FastAPI dependency to get current authenticated user from JWT token.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    email = get_user_email_from_token(token)
    if email is None:
        raise credentials_exception
    
    user = get_user_by_email(db, email)
    if user is None:
        raise credentials_exception
    
    return user

app = FastAPI()

# CORS middleware - Allow React app to make requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],  # React dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    """Initialize database and create admin user if needed."""
    create_db_and_tables()
    with next(get_session()) as db:
        try:
            admin = get_user_by_email(db, "admin@tofa.com")
            if not admin:
                from backend.core.auth import get_password_hash
                new_admin = User(
                    email="admin@tofa.com",
                    hashed_password=get_password_hash("admin123"),
                    full_name="Super Admin",
                    role="team_lead"
                )
                db.add(new_admin)
                db.commit()
                print("--- Admin Created: admin@tofa.com / admin123 ---")
        except Exception as e:
            print(f"Database check failed: {e}")


@app.post("/token")
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_session)
):
    """Login endpoint - returns JWT token."""
    user = verify_user_credentials(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(status_code=400, detail="Incorrect email or password")
    
    access_token = create_access_token(data={"sub": user.email, "role": user.role})
    return {"access_token": access_token, "token_type": "bearer", "role": user.role}


# --- USER MANAGEMENT ENDPOINTS ---
@app.post("/users/")
def create_user_endpoint(
    user_data: UserCreateSchema,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Create a new user (team leads only)."""
    if current_user.role != "team_lead":
        raise HTTPException(status_code=403, detail="Not authorized")
    
    try:
        new_user = create_user(
            db=db,
            email=user_data.email,
            password=user_data.password,
            full_name=user_data.full_name,
            role=user_data.role,
            center_ids=user_data.center_ids
        )
        return {"status": "User created successfully"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/users/")
def read_users(
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get all users (team leads only)."""
    if current_user.role != "team_lead":
        raise HTTPException(status_code=403, detail="Not authorized")
    return get_all_users(db)


# --- UPLOAD ---
@app.post("/leads/upload/")
async def upload_leads(
    file: UploadFile = File(...),
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Upload leads from Excel/CSV file (team leads only)."""
    if current_user.role != "team_lead":
        raise HTTPException(status_code=403, detail="Only Team Leads can import data")

    # Support both Excel and CSV files
    file_extension = file.filename.split('.')[-1].lower() if file.filename else ''
    
    try:
        if file_extension in ['xlsx', 'xls']:
            df = pd.read_excel(file.file)
        elif file_extension == 'csv':
            file.file.seek(0)
            try:
                df = pd.read_csv(file.file, encoding='utf-8')
            except UnicodeDecodeError:
                file.file.seek(0)
                try:
                    df = pd.read_csv(file.file, encoding='latin-1')
                except:
                    file.file.seek(0)
                    df = pd.read_csv(file.file, encoding='cp1252')
        else:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file type. Please upload Excel (.xlsx, .xls) or CSV (.csv) files"
            )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error reading file: {str(e)}")
    
    meta_col = "_which_is_the_nearest_tofa_center_to_you?"
    if meta_col not in df.columns:
        possible_cols = [c for c in df.columns if "nearest_tofa" in str(c)]
        meta_col = possible_cols[0] if possible_cols else None
        
    if not meta_col:
        raise HTTPException(status_code=400, detail="Could not find Center/Location column")

    try:
        count, unknown_tags = import_leads_from_dataframe(db, df, meta_col)
        if unknown_tags:
            return {"status": "error", "message": "Unknown Centers Found", "unknown_tags": unknown_tags}
        return {"status": "success", "leads_added": count}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# --- META WEBHOOK ENDPOINT ---
@app.post("/leads/meta-webhook/")
async def meta_webhook(
    data: dict,
    db: Session = Depends(get_session)
):
    """
    Webhook endpoint to receive leads directly from Meta (Facebook/Instagram) Lead Forms.
    Configure this URL in your Meta Lead Form settings.
    """
    try:
        phone = str(data.get("phone_number", "")).strip()
        name = data.get("full_name", "Unknown").strip()
        email = data.get("email_address", "").strip() or None
        center_tag = data.get("nearest_center", "").strip()
        age_category = data.get("player_age_category", "Unknown").strip()
        address = data.get("address_and_pincode", "").strip() or None
        
        if not phone:
            return {"status": "error", "message": "Phone number is required"}
        
        if not center_tag:
            return {"status": "error", "message": "Center/Location is required"}
        
        try:
            new_lead = create_lead_from_meta(
                db=db,
                phone=phone,
                name=name,
                email=email,
                center_tag=center_tag,
                age_category=age_category,
                address=address
            )
            return {
                "status": "success",
                "message": "Lead created successfully",
                "lead_id": new_lead.id
            }
        except ValueError as e:
            return {"status": "error", "message": str(e)}
            
    except Exception as e:
        return {"status": "error", "message": f"Error processing webhook: {str(e)}"}


# --- READ/UPDATE ---
@app.get("/leads/my_leads")
def get_my_leads(
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get leads for the current user."""
    return get_leads_for_user(db, current_user)


@app.put("/leads/{lead_id}")
def update_lead_endpoint(
    lead_id: int,
    status: str,
    next_date: Optional[str] = None,
    comment: Optional[str] = None,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Update a lead's status and add optional comment."""
    try:
        updated_lead = update_lead(
            db=db,
            lead_id=lead_id,
            status=status,
            next_date=next_date,
            comment=comment,
            user_id=current_user.id
        )
        return {"status": "updated"}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.post("/centers/")
def create_center_endpoint(
    center: Center,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Create a new center (team leads only)."""
    if current_user.role != "team_lead":
        raise HTTPException(status_code=403, detail="Not authorized")
    
    try:
        new_center = create_center(
            db=db,
            display_name=center.display_name,
            meta_tag_name=center.meta_tag_name,
            city=center.city,
            location=center.location
        )
        return new_center
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/centers/")
def read_centers(db: Session = Depends(get_session)):
    """Get all centers."""
    return get_all_centers(db)

