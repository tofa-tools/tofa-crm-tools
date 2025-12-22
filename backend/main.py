from fastapi import FastAPI, Depends, HTTPException, UploadFile, File
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session, select
from typing import List, Optional
from pydantic import BaseModel
import pandas as pd
from datetime import datetime

from backend.database import create_db_and_tables, get_session
from backend.models import User, Center, Lead, UserCenterLink, Comment
from backend.auth import get_password_hash, verify_password, create_access_token, get_current_user

app = FastAPI()

# CORS middleware - Allow React app to make requests
# Update allow_origins with your production frontend URLs
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",  # Local development
        "http://127.0.0.1:3000",  # Local development
        # Add your production frontend URLs here:
        # "https://your-frontend.vercel.app",
        # "https://your-frontend.netlify.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- SCHEMA FOR CREATING USER ---
class UserCreateSchema(BaseModel):
    email: str
    password: str
    full_name: str
    role: str
    center_ids: List[int]

@app.on_event("startup")
def on_startup():
    create_db_and_tables()
    with next(get_session()) as db:
        try:
            admin = db.exec(select(User).where(User.email == "admin@tofa.com")).first()
            if not admin:
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
async def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_session)):
    user = db.exec(select(User).where(User.email == form_data.username)).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect email or password")
    
    access_token = create_access_token(data={"sub": user.email, "role": user.role})
    return {"access_token": access_token, "token_type": "bearer", "role": user.role}

