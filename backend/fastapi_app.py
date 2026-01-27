"""
FastAPI application using core business logic.
All routes delegate to framework-agnostic core functions.
"""
from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, status, Body, Request
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlmodel import Session, select
from typing import List, Optional, Dict
import pandas as pd
from datetime import datetime
import os
import io

# Sentry error tracking (optional)
try:
    import sentry_sdk
    from sentry_sdk.integrations.fastapi import FastApiIntegration
    from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration
    
    # Initialize Sentry if DSN is provided
    SENTRY_DSN = os.getenv("SENTRY_DSN")
    if SENTRY_DSN:
        sentry_sdk.init(
            dsn=SENTRY_DSN,
            integrations=[
                FastApiIntegration(),
                SqlalchemyIntegration(),
            ],
            traces_sample_rate=0.1,  # 10% of transactions
            environment=os.getenv("ENVIRONMENT", "development"),
        )
        print("✅ Sentry error tracking initialized")
    else:
        print("ℹ️  Sentry DSN not provided, error tracking disabled")
except ImportError:
    print("ℹ️  Sentry SDK not installed. Install with: pip install sentry-sdk[fastapi]")

from backend.core.db import get_session, create_db_and_tables, engine
from backend.core.auth import create_access_token, get_user_email_from_token
from backend.core.users import verify_user_credentials, create_user, get_all_users, get_user_by_email, update_user
from backend.core.leads import (
    get_leads_for_user, update_lead, create_lead_from_meta, import_leads_from_dataframe, increment_nudge_count
)
from backend.core.audit import get_audit_logs_for_lead
from backend.core.bulk_operations import (
    bulk_update_lead_status, bulk_update_lead_assignment, verify_leads_accessible
)
from backend.core.centers import get_all_centers, create_center, update_center
from backend.core.import_validation import preview_import_data, auto_detect_column_mapping
from backend.core.analytics import (
    calculate_conversion_rates, 
    calculate_average_time_to_contact,
    get_status_distribution
)
from backend.core.pending_reports import get_pending_student_reports
from backend.core.report_audit import log_report_sent
from backend.core.tasks import get_daily_task_queue, get_calendar_month_view, get_daily_stats
from backend.core.user_stats import get_user_completion_streak, get_user_today_completion_stats
from backend.core.abandoned_leads import get_abandoned_leads_count
from backend.core.at_risk_leads import get_at_risk_leads_count
from backend.core.batches import (
    create_batch, assign_coach_to_batch, get_coach_batches,
    get_all_batches, get_batch_coaches, assign_coaches_to_batch,
    update_batch
)
from backend.core.public_preferences import (
    record_lead_feedback_by_token,
    get_lead_preferences_by_token, update_lead_preferences_by_token
)
from backend.core.skills import (
    create_skill_evaluation, get_skill_evaluations_for_lead, get_skill_summary_for_lead
)
from backend.core.staging import (
    create_staging_lead, get_staging_leads, get_staging_lead_by_id, promote_staging_lead
)
from backend.core.reactivations import get_potential_reactivations
from backend.core.attendance import record_attendance, get_attendance_history
from backend.core.approvals import (
    create_request, get_pending_requests, get_request_by_id,
    resolve_request, get_requests_for_lead
)
from backend.core.students import get_all_students, get_student_by_lead_id
from backend.schemas.leads import LeadPreferencesRead, LeadPreferencesUpdate
from backend.models import User, Center, Lead, Student
from backend.schemas.users import UserCreateSchema, UserUpdateSchema
from backend.schemas.bulk import BulkUpdateStatusRequest, BulkAssignCenterRequest

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

# Middleware to block observers from mutation operations
@app.middleware("http")
async def observer_read_only_middleware(request: Request, call_next):
    """
    Middleware to block observers from POST, PUT, DELETE, PATCH requests.
    Observers have read-only access.
    """
    # Skip check for non-mutation methods
    if request.method in ["GET", "OPTIONS", "HEAD"]:
        return await call_next(request)
    
    # Check if user is authenticated and is an observer
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]
        try:
            from backend.core.auth import get_user_email_from_token
            from backend.core.users import get_user_by_email
            from backend.database import get_session
            
            email = get_user_email_from_token(token)
            if email:
                db = next(get_session())
                try:
                    user = get_user_by_email(db, email)
                    if user and user.role == "observer":
                        return JSONResponse(
                            status_code=status.HTTP_403_FORBIDDEN,
                            content={"detail": "Observers have read-only access"}
                        )
                finally:
                    db.close()
        except HTTPException:
            # Re-raise HTTP exceptions
            raise
        except Exception:
            # If token validation fails, let the endpoint handle it
            pass
    
    return await call_next(request)

# CORS middleware - Allow React app to make requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],  # React dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Initialize database on startup
@app.on_event("startup")
def on_startup():
    create_db_and_tables()


# --- AUTHENTICATION ENDPOINTS ---
@app.post("/token")
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_session)
):
    """Login endpoint - returns JWT token."""
    try:
        user = verify_user_credentials(db, form_data.username, form_data.password)
        if not user:
            raise HTTPException(status_code=400, detail="Incorrect email or password")
    except ValueError as e:
        # Handle deactivated account error
        raise HTTPException(status_code=401, detail=str(e))
    
    access_token = create_access_token(data={"sub": user.email})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "role": user.role
    }


@app.get("/me")
async def get_current_user_info(
    current_user: User = Depends(get_current_user)
):
    """Get current user information."""
    return {
        "email": current_user.email,
        "full_name": current_user.full_name,
        "role": current_user.role
    }