# --- USER MANAGEMENT ENDPOINTS ---
@app.post("/users/")
def create_user(
    user_data: UserCreateSchema, 
    db: Session = Depends(get_session), 
    current_user: User = Depends(get_current_user)
):
    if current_user.role != "team_lead":
        raise HTTPException(status_code=403, detail="Not authorized")
    
    if db.exec(select(User).where(User.email == user_data.email)).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # 1. Create User
    new_user = User(
        email=user_data.email,
        hashed_password=get_password_hash(user_data.password),
        full_name=user_data.full_name,
        role=user_data.role
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    # 2. Assign Centers
    for cid in user_data.center_ids:
        link = UserCenterLink(user_id=new_user.id, center_id=cid)
        db.add(link)
    
    db.commit()
    return {"status": "User created successfully"}

@app.get("/users/")
def read_users(db: Session = Depends(get_session), current_user: User = Depends(get_current_user)):
    if current_user.role != "team_lead":
        raise HTTPException(status_code=403, detail="Not authorized")
    # Fetch all users
    return db.exec(select(User)).all()

# --- UPLOAD ---
@app.post("/leads/upload/")
async def upload_leads(
    file: UploadFile = File(...), 
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != "team_lead":
        raise HTTPException(status_code=403, detail="Only Team Leads can import data")

    # Support both Excel and CSV files
    file_extension = file.filename.split('.')[-1].lower() if file.filename else ''
    
    try:
        if file_extension in ['xlsx', 'xls']:
            df = pd.read_excel(file.file)
        elif file_extension == 'csv':
            # Try different encodings for CSV
            file.file.seek(0)  # Reset file pointer
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

    df.columns = df.columns.str.strip()
    unique_tags = df[meta_col].unique()
    existing_centers = db.exec(select(Center)).all()
    known_tags = [c.meta_tag_name for c in existing_centers]
    unknown_tags = [tag for tag in unique_tags if tag not in known_tags]
    
    if unknown_tags:
        return {"status": "error", "message": "Unknown Centers Found", "unknown_tags": list(unknown_tags)}

    count = 0
    for _, row in df.iterrows():
        center = db.exec(select(Center).where(Center.meta_tag_name == row[meta_col])).first()
        phone_val = str(row.get('phone', ''))
        
        if center:
            try:
                created_dt = pd.to_datetime(row.get('created_time', datetime.now())).to_pydatetime()
            except:
                created_dt = datetime.now()

            new_lead = Lead(
                created_time=created_dt,
                player_name=row.get('player_name', 'Unknown'),
                player_age_category=row.get('player_age_category', 'Unknown'),
                phone=phone_val,
                email=row.get('email', ''),
                address=row.get('address_and_pincode', ''),
                center_id=center.id,
                status="New"
            )
            db.add(new_lead)
            count += 1
    
    db.commit()
    return {"status": "success", "leads_added": count}

# --- META WEBHOOK ENDPOINT (for direct Meta integration) ---
@app.post("/leads/meta-webhook/")
async def meta_webhook(
    data: dict,
    db: Session = Depends(get_session)
):
    """
    Webhook endpoint to receive leads directly from Meta (Facebook/Instagram) Lead Forms.
    Configure this URL in your Meta Lead Form settings.
    
    Expected data format:
    {
        "phone_number": "1234567890",
        "full_name": "Player Name",
        "email_address": "player@example.com",
        "nearest_center": "TOFA Tellapur",  # Must match meta_tag_name in Center table
        "player_age_category": "U-10",
        "address_and_pincode": "Address, Pincode"
    }
    """
    try:
        # Extract data from webhook payload
        phone = str(data.get("phone_number", "")).strip()
        name = data.get("full_name", "Unknown").strip()
        email = data.get("email_address", "").strip()
        center_tag = data.get("nearest_center", "").strip()
        age_category = data.get("player_age_category", "Unknown").strip()
        address = data.get("address_and_pincode", "").strip()
        
        # Validate required fields
        if not phone:
            return {"status": "error", "message": "Phone number is required"}
        
        if not center_tag:
            return {"status": "error", "message": "Center/Location is required"}
        
        # Find center by meta tag
        center = db.exec(select(Center).where(Center.meta_tag_name == center_tag)).first()
        if not center:
            return {
                "status": "error", 
                "message": f"Center '{center_tag}' not found. Please add it in 'Manage Centers' first.",
                "unknown_center": center_tag
            }
        
        # Create new lead
        new_lead = Lead(
            created_time=datetime.now(),
            player_name=name if name else "Unknown",
            player_age_category=age_category if age_category else "Unknown",
            phone=phone,
            email=email if email else None,
            address=address if address else None,
            center_id=center.id,
            status="New"
        )
        
        db.add(new_lead)
        db.commit()
        db.refresh(new_lead)
        
        return {
            "status": "success", 
            "message": "Lead created successfully",
            "lead_id": new_lead.id
        }
        
    except Exception as e:
        return {"status": "error", "message": f"Error processing webhook: {str(e)}"}

# --- READ/UPDATE ---
@app.get("/leads/my_leads")
def get_my_leads(db: Session = Depends(get_session), current_user: User = Depends(get_current_user)):
    if current_user.role == "team_lead":
        leads = db.exec(select(Lead)).all()
    else:
        # Load user with centers relationship
        # SQLModel doesn't load relationships by default sometimes in loops, so we query user again or trust lazy load
        center_ids = [c.id for c in current_user.centers]
        if not center_ids:
            return []
        leads = db.exec(select(Lead).where(Lead.center_id.in_(center_ids))).all()
    return leads

@app.put("/leads/{lead_id}")
def update_lead(
    lead_id: int, 
    status: str, 
    next_date: Optional[str] = None, 
    comment: Optional[str] = None,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    lead = db.get(Lead, lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
        
    lead.status = status
    if next_date and next_date != "None":
        try:
            lead.next_followup_date = datetime.fromisoformat(next_date)
        except:
            pass
    if comment:
        new_comment = Comment(text=comment, user_id=current_user.id, lead_id=lead.id)
        db.add(new_comment)
        
    db.add(lead)
    db.commit()
    return {"status": "updated"}

@app.post("/centers/")
def create_center(center: Center, db: Session = Depends(get_session), current_user: User = Depends(get_current_user)):
    if current_user.role != "team_lead":
        raise HTTPException(status_code=403, detail="Not authorized")
    db.add(center)
    db.commit()
    return center

@app.get("/centers/")
def read_centers(db: Session = Depends(get_session)):
    return db.exec(select(Center)).all()