# --- USER MANAGEMENT ENDPOINTS ---
@app.get("/users")
def get_users(
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get all users (team leads only)."""
    if current_user.role != "team_lead":
        raise HTTPException(status_code=403, detail="Only team leads can view all users")
    
    users = get_all_users(db)
    # Include center_ids in response
    from backend.models import UserCenterLink
    result = []
    for user in users:
        user_dict = {
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name,
            "role": user.role,
            "is_active": user.is_active,
        }
        # Get center IDs for this user
        center_links = db.exec(
            select(UserCenterLink).where(UserCenterLink.user_id == user.id)
        ).all()
        user_dict["center_ids"] = [link.center_id for link in center_links]
        result.append(user_dict)
    return result


@app.post("/users")
def create_user_endpoint(
    user_data: UserCreateSchema,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
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
            center_ids=user_data.center_ids
        )
        return {"id": new_user.id, "email": new_user.email, "full_name": new_user.full_name, "role": new_user.role}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.put("/users/{user_id}")
def update_user_endpoint(
    user_id: int,
    user_data: UserUpdateSchema,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Update an existing user (team leads only)."""
    if current_user.role != "team_lead":
        raise HTTPException(status_code=403, detail="Only team leads can update users")
    
    try:
        updated_user = update_user(
            db=db,
            user_id=user_id,
            full_name=user_data.full_name,
            role=user_data.role,
            is_active=user_data.is_active,
            password=user_data.password,
            center_ids=user_data.center_ids
        )
        return {
            "id": updated_user.id,
            "email": updated_user.email,
            "full_name": updated_user.full_name,
            "role": updated_user.role,
            "is_active": updated_user.is_active
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.put("/users/{user_id}/toggle-status")
def toggle_user_status_endpoint(
    user_id: int,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Toggle a user's active status (team leads only)."""
    if current_user.role != "team_lead":
        raise HTTPException(status_code=403, detail="Only team leads can toggle user status")
    
    # Prevent team lead from deactivating themselves
    if current_user.id == user_id:
        raise HTTPException(status_code=400, detail="You cannot deactivate your own account")
    
    try:
        from backend.core.users import toggle_user_status
        updated_user = toggle_user_status(db=db, user_id=user_id)
        return {
            "id": updated_user.id,
            "email": updated_user.email,
            "full_name": updated_user.full_name,
            "role": updated_user.role,
            "is_active": updated_user.is_active
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# --- CENTER MANAGEMENT ENDPOINTS ---
@app.get("/centers")
def get_centers(
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get all centers."""
    centers = get_all_centers(db)
    return centers


@app.post("/centers")
def create_center_endpoint(
    display_name: str,
    meta_tag_name: str,
    city: str,
    location: str,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Create a new center (team leads only)."""
    if current_user.role != "team_lead":
        raise HTTPException(status_code=403, detail="Only team leads can create centers")
    
    try:
        new_center = create_center(db, display_name, meta_tag_name, city, location)
        return new_center
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.put("/centers/{center_id}")
def update_center_endpoint(
    center_id: int,
    display_name: Optional[str] = None,
    meta_tag_name: Optional[str] = None,
    city: Optional[str] = None,
    location: Optional[str] = None,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Update an existing center (team leads only)."""
    if current_user.role != "team_lead":
        raise HTTPException(status_code=403, detail="Only team leads can update centers")
    
    try:
        updated_center = update_center(
            db=db,
            center_id=center_id,
            display_name=display_name,
            meta_tag_name=meta_tag_name,
            city=city,
            location=location
        )
        return updated_center
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# --- LEAD IMPORT ENDPOINTS ---
# --- LEAD IMPORT ENDPOINTS (UPDATED FOR META ADS CSV) ---

@app.post("/leads/preview")
async def preview_leads(
    file: UploadFile = File(...),
    column_mapping: Optional[str] = None,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    import json
    import io
    if current_user.role != "team_lead":
        raise HTTPException(status_code=403, detail="Only Team Leads can preview imports")
    
    file_extension = file.filename.split('.')[-1].lower() if file.filename else ''
    
    try:
        content = await file.read()
        df = None

        if file_extension in ['xlsx', 'xls']:
            df = pd.read_excel(io.BytesIO(content))
        else:
            # FIX: Meta Ads CSVs are often UTF-16 (starts with 0xff). 
            # We try multiple encodings to prevent the 'utf-8' error.
            encodings = ['utf-16', 'utf-8-sig', 'utf-8', 'cp1252', 'latin1']
            for enc in encodings:
                try:
                    df = pd.read_csv(io.BytesIO(content), encoding=enc, sep=None, engine='python')
                    print(f"✅ Preview: Successfully read CSV with {enc}")
                    break
                except Exception:
                    continue
            
            if df is None:
                raise ValueError("Could not decode CSV file. Please try saving the file as 'CSV UTF-8'.")

        if df.empty:
            return {"total_rows": 0, "valid_rows": 0, "preview_data": {"valid": [], "invalid": []}}

        # Clean column headers of any remaining hidden whitespace or artifacts
        df.columns = [str(c).strip() for c in df.columns]

        # Get or detect mapping
        mapping_dict = json.loads(column_mapping) if column_mapping else auto_detect_column_mapping(df)
        
        # Get centers for validation
        known_centers = get_all_centers(db)
        
        # Run preview logic
        preview_result = preview_import_data(df, mapping_dict, known_centers)
        
        # Include detected mapping so frontend knows which columns were matched
        preview_result["detected_mapping"] = mapping_dict
        return preview_result

    except Exception as e:
        print(f"❌ Preview Error: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Preview Error: {str(e)}")


@app.post("/leads/upload")
async def upload_leads(
    file: UploadFile = File(...),
    column_mapping: Optional[str] = None,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    import json
    import io
    if current_user.role != "team_lead":
        raise HTTPException(status_code=403, detail="Only Team Leads can import data")

    file_extension = file.filename.split('.')[-1].lower() if file.filename else ''
    
    try:
        content = await file.read()
        df = None

        # 1. Read file with encoding loop
        if file_extension in ['xlsx', 'xls']:
            df = pd.read_excel(io.BytesIO(content))
        else:
            encodings = ['utf-16', 'utf-8-sig', 'utf-8', 'cp1252', 'latin1']
            for enc in encodings:
                try:
                    df = pd.read_csv(io.BytesIO(content), encoding=enc, sep=None, engine='python')
                    print(f"✅ Upload: Successfully read CSV with {enc}")
                    break
                except Exception:
                    continue
            
            if df is None:
                raise ValueError("Could not decode CSV file.")

        # 2. Clean headers
        df.columns = [str(c).strip() for c in df.columns]

        # 3. Get Mapping
        mapping = json.loads(column_mapping) if column_mapping else auto_detect_column_mapping(df)
        
        # 4. Transform DataFrame: Map CSV headers to System Headers
        # We rename columns like '_player_name?' -> 'player_name'
        inv_map = {v: k for k, v in mapping.items()}
        df_mapped = df.rename(columns=inv_map)
        
        # 5. Calculate Age Category from DOB if needed
        # Check if player_age_category values are actually dates (DOBs) and convert them
        if 'player_age_category' in df_mapped.columns:
            from backend.core.import_validation import calculate_age_category
            # Check if values look like dates - try to parse first non-null value
            sample_values = df_mapped['player_age_category'].dropna().head(5)
            if not sample_values.empty:
                try:
                    # Try to parse as date - if it works, values are DOBs and need conversion
                    pd.to_datetime(sample_values.iloc[0])
                    # Convert all DOB values to age categories
                    df_mapped['player_age_category'] = df_mapped['player_age_category'].apply(calculate_age_category)
                    print(f"✅ Converted DOB values to age categories")
                except (ValueError, TypeError):
                    # Values are already age categories, not dates
                    pass

        # 6. Call core import logic
        # We pass 'center' because that's the key used in import_validation mapping
        count, errors = import_leads_from_dataframe(db, df_mapped, 'center')
        
        return {
            "status": "success",
            "leads_added": count,
            "errors": errors
        }
    except Exception as e:
        print(f"❌ Upload Error: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Upload Error: {str(e)}")


# --- META WEBHOOK ENDPOINT ---
@app.post("/webhook/meta")
async def meta_webhook(
    phone: str,
    name: str,
    email: Optional[str] = None,
    center_tag: str = None,
    age_category: str = None,
    address: Optional[str] = None,
    db: Session = Depends(get_session)
):
    """
    Webhook endpoint for Meta lead ads.
    Creates a new lead from Meta form submission.
    """
    try:
        if not center_tag:
            center_tag = "unknown"  # Default center tag if not provided
        
        if not age_category:
            age_category = "Unknown"
        
        lead = create_lead_from_meta(
            db=db,
            phone=phone,
            name=name,
            email=email,
            center_tag=center_tag,
            age_category=age_category,
            address=address
        )
        
        return {"status": "success", "lead_id": lead.id}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


# --- LEAD MANAGEMENT ENDPOINTS ---
@app.get("/leads/my_leads")
def get_my_leads(
    limit: Optional[int] = None,
    offset: int = 0,
    status: Optional[str] = None,
    search: Optional[str] = None,
    sort_by: str = "created_time",  # "created_time" or "freshness"
    next_follow_up_date: Optional[str] = None,  # Filter by follow-up date (YYYY-MM-DD)
    filter: Optional[str] = None,  # Special filter: "at-risk"
    loss_reason: Optional[str] = None,  # Filter by loss_reason
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Get leads for the current user with pagination and filtering.
    
    Query Parameters:
        limit: Maximum number of leads to return (default: None, returns all)
        offset: Number of leads to skip for pagination (default: 0)
        status: Filter by status (optional)
        search: Search term for player name (optional)
        sort_by: Sort order - "created_time" (newest first) or "freshness" (rotting leads first)
        filter: Special filter - "at-risk" for inactive leads
    """
    at_risk_filter = filter == "at-risk" if filter else None
    leads, total = get_leads_for_user(
        db, 
        current_user, 
        limit=limit, 
        offset=offset,
        status_filter=status,
        search=search,
        sort_by=sort_by,
        loss_reason_filter=loss_reason,
        next_follow_up_date_filter=next_follow_up_date,
        at_risk_filter=at_risk_filter
    )
    
    # Mask sensitive fields for coaches
    from backend.core.lead_privacy import serialize_leads_for_user
    serialized_leads = serialize_leads_for_user(leads, current_user.role)
    
    return {
        "leads": serialized_leads,
        "total": total,
        "limit": limit,
        "offset": offset,
        "sort_by": sort_by
    }


@app.put("/leads/{lead_id}")
def update_lead_endpoint(
    lead_id: int,
    status: str,
    next_date: Optional[str] = None,
    comment: Optional[str] = None,
    age_category: Optional[str] = None,
    trial_batch_id: Optional[int] = None,
    permanent_batch_id: Optional[int] = None,
    student_batch_ids: Optional[str] = None,  # Comma-separated list of batch IDs
    subscription_plan: Optional[str] = None,
    subscription_start_date: Optional[str] = None,
    subscription_end_date: Optional[str] = None,
    payment_proof_url: Optional[str] = None,  # URL to payment proof image
    call_confirmation_note: Optional[str] = None,  # Note confirming call with parent
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Update a lead's status and add optional comment. Can also assign batches and subscription."""
    from datetime import date as date_type
    
    # Parse student_batch_ids if provided
    student_batch_ids_list = None
    if student_batch_ids:
        try:
            student_batch_ids_list = [int(id.strip()) for id in student_batch_ids.split(",") if id.strip()]
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid student_batch_ids format. Use comma-separated integers")
    
    # Parse subscription dates if provided
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
            player_age_category=age_category,  # Map age_category parameter to player_age_category
            trial_batch_id=trial_batch_id,
            permanent_batch_id=permanent_batch_id,
            student_batch_ids=student_batch_ids_list,
            payment_proof_url=payment_proof_url,
            call_confirmation_note=call_confirmation_note
        )
        
        # Update subscription fields if provided
        if subscription_plan is not None or subscription_start_date_obj is not None or subscription_end_date_obj is not None:
            from backend.core.leads import get_lead_by_id
            lead = get_lead_by_id(db, lead_id)
            if not lead:
                raise HTTPException(status_code=404, detail="Lead not found")
            if subscription_plan is not None:
                lead.subscription_plan = subscription_plan
            if subscription_start_date_obj is not None:
                lead.subscription_start_date = subscription_start_date_obj
                # Auto-calculate end date if plan is provided but end date is not
                if subscription_plan and not subscription_end_date_obj:
                    from datetime import timedelta
                    if subscription_plan == "Monthly":
                        lead.subscription_end_date = subscription_start_date_obj + timedelta(days=30)
                    elif subscription_plan == "Quarterly":
                        lead.subscription_end_date = subscription_start_date_obj + timedelta(days=90)
                    elif subscription_plan == "6 Months":
                        lead.subscription_end_date = subscription_start_date_obj + timedelta(days=180)
                    elif subscription_plan == "Yearly":
                        lead.subscription_end_date = subscription_start_date_obj + timedelta(days=365)
            elif subscription_plan and lead.subscription_start_date and not subscription_end_date_obj and not lead.subscription_end_date:
                # Calculate end date from existing start date if plan is provided but no dates are
                from datetime import timedelta
                if subscription_plan == "Monthly":
                    lead.subscription_end_date = lead.subscription_start_date + timedelta(days=30)
                elif subscription_plan == "Quarterly":
                    lead.subscription_end_date = lead.subscription_start_date + timedelta(days=90)
                elif subscription_plan == "6 Months":
                    lead.subscription_end_date = lead.subscription_start_date + timedelta(days=180)
                elif subscription_plan == "Yearly":
                    lead.subscription_end_date = lead.subscription_start_date + timedelta(days=365)
            if subscription_end_date_obj is not None:
                lead.subscription_end_date = subscription_end_date_obj
            db.add(lead)
            db.commit()
            db.refresh(lead)
        
        # Return updated lead data
        from backend.core.leads import get_lead_by_id
        updated_lead = get_lead_by_id(db, lead_id)
        if updated_lead:
            from backend.schemas.leads import LeadRead
            return LeadRead.model_validate(updated_lead)
        
        return {"status": "updated"}
    except ValueError as e:
        error_message = str(e)
        # Check if it's a capacity error and return appropriate status code
        if "CAPACITY_REACHED" in error_message:
            raise HTTPException(status_code=400, detail=error_message)
        raise HTTPException(status_code=400, detail=error_message)


@app.post("/leads/{lead_id}/convert")
def convert_lead_to_student_endpoint(
    lead_id: int,
    subscription_plan: str,
    subscription_start_date: str,
    subscription_end_date: Optional[str] = None,
    payment_proof_url: Optional[str] = None,
    student_batch_ids: Optional[str] = None,  # Comma-separated list of batch IDs
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Convert a Lead to a Student (graduate from prospect to active member).
    This endpoint should be used by the 'Complete Joining' button in the frontend.
    """
    from backend.core.leads import get_lead_by_id
    from backend.core.students import convert_lead_to_student
    from datetime import date as date_type
    
    # Verify user has access to this lead
    lead = get_lead_by_id(db, lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    # Check permissions
    if current_user.role != "team_lead":
        user_center_ids = [c.id for c in current_user.centers]
        if lead.center_id not in user_center_ids:
            raise HTTPException(status_code=403, detail="Not authorized to convert this lead")
    
    # Parse subscription dates
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
    
    # Parse student_batch_ids if provided
    student_batch_ids_list = []
    if student_batch_ids:
        try:
            student_batch_ids_list = [int(id.strip()) for id in student_batch_ids.split(",") if id.strip()]
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid student_batch_ids format. Use comma-separated integers")
    
    # Prepare student data
    student_data = {
        'subscription_plan': subscription_plan,
        'subscription_start_date': subscription_start_date_obj,
        'subscription_end_date': subscription_end_date_obj,
        'payment_proof_url': payment_proof_url,
        'student_batch_ids': student_batch_ids_list,
        'center_id': lead.center_id
    }
    
    try:
        student = convert_lead_to_student(
            db=db,
            lead_id=lead_id,
            student_data=student_data,
            user_id=current_user.id
        )
        
        # Return student data with lead info
        from backend.schemas.students import StudentRead
        from sqlalchemy.orm import selectinload
        # Reload student with relationships
        from backend.models import Student
        stmt = select(Student).where(Student.id == student.id).options(
            selectinload(Student.lead),
            selectinload(Student.batches)
        )
        student_with_relations = db.exec(stmt).first()
        return StudentRead.from_student(student_with_relations)
    except ValueError as e:
        error_message = str(e)
        if "CAPACITY_REACHED" in error_message:
            raise HTTPException(status_code=400, detail=error_message)
        raise HTTPException(status_code=400, detail=error_message)


@app.get("/students")
def get_students_endpoint(
    center_id: Optional[int] = None,
    is_active: Optional[bool] = None,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get all students from the Student table, including player name from linked Lead record."""
    from backend.schemas.students import StudentRead
    from sqlalchemy.orm import selectinload
    
    # Get students with lead relationship loaded
    students = get_all_students(db, center_id=center_id, is_active=is_active)
    
    # Eagerly load lead relationships
    from backend.models import Student
    from sqlmodel import select
    if students:
        student_ids = [s.id for s in students]
        stmt = select(Student).where(Student.id.in_(student_ids)).options(
            selectinload(Student.lead),
            selectinload(Student.batches)
        )
        students = list(db.exec(stmt).all())
    
    # Convert to response format
    result = []
    for student in students:
        student_data = StudentRead.from_student(student)
        # Mask sensitive fields for coaches
        if current_user.role == "coach":
            from backend.core.lead_privacy import mask_student_for_coach
            student_dict = student_data.model_dump()
            masked_dict = mask_student_for_coach(student_dict)
            result.append(masked_dict)
        else:
            result.append(student_data.model_dump())
    
    return result


@app.put("/students/{student_id}")
def update_student_endpoint(
    student_id: int,
    center_id: Optional[int] = None,
    subscription_plan: Optional[str] = None,
    subscription_start_date: Optional[str] = None,
    subscription_end_date: Optional[str] = None,
    payment_proof_url: Optional[str] = None,
    student_batch_ids: Optional[str] = None,  # Comma-separated list of batch IDs
    is_active: Optional[bool] = None,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Update a student's subscription, batches, status, or center (with strict governance)."""
    from backend.core.students import get_student_by_lead_id, update_student
    from backend.models import Student, StudentBatchLink, Batch
    from sqlalchemy.orm import selectinload
    from sqlmodel import select
    from datetime import date as date_type
    
    # Get student
    student = db.get(Student, student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    
    # Check permissions (basic access check)
    if current_user.role != "team_lead":
        user_center_ids = [c.id for c in current_user.centers]
        if student.center_id not in user_center_ids:
            raise HTTPException(status_code=403, detail="Not authorized to update this student")
    
    # Parse batch IDs if provided
    batch_ids_list = None
    if student_batch_ids is not None:
        batch_ids_list = []
        if student_batch_ids:
            try:
                batch_ids_list = [int(id.strip()) for id in student_batch_ids.split(",") if id.strip()]
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid student_batch_ids format. Use comma-separated integers")
    
    # Parse dates if provided
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
    
    # Track if subscription is being renewed (new dates or plan provided)
    subscription_renewed = False
    if subscription_plan is not None and subscription_plan != student.subscription_plan:
        subscription_renewed = True
    if parsed_start_date is not None and parsed_start_date != student.subscription_start_date:
        subscription_renewed = True
    if parsed_end_date is not None and parsed_end_date != student.subscription_end_date:
        subscription_renewed = True
    
    # Use update_student function with strict governance
    try:
        updated_student = update_student(
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
            is_active=is_active
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    # Renewal Reset: Reset renewal flags when subscription is renewed
    if subscription_renewed:
        updated_student.renewal_intent = False
        updated_student.in_grace_period = False
        updated_student.grace_nudge_count = 0
        db.add(updated_student)
        db.commit()
        db.refresh(updated_student)
    
    # Reload with relationships
    stmt = select(Student).where(Student.id == student_id).options(
        selectinload(Student.lead),
        selectinload(Student.batches)
    )
    updated_student = db.exec(stmt).first()
    
    from backend.schemas.students import StudentRead
    return StudentRead.from_student(updated_student)


@app.put("/students/renew/{public_token}")
def update_renewal_intent_endpoint(
    public_token: str,
    db: Session = Depends(get_session)
):
    """
    Public endpoint to update renewal_intent for a student.
    Called from the public renewal page.
    """
    from backend.models import Student, Lead
    from sqlalchemy.orm import selectinload
    from sqlmodel import select
    
    # Find student by lead's public_token
    # First find the lead with this public_token
    lead = db.exec(
        select(Lead).where(Lead.public_token == public_token)
    ).first()
    
    if not lead:
        raise HTTPException(status_code=404, detail="Invalid renewal link")
    
    # Find the student associated with this lead
    student = db.exec(
        select(Student)
        .where(Student.lead_id == lead.id)
        .options(selectinload(Student.lead))
    ).first()
    
    if not student:
        raise HTTPException(status_code=404, detail="Student not found for this link")
    
    # Update renewal_intent
    student.renewal_intent = True
    db.add(student)
    db.commit()
    db.refresh(student)
    
    return {
        "success": True,
        "message": "Renewal intent recorded. Our team will follow up for payment.",
        "student_id": student.id,
        "player_name": lead.player_name if lead else None
    }


@app.post("/students/{student_id}/grace-nudge")
def send_grace_nudge_endpoint(
    student_id: int,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Send a grace period nudge to a student.
    Increments grace_nudge_count.
    """
    from backend.models import Student, AuditLog
    from datetime import datetime
    
    student = db.get(Student, student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    
    # Verify user has access
    if current_user.role != "team_lead":
        user_center_ids = [c.id for c in current_user.centers]
        if student.center_id not in user_center_ids:
            raise HTTPException(status_code=403, detail="Not authorized to update this student")
    
    if not student.in_grace_period:
        raise HTTPException(status_code=400, detail="Student is not in grace period")
    
    if student.grace_nudge_count >= 2:
        raise HTTPException(status_code=400, detail="Maximum grace nudges (2) already sent")
    
    # Increment grace_nudge_count
    old_count = student.grace_nudge_count
    student.grace_nudge_count = old_count + 1
    
    # Log the action
    if student.lead:
        audit_log = AuditLog(
            lead_id=student.lead_id,
            user_id=current_user.id,
            action_type='grace_nudge_sent',
            description=f'Grace period nudge sent (grace_nudge_count: {old_count} → {student.grace_nudge_count})',
            old_value=str(old_count),
            new_value=str(student.grace_nudge_count),
            timestamp=datetime.utcnow()
        )
        db.add(audit_log)
    
    db.add(student)
    db.commit()
    db.refresh(student)
    
    return {
        "message": "Grace nudge sent successfully",
        "grace_nudge_count": student.grace_nudge_count
    }


@app.get("/students/by-token/{public_token}")
def get_student_by_token_endpoint(
    public_token: str,
    db: Session = Depends(get_session)
):
    """
    Public endpoint to get student information by public_token.
    Used by the renewal page to display student info.
    """
    from backend.models import Student, Lead
    from sqlalchemy.orm import selectinload
    from sqlmodel import select
    
    # Find lead by public_token
    lead = db.exec(
        select(Lead).where(Lead.public_token == public_token)
    ).first()
    
    if not lead:
        raise HTTPException(status_code=404, detail="Invalid renewal link")
    
    # Find student associated with this lead
    student = db.exec(
        select(Student)
        .where(Student.lead_id == lead.id)
        .options(selectinload(Student.lead), selectinload(Student.batches))
    ).first()
    
    if not student:
        raise HTTPException(status_code=404, detail="Student not found for this link")
    
    from backend.schemas.students import StudentRead
    return StudentRead.from_student(student)


@app.put("/leads/{lead_id}/age-category")
def update_age_category_endpoint(
    lead_id: int,
    age_category: str,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Update a lead's age category."""
    from backend.core.leads import get_lead_by_id
    
    # Verify user has access to this lead
    lead = get_lead_by_id(db, lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    # Check permissions
    if current_user.role != "team_lead":
        user_center_ids = [c.id for c in current_user.centers]
        if lead.center_id not in user_center_ids:
            raise HTTPException(status_code=403, detail="Not authorized to update this lead")
    
    try:
        updated_lead = update_lead(
            db=db,
            lead_id=lead_id,
            status=lead.status,  # Keep current status
            player_age_category=age_category,
            user_id=current_user.id
        )
        return {"status": "updated", "age_category": updated_lead.player_age_category}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.put("/leads/{lead_id}/metadata")
def update_lead_metadata_endpoint(
    lead_id: int,
    metadata: Dict = Body(...),
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Update a lead's extra_data field (e.g., skill reports)."""
    from backend.core.lead_metadata import update_lead_metadata
    from backend.core.leads import get_lead_by_id, get_leads_for_user
    
    # Verify user has access to this lead
    lead = get_lead_by_id(db, lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    # Check permissions based on user role
    if current_user.role == "coach":
        # Coaches can only update skill reports for leads/students in their assigned batches
        # Check: 1) lead has trial_batch_id or permanent_batch_id in coach's batches
        # 2) OR lead has associated student assigned to batches via StudentBatchLink
        from backend.models import BatchCoachLink, StudentBatchLink, Student
        from sqlmodel import select
        
        # Get coach's assigned batch IDs
        coach_batch_ids = db.exec(
            select(BatchCoachLink.batch_id).where(BatchCoachLink.user_id == current_user.id)
        ).all()
        coach_batch_ids_list = list(coach_batch_ids)
        
        if not coach_batch_ids_list:
            raise HTTPException(status_code=403, detail="You don't have any assigned batches")
        
        # Check if lead is in coach's batches via trial_batch_id or permanent_batch_id
        lead_in_batch = (
            (lead.trial_batch_id and lead.trial_batch_id in coach_batch_ids_list) or
            (lead.permanent_batch_id and lead.permanent_batch_id in coach_batch_ids_list)
        )
        
        # If not, check if lead has associated student assigned to coach's batches
        student_in_batch = False
        if not lead_in_batch:
            student = db.exec(select(Student).where(Student.lead_id == lead_id)).first()
            if student:
                # Check if student is assigned to any of coach's batches
                student_batch_links = db.exec(
                    select(StudentBatchLink.batch_id).where(
                        StudentBatchLink.student_id == student.id,
                        StudentBatchLink.batch_id.in_(coach_batch_ids_list)
                    )
                ).all()
                student_in_batch = len(list(student_batch_links)) > 0
        
        if not lead_in_batch and not student_in_batch:
            raise HTTPException(status_code=403, detail="You don't have access to update this lead/student")
        
        # Coaches can only update skill_reports (not other metadata)
        # Check if metadata contains only skill_reports field
        if set(metadata.keys()) != {'skill_reports'}:
            raise HTTPException(status_code=403, detail="Coaches can only update skill reports")
    elif current_user.role == "team_lead":
        # Team leads can update any metadata
        pass
    else:
        # Regular users (sales) can update leads in their assigned centers
        user_center_ids = [c.id for c in current_user.centers]
        if lead.center_id not in user_center_ids:
            raise HTTPException(status_code=403, detail="Not authorized to update this lead")
    
    try:
        updated_lead = update_lead_metadata(
            db=db,
            lead_id=lead_id,
            metadata_updates=metadata,
            user_id=current_user.id
        )
        return {"status": "updated", "metadata": updated_lead.extra_data}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.get("/leads/{lead_id}/activity")
def get_lead_activity(
    lead_id: int,
    limit: Optional[int] = 50,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Get activity/audit log for a specific lead.
    
    Query Parameters:
        limit: Maximum number of activities to return (default: 50)
    """
    from backend.core.leads import get_lead_by_id
    from sqlmodel import select
    
    # Verify user has access to this lead
    lead = get_lead_by_id(db, lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    # Check permissions
    if current_user.role != "team_lead":
        user_center_ids = [c.id for c in current_user.centers]
        if lead.center_id not in user_center_ids:
            raise HTTPException(status_code=403, detail="Not authorized to view this lead")
    
    # Get audit logs
    logs = get_audit_logs_for_lead(db, lead_id, limit=limit)
    return {"activities": logs}


# --- BULK OPERATIONS ENDPOINTS ---
@app.post("/leads/bulk/status")
def bulk_update_status(
    request: BulkUpdateStatusRequest,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Bulk update lead status.
    """
    # Verify user has access to all leads
    accessible_lead_ids = verify_leads_accessible(db, request.lead_ids, current_user)
    
    if len(accessible_lead_ids) != len(request.lead_ids):
        return {
            "updated_count": 0,
            "errors": ["Some leads are not accessible or not found"],
            "accessible_lead_ids": accessible_lead_ids
        }
    
    result = bulk_update_lead_status(
        db=db,
        lead_ids=accessible_lead_ids,
        new_status=request.new_status,
        user_id=current_user.id
    )
    
    return result


@app.post("/leads/bulk/assign")
def bulk_assign_center(
    request: BulkAssignCenterRequest,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Bulk assign leads to a center.
    Only team leads can perform this operation.
    """
    if current_user.role != "team_lead":
        raise HTTPException(status_code=403, detail="Only team leads can reassign leads")
    
    # Verify user has access to all leads
    accessible_lead_ids = verify_leads_accessible(db, request.lead_ids, current_user)
    
    if len(accessible_lead_ids) != len(request.lead_ids):
        return {
            "updated_count": 0,
            "errors": ["Some leads are not accessible or not found"],
            "accessible_lead_ids": accessible_lead_ids
        }
    
    result = bulk_update_lead_assignment(
        db=db,
        lead_ids=accessible_lead_ids,
        new_center_id=request.center_id,
        user_id=current_user.id
    )
    
    return result


# --- ANALYTICS ENDPOINTS ---
@app.get("/analytics/command-center")
def get_command_center_analytics(
    target_date: Optional[str] = None,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Get role-based command center analytics.
    
    Query Parameters:
        target_date: Optional date in YYYY-MM-DD format (defaults to today)
    """
    from backend.core.analytics import get_command_center_analytics
    
    target = None
    if target_date:
        try:
            target = datetime.fromisoformat(target_date).date()
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    
    return get_command_center_analytics(db, current_user, target)


@app.get("/students/{student_id}/milestones")
def get_student_milestones_endpoint(
    student_id: int,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Get milestone information for a specific student.
    
    Returns total sessions attended and milestone information.
    """
    from backend.core.analytics import get_student_milestones
    from backend.models import Student, BatchCoachLink, StudentBatchLink
    from sqlmodel import select
    
    # Verify student exists and user has access
    student = db.get(Student, student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    
    # Check access permissions based on role
    if current_user.role == "coach":
        # Coaches can view milestones for students in their assigned batches
        coach_batch_ids = db.exec(
            select(BatchCoachLink.batch_id).where(BatchCoachLink.user_id == current_user.id)
        ).all()
        coach_batch_ids_list = list(coach_batch_ids)
        
        if not coach_batch_ids_list:
            raise HTTPException(status_code=403, detail="You don't have any assigned batches")
        
        # Check if student is assigned to any of coach's batches
        student_batch_links = db.exec(
            select(StudentBatchLink.batch_id).where(
                StudentBatchLink.student_id == student_id,
                StudentBatchLink.batch_id.in_(coach_batch_ids_list)
            )
        ).all()
        
        if not list(student_batch_links):
            raise HTTPException(status_code=403, detail="Not authorized to view this student")
    elif current_user.role != "team_lead":
        # Regular users (sales) can view students in their assigned centers
        center_ids = [c.id for c in current_user.centers]
        if student.center_id not in center_ids:
            raise HTTPException(status_code=403, detail="Not authorized to view this student")
    
    milestones = get_student_milestones(db, student_id)
    return milestones


@app.post("/subscriptions/run-expiry-check")
def run_subscription_expiry_check(
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Manually trigger subscription expiry check.
    Moves expired students (status 'Joined' with subscription_end_date in the past) to 'Nurture' status.
    
    Requires team_lead role.
    """
    if current_user.role != "team_lead":
        raise HTTPException(status_code=403, detail="Only team leads can trigger subscription expiry check")
    
    from backend.core.subscriptions import check_subscription_expirations
    
    expired_lead_ids = check_subscription_expirations(db)
    
    return {
        "status": "success",
        "expired_count": len(expired_lead_ids),
        "expired_lead_ids": expired_lead_ids
    }


@app.get("/analytics/conversion-rates")
def get_conversion_rates(
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Get conversion rates between status transitions.
    Returns conversion rates for each status transition.
    """
    conversion_rates = calculate_conversion_rates(db)
    return {"conversion_rates": conversion_rates}


@app.get("/analytics/time-to-contact")
def get_time_to_contact(
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Get average time (in hours) from lead creation to first contact (status change).
    """
    avg_hours = calculate_average_time_to_contact(db)
    if avg_hours is None:
        return {"average_hours": None, "message": "No data available"}
    return {"average_hours": avg_hours}


@app.get("/analytics/status-distribution")
def get_status_distribution_endpoint(
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Get count of leads per status.
    """
    distribution = get_status_distribution(db)
    return {"distribution": distribution}


@app.get("/analytics/abandoned-count")
def get_abandoned_leads_count_endpoint(
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Get the count of abandoned leads.
    """
    count = get_abandoned_leads_count(db)
    return {"abandoned_leads_count": count}


@app.get("/analytics/at-risk-count")
def get_at_risk_leads_count_endpoint(
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Get the count of at-risk leads (10 days inactive).
    """
    count = get_at_risk_leads_count(db)
    return {"at_risk_leads_count": count}


# --- REPORT AUDIT ENDPOINTS ---
@app.post("/leads/{lead_id}/report-sent")
async def log_report_sent_endpoint(
    lead_id: int,
    details: Optional[str] = None,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Log that a report was sent for a student.
    This removes them from the 'Pending Student Reports' list.
    """
    try:
        audit_log = log_report_sent(
            db=db,
            lead_id=lead_id,
            user_id=current_user.id,
            details=details or "Progress Card shared with parent via WhatsApp"
        )
        return {
            "status": "success",
            "audit_log_id": audit_log.id,
            "message": "Report sent action logged successfully"
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# --- SKILL EVALUATION ENDPOINTS ---
@app.post("/leads/{lead_id}/skills")
async def create_skill_evaluation_endpoint(
    lead_id: int,
    technical_score: int,
    fitness_score: int,
    teamwork_score: int,
    discipline_score: int,
    coach_notes: Optional[str] = None,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Create a skill evaluation for a lead (coaches only).
    
    Path Parameters:
        lead_id: Lead (student) ID
        
    Body Parameters:
        technical_score: Technical skill score (1-5)
        fitness_score: Fitness score (1-5)
        teamwork_score: Teamwork score (1-5)
        discipline_score: Discipline score (1-5)
        coach_notes: Optional notes from the coach
    """
    if current_user.role != "coach":
        raise HTTPException(status_code=403, detail="Only coaches can create skill evaluations")
    
    try:
        evaluation = create_skill_evaluation(
            db=db,
            lead_id=lead_id,
            coach_id=current_user.id,
            technical_score=technical_score,
            fitness_score=fitness_score,
            teamwork_score=teamwork_score,
            discipline_score=discipline_score,
            coach_notes=coach_notes
        )
        return evaluation
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/leads/{lead_id}/skills/summary")
async def get_skill_summary_endpoint(
    lead_id: int,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Get aggregated skill summary for a lead.
    Returns average scores across all evaluations and most recent notes.
    
    Path Parameters:
        lead_id: Lead (student) ID
    """
    # Verify lead exists
    lead = db.get(Lead, lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    # Privacy check: coaches can only see evaluations for leads in their batches
    if current_user.role == "coach":
        from backend.core.leads import get_leads_for_user
        user_leads, _ = get_leads_for_user(db, current_user, limit=10000)
        if not any(l.id == lead_id for l in user_leads):
            raise HTTPException(status_code=403, detail="You don't have access to this lead")
    
    summary = get_skill_summary_for_lead(db, lead_id)
    return summary


# --- LEAD STAGING ENDPOINTS ---
@app.post("/staging/leads")
async def create_staging_lead_endpoint(
    player_name: str = Body(...),
    phone: str = Body(...),
    email: Optional[str] = Body(None),
    center_id: int = Body(...),
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Create a staging lead (coaches only).
    Includes duplicate check against both Lead and LeadStaging tables.
    
    Body Parameters:
        player_name: Player's name
        phone: Phone number
        email: Optional email address
        center_id: Center ID
    """
    if current_user.role != "coach":
        raise HTTPException(status_code=403, detail="Only coaches can create staging leads")
    
    try:
        staging_lead = create_staging_lead(
            db=db,
            player_name=player_name,
            phone=phone,
            email=email,
            center_id=center_id,
            created_by_id=current_user.id
        )
        return staging_lead
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/staging/leads")
async def get_staging_leads_endpoint(
    center_id: Optional[int] = None,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Get staging leads for Team Members (filtered by their assigned centers).
    Team Leads see all staging leads.
    
    Query Parameters:
        center_id: Optional center ID to filter by (overrides user centers)
    """
    if current_user.role not in ["team_lead", "team_member"]:
        raise HTTPException(status_code=403, detail="Only Team Leads and Team Members can view staging leads")
    
    staging_leads = get_staging_leads(db=db, user=current_user, center_id=center_id)
    return staging_leads


@app.post("/staging/leads/{staging_id}/promote")
async def promote_staging_lead_endpoint(
    staging_id: int,
    player_age_category: str = Body(...),
    email: Optional[str] = Body(None),
    address: Optional[str] = Body(None),
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Promote a staging lead to a full Lead record (Team Leads and Team Members only).
    Requires age_category to be provided.
    
    Body Parameters:
        player_age_category: Required age category (e.g., 'U9', 'U11')
        email: Optional email address (overrides staging email if provided)
        address: Optional address
    """
    if current_user.role not in ["team_lead", "team_member"]:
        raise HTTPException(status_code=403, detail="Only Team Leads and Team Members can promote staging leads")
    
    try:
        lead = promote_staging_lead(
            db=db,
            staging_id=staging_id,
            player_age_category=player_age_category,
            email=email,
            address=address,
            user_id=current_user.id
        )
        return lead
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# --- DIRECT LEAD CREATION ENDPOINT (Team Leads only) ---
@app.post("/leads")
async def create_lead_endpoint(
    player_name: str = Body(...),
    player_age_category: str = Body(...),
    phone: str = Body(...),
    email: Optional[str] = Body(None),
    address: Optional[str] = Body(None),
    center_id: int = Body(...),
    status: str = Body("New"),
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Create a full lead record directly (Team Leads only).
    For manual entry of complete lead information.
    
    Body Parameters:
        player_name: Player's name
        player_age_category: Age category (e.g., 'U9', 'U11')
        phone: Phone number
        email: Optional email address
        address: Optional address
        center_id: Center ID
        status: Lead status (default: 'New')
    """
    if current_user.role != "team_lead":
        raise HTTPException(status_code=403, detail="Only Team Leads can create leads directly")
    
    # Check for duplicates
    if check_duplicate_lead(db, player_name, phone):
        raise HTTPException(status_code=400, detail="A lead with this name and phone number already exists")
    
    try:
        from datetime import timedelta
        from backend.models import Lead
        import uuid
        
        # Verify center exists
        center = db.get(Center, center_id)
        if not center:
            raise HTTPException(status_code=400, detail=f"Center {center_id} not found")
        
        # Create lead
        initial_followup = datetime.utcnow() + timedelta(hours=24)
        new_lead = Lead(
            created_time=datetime.utcnow(),
            player_name=player_name,
            player_age_category=player_age_category,
            phone=phone,
            email=email,
            address=address,
            center_id=center_id,
            status=status,
            public_token=str(uuid.uuid4()),
            next_followup_date=initial_followup
        )
        
        db.add(new_lead)
        db.commit()
        db.refresh(new_lead)
        
        return new_lead
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# --- ATTENDANCE ENDPOINTS ---
@app.post("/attendance/check-in")
async def check_in_endpoint(
    batch_id: int,
    status: str,  # 'Present', 'Absent', 'Excused', 'Late'
    lead_id: Optional[int] = None,
    student_id: Optional[int] = None,
    date: Optional[str] = None,  # YYYY-MM-DD format, defaults to today
    remarks: Optional[str] = None,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Record attendance for a lead or student in a batch.
    Only coaches assigned to the batch can record attendance.
    Must provide either lead_id (for trial students) or student_id (for active students).
    """
    from datetime import date as date_class
    from backend.models import Student
    
    # Validate that at least one ID is provided
    if not lead_id and not student_id:
        raise HTTPException(
            status_code=400,
            detail="Either lead_id or student_id must be provided"
        )
    
    # If student_id is provided, look up the associated lead_id
    if student_id and not lead_id:
        student = db.get(Student, student_id)
        if not student:
            raise HTTPException(status_code=404, detail=f"Student {student_id} not found")
        lead_id = student.lead_id
    
    # Parse date if provided
    attendance_date = None
    if date:
        try:
            attendance_date = datetime.fromisoformat(date).date()
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    else:
        attendance_date = date_class.today()
    
    # Validate status
    if status not in ["Present", "Absent", "Excused", "Late"]:
        raise HTTPException(status_code=400, detail="Status must be one of: Present, Absent, Excused, Late")
    
    try:
        attendance = record_attendance(
            db=db,
            lead_id=lead_id,
            batch_id=batch_id,
            user_id=current_user.id,
            status=status,
            date=attendance_date,
            remarks=remarks
        )
        return {
            "status": "success",
            "attendance_id": attendance.id,
            "lead_id": attendance.lead_id,
            "student_id": attendance.student_id,
            "batch_id": attendance.batch_id,
            "date": attendance.date.isoformat(),
            "status": attendance.status
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))


@app.get("/attendance/history/{lead_id}")
async def get_attendance_history_endpoint(
    lead_id: int,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Get attendance history for a specific lead.
    Coaches can only see attendance for leads in their batches.
    """
    try:
        history = get_attendance_history(db=db, lead_id=lead_id, user=current_user)
        # Format response to match frontend expectation
        return {
            "lead_id": lead_id,
            "attendance": [
                {
                    "id": att.id,
                    "batch_id": att.batch_id,
                    "date": att.date.isoformat(),
                    "status": att.status,
                    "remarks": att.remarks,
                    "recorded_at": att.recorded_at.isoformat() if att.recorded_at else None,
                    "coach_id": att.user_id
                }
                for att in history
            ],
            "count": len(history)
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))


# --- TASK QUEUE & CALENDAR ENDPOINTS ---
@app.get("/tasks/daily-queue")
def get_daily_task_queue_endpoint(
    target_date: Optional[str] = None,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Get the daily task queue for the current user.
    
    Query Parameters:
        target_date: Optional date in YYYY-MM-DD format (defaults to today)
    """
    target = None
    if target_date:
        try:
            target = datetime.fromisoformat(target_date).date()
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    
    return get_daily_task_queue(db, current_user, target)


@app.get("/tasks/daily-stats")
def get_daily_stats_endpoint(
    target_date: Optional[str] = None,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Get daily vital stats for the current user.
    
    Query Parameters:
        target_date: Optional date in YYYY-MM-DD format (defaults to today)
    """
    target = None
    if target_date:
        try:
            target = datetime.fromisoformat(target_date).date()
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    
    return get_daily_stats(db, current_user, target)


@app.get("/calendar/month")
def get_calendar_month_endpoint(
    year: int,
    month: int,
    center_ids: Optional[str] = None,  # Comma-separated list of center IDs
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Get calendar data for a specific month with workload heatmap.
    
    Query Parameters:
        year: Year (e.g., 2024)
        month: Month (1-12)
        center_ids: Optional comma-separated list of center IDs to filter by
    """
    center_id_list = None
    if center_ids:
        try:
            center_id_list = [int(id.strip()) for id in center_ids.split(",")]
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid center_ids format. Use comma-separated integers")
    
    if not (1 <= month <= 12):
        raise HTTPException(status_code=400, detail="Month must be between 1 and 12")
    
    return get_calendar_month_view(db, current_user, year, month, center_id_list)


@app.get("/user/stats/streak")
def get_user_streak_endpoint(
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get user's completion streak stats."""
    return get_user_completion_streak(db, current_user.id)


@app.get("/user/stats/today")
def get_user_today_stats_endpoint(
    target_date: Optional[str] = None,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get user's completion stats for today (or specified date)."""
    target = None
    if target_date:
        try:
            target = datetime.fromisoformat(target_date).date()
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    
    return get_user_today_completion_stats(db, current_user.id, target)


# --- BATCH MANAGEMENT ENDPOINTS ---
@app.get("/batches")
def get_batches_endpoint(
    center_id: Optional[int] = None,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Get all batches, optionally filtered by center.
    Team Leads see all batches (active and inactive).
    Coaches and Sales see only active batches.
    """
    batches = get_all_batches(db, user=current_user, center_id=center_id)
    
    # Get coaches for each batch
    batches_with_coaches = []
    for batch in batches:
        # Build schedule string from day flags
        schedule_days = []
        if batch.is_mon: schedule_days.append("Mon")
        if batch.is_tue: schedule_days.append("Tue")
        if batch.is_wed: schedule_days.append("Wed")
        if batch.is_thu: schedule_days.append("Thu")
        if batch.is_fri: schedule_days.append("Fri")
        if batch.is_sat: schedule_days.append("Sat")
        if batch.is_sun: schedule_days.append("Sun")
        schedule_string = ", ".join(schedule_days) if schedule_days else "No days selected"
        
        batch_dict = {
            "id": batch.id,
            "name": batch.name,
            "center_id": batch.center_id,
            "age_category": batch.age_category,
            "max_capacity": batch.max_capacity,
            "is_mon": batch.is_mon,
            "is_tue": batch.is_tue,
            "is_wed": batch.is_wed,
            "is_thu": batch.is_thu,
            "is_fri": batch.is_fri,
            "is_sat": batch.is_sat,
            "is_sun": batch.is_sun,
            "start_time": batch.start_time.strftime("%H:%M:%S") if batch.start_time else None,  # Format as HH:MM:SS string
            "end_time": batch.end_time.strftime("%H:%M:%S") if batch.end_time else None,  # Format as HH:MM:SS string
            "start_date": batch.start_date.isoformat() if batch.start_date else None,
            "is_active": batch.is_active,
            "schedule_days": schedule_string,  # Human-readable schedule string
            "coaches": [{"id": c.id, "full_name": c.full_name, "email": c.email} for c in get_batch_coaches(db, batch.id)]
        }
        batches_with_coaches.append(batch_dict)
    
    return batches_with_coaches


@app.get("/batches/{batch_id}/potential-reactivations")
def get_potential_reactivations_endpoint(
    batch_id: int,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Get potential leads to re-activate for a new batch.
    
    Returns leads with matching center and age category that are in Nurture, On Break,
    or Dead with 'Timing Mismatch' reason, and do_not_contact is False.
    """
    if current_user.role not in ["team_lead", "team_member"]:
        raise HTTPException(status_code=403, detail="Only sales roles can view reactivations")
    
    try:
        leads = get_potential_reactivations(db, batch_id)
        # Serialize leads (respect privacy for coaches)
        from backend.core.lead_privacy import serialize_leads_for_user
        serialized_leads = serialize_leads_for_user(leads, current_user)
        return {"leads": serialized_leads, "count": len(serialized_leads)}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/leads/{lead_id}/nudge")
def send_nudge_endpoint(
    lead_id: int,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Send a re-engagement nudge to a lead (Nurture or On Break status).
    Increments nudge_count and returns the updated count.
    """
    try:
        updated_lead = increment_nudge_count(db, lead_id, current_user.id)
        return {
            "message": "Nudge sent successfully",
            "nudge_count": updated_lead.nudge_count
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error sending nudge: {str(e)}")


@app.post("/batches")
def create_batch_endpoint(
    name: str,
    center_id: int,
    age_category: str,
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
    coach_ids: Optional[str] = None,  # Comma-separated list of coach IDs
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Create a new batch (team leads only).
    Coach IDs can be provided as comma-separated string (e.g., "1,2,3").
    At least one coach must be assigned.
    """
    if current_user.role != "team_lead":
        raise HTTPException(status_code=403, detail="Only team leads can create batches")
    
    # Parse coach_ids if provided
    coach_ids_list = None
    if coach_ids:
        try:
            coach_ids_list = [int(id.strip()) for id in coach_ids.split(",") if id.strip()]
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid coach_ids format. Use comma-separated integers")
        
        # Validate: At least one coach required
        if not coach_ids_list:
            raise HTTPException(status_code=400, detail="At least one coach must be assigned to the batch")
    else:
        raise HTTPException(status_code=400, detail="At least one coach must be assigned to the batch")
    
    # Parse date string if provided
    from datetime import date as date_type
    start_date_obj = None
    if start_date:
        try:
            start_date_obj = datetime.fromisoformat(start_date).date()
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid start_date format: {start_date}. Use YYYY-MM-DD")
    
    try:
        new_batch = create_batch(
            db=db,
            name=name,
            center_id=center_id,
            age_category=age_category,
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
            coach_ids=coach_ids_list
        )
        return {"status": "created", "batch": new_batch}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/batches/{batch_id}/assign-coach")
def assign_coach_to_batch_endpoint(
    batch_id: int,
    user_id: Optional[int] = None,
    coach_ids: Optional[str] = None,  # Comma-separated list for multiple assignment
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Assign coach(es) to a batch (team leads only).
    
    Can use either:
    - user_id: Single coach assignment (for backward compatibility)
    - coach_ids: Comma-separated list for multiple coaches (replaces all existing assignments)
    At least one coach must be assigned.
    """
    if current_user.role != "team_lead":
        raise HTTPException(status_code=403, detail="Only team leads can assign coaches")
    
    # If coach_ids is provided, use multi-assignment (replaces all)
    if coach_ids:
        try:
            coach_ids_list = [int(id.strip()) for id in coach_ids.split(",") if id.strip()]
            if not coach_ids_list:
                raise HTTPException(status_code=400, detail="At least one coach must be assigned")
            
            assign_coaches_to_batch(db, batch_id, coach_ids_list)
            return {"status": "assigned", "batch_id": batch_id, "coach_ids": coach_ids_list}
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
    
    # Otherwise, use single assignment (backward compatibility)
    elif user_id:
        try:
            assignment = assign_coach_to_batch(db, batch_id, user_id)
            return {"status": "assigned", "batch_id": batch_id, "user_id": user_id}
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
    else:
        raise HTTPException(status_code=400, detail="Either user_id or coach_ids must be provided")


@app.put("/batches/{batch_id}")
def update_batch_endpoint(
    batch_id: int,
    name: Optional[str] = None,
    center_id: Optional[int] = None,
    age_category: Optional[str] = None,
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
    coach_ids: Optional[str] = None,  # Comma-separated list of coach IDs
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Update a batch (team leads only).
    Only provided fields will be updated.
    Coach IDs can be provided as comma-separated string (e.g., "1,2,3") to replace existing assignments.
    Team Leads can edit any field (timing, coaches, status) even if the batch is currently inactive.
    """
    if current_user.role != "team_lead":
        raise HTTPException(status_code=403, detail="Only team leads can update batches")
    
    # Parse coach_ids if provided
    coach_ids_list = None
    if coach_ids:
        try:
            coach_ids_list = [int(id.strip()) for id in coach_ids.split(",") if id.strip()]
            if not coach_ids_list:
                raise HTTPException(status_code=400, detail="coach_ids cannot be empty. To remove all coaches, use assign-coach endpoint")
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid coach_ids format. Use comma-separated integers")
    
    # Parse date string if provided
    from datetime import date as date_type
    start_date_obj = None
    if start_date:
        try:
            start_date_obj = datetime.fromisoformat(start_date).date()
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid start_date format: {start_date}. Use YYYY-MM-DD")
    
    try:
        updated_batch = update_batch(
            db=db,
            batch_id=batch_id,
            name=name,
            center_id=center_id,
            age_category=age_category,
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
            coach_ids=coach_ids_list
        )
        return {"status": "updated", "batch": updated_batch}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.delete("/batches/{batch_id}")
def delete_batch_endpoint(
    batch_id: int,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Delete a batch (team leads only).
    This will remove all coach assignments but will NOT delete associated leads.
    Leads will have their batch references set to null.
    """
    if current_user.role != "team_lead":
        raise HTTPException(status_code=403, detail="Only team leads can delete batches")
    
    try:
        from backend.core.batches import delete_batch as delete_batch_func
        delete_batch_func(db, batch_id)
        return {"status": "deleted", "batch_id": batch_id}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/batches/my-batches")
def get_my_batches_endpoint(
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Get batches assigned to the current user (coaches only).
    """
    if current_user.role != "coach":
        raise HTTPException(status_code=403, detail="Only coaches can view their assigned batches")
    
    batches = get_coach_batches(db, current_user.id)
    return {"batches": batches, "count": len(batches)}


# ==========================================
# APPROVALS ENDPOINTS
# ==========================================

@app.post("/approvals/request")
def create_status_change_request_endpoint(
    lead_id: int,
    current_status: str,
    requested_status: str,
    reason: str,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Submit a new status change request (regular users only)."""
    try:
        request = create_request(
            db=db,
            lead_id=lead_id,
            requested_by_id=current_user.id,
            current_status=current_status,
            requested_status=requested_status,
            reason=reason
        )
        return {
            "status": "success",
            "message": "Request submitted for approval",
            "request_id": request.id
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/approvals/pending")
def get_pending_requests_endpoint(
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get all pending status change requests (team leads only)."""
    if current_user.role != "team_lead":
        raise HTTPException(status_code=403, detail="Only team leads can view pending requests")
    
    requests = get_pending_requests(db)
    
    # Format response with lead and user details
    formatted_requests = []
    for req in requests:
        lead = db.get(Lead, req.lead_id)
        requester = db.get(User, req.requested_by_id)
        
        formatted_requests.append({
            "id": req.id,
            "lead_id": req.lead_id,
            "lead_name": lead.player_name if lead else "Unknown",
            "requested_by_id": req.requested_by_id,
            "requested_by_name": requester.full_name if requester else "Unknown",
            "current_status": req.current_status,
            "requested_status": req.requested_status,
            "reason": req.reason,
            "request_status": req.request_status,
            "created_at": req.created_at.isoformat() if req.created_at else None,
        })
    
    return {"requests": formatted_requests, "count": len(formatted_requests)}


@app.post("/approvals/{request_id}/resolve")
def resolve_request_endpoint(
    request_id: int,
    approved: bool,
    resolution_note: Optional[str] = None,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Approve or reject a status change request (team leads only)."""
    if current_user.role != "team_lead":
        raise HTTPException(status_code=403, detail="Only team leads can resolve requests")
    
    try:
        request = resolve_request(
            db=db,
            request_id=request_id,
            resolved_by_id=current_user.id,
            approved=approved,
            resolution_note=resolution_note
        )
        return {
            "status": "success",
            "message": f"Request {'approved' if approved else 'rejected'}",
            "request": {
                "id": request.id,
                "request_status": request.request_status,
                "resolved_at": request.resolved_at.isoformat() if request.resolved_at else None,
            }
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/approvals/lead/{lead_id}")
def get_lead_requests_endpoint(
    lead_id: int,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get all status change requests for a specific lead."""
    requests = get_requests_for_lead(db, lead_id)
    
    formatted_requests = []
    for req in requests:
        requester = db.get(User, req.requested_by_id)
        resolver = db.get(User, req.resolved_by_id) if req.resolved_by_id else None
        
        formatted_requests.append({
            "id": req.id,
            "current_status": req.current_status,
            "requested_status": req.requested_status,
            "reason": req.reason,
            "request_status": req.request_status,
            "requested_by_name": requester.full_name if requester else "Unknown",
            "resolved_by_name": resolver.full_name if resolver else None,
            "created_at": req.created_at.isoformat() if req.created_at else None,
            "resolved_at": req.resolved_at.isoformat() if req.resolved_at else None,
        })
    
    return {"requests": formatted_requests}


# ==========================================
# PUBLIC ENDPOINTS (No Authentication Required)
# ==========================================

@app.get("/public/lead-preferences/{token}", response_model=LeadPreferencesRead)
def get_lead_preferences_public(token: str, db: Session = Depends(get_session)):
    """
    Get lead preferences by public token (no auth required).
    
    Returns lead name, center batches (filtered by age), and center name.
    """
    preferences_data = get_lead_preferences_by_token(db, token)
    if not preferences_data:
        raise HTTPException(status_code=404, detail="Lead not found")
    return preferences_data


@app.put("/public/lead-preferences/{token}", response_model=Dict[str, str])
def update_lead_preferences_public(
    token: str,
    preferences: LeadPreferencesUpdate,
    db: Session = Depends(get_session)
):
    """
    Update lead preferences by public token (no auth required).
    
    Updates preferred_batch_id, preferred_call_time, and preferred_timing_notes.
    """
    try:
        updated_lead = update_lead_preferences_by_token(
            db,
            token,
            preferred_batch_id=preferences.preferred_batch_id,
            preferred_demo_batch_id=preferences.preferred_demo_batch_id,
            preferred_call_time=preferences.preferred_call_time,
            preferred_timing_notes=preferences.preferred_timing_notes,
            loss_reason=preferences.loss_reason,
            loss_reason_notes=preferences.loss_reason_notes
        )
        if not updated_lead:
            raise HTTPException(status_code=404, detail="Lead not found")
        return {"message": "Preferences updated successfully"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.put("/public/lead-feedback/{token}")
def record_lead_feedback_public(
    token: str,
    loss_reason: str,
    loss_reason_notes: Optional[str] = None,
    db: Session = Depends(get_session)
):
    """
    Record feedback from a lead who is not interested (no auth required).
    
    Sets status to 'Dead/Not Interested', do_not_contact to True, and saves loss_reason.
    """
    try:
        updated_lead = record_lead_feedback_by_token(
            db,
            token,
            loss_reason=loss_reason,
            loss_reason_notes=loss_reason_notes
        )
        if not updated_lead:
            raise HTTPException(status_code=404, detail="Lead not found")
        return {"message": "Feedback recorded successfully. We have removed you from our contact list."}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
