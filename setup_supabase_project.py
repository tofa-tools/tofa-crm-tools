import os

# Project structure
project_structure = {
    "backend": ["__init__.py", "database.py", "models.py", "auth.py", "main.py"],
    "frontend": ["app.py"],
    ".": ["requirements.txt", ".env", "supabase_schema.sql"] # Added SQL file
}

file_contents = {}

# 1. requirements.txt (Added psycopg2 for Postgres/Supabase)
file_contents["requirements.txt"] = """
fastapi
uvicorn
sqlmodel
psycopg2-binary
streamlit
pandas
openpyxl
python-multipart
python-jose[cryptography]
passlib[bcrypt]
requests
"""

# 2. .env (Configured for Supabase)
file_contents[".env"] = """
# 1. GO TO SUPABASE -> SETTINGS -> DATABASE -> CONNECTION STRING (URI)
# 2. PASTE IT BELOW.
# 3. ENSURE IT STARTS WITH "postgresql://" (Supabase sometimes gives "postgres://")
# Example: postgresql://postgres.user:password@aws-0-ap-south-1.pooler.supabase.com:6543/postgres

DATABASE_URL=postgresql://YOUR_USER:YOUR_PASSWORD@YOUR_HOST:5432/postgres

# Security settings
SECRET_KEY=change_this_to_a_random_long_string_for_security
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
"""

# 3. supabase_schema.sql (The SQL Queries you asked for)
file_contents["supabase_schema.sql"] = """
-- COPY AND PASTE THIS INTO THE SUPABASE SQL EDITOR --

-- 1. Create Users Table
CREATE TABLE IF NOT EXISTS "user" (
    id SERIAL PRIMARY KEY,
    email VARCHAR NOT NULL UNIQUE,
    hashed_password VARCHAR NOT NULL,
    full_name VARCHAR NOT NULL,
    role VARCHAR NOT NULL DEFAULT 'team_member'
);

-- 2. Create Centers Table
CREATE TABLE IF NOT EXISTS "center" (
    id SERIAL PRIMARY KEY,
    display_name VARCHAR NOT NULL,
    meta_tag_name VARCHAR NOT NULL UNIQUE,
    city VARCHAR NOT NULL,
    location VARCHAR NOT NULL
);

-- 3. Create Join Table (User <-> Center)
CREATE TABLE IF NOT EXISTS "usercenterlink" (
    user_id INTEGER NOT NULL,
    center_id INTEGER NOT NULL,
    PRIMARY KEY (user_id, center_id),
    FOREIGN KEY (user_id) REFERENCES "user"(id) ON DELETE CASCADE,
    FOREIGN KEY (center_id) REFERENCES "center"(id) ON DELETE CASCADE
);

-- 4. Create Leads Table
CREATE TABLE IF NOT EXISTS "lead" (
    id SERIAL PRIMARY KEY,
    created_time TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    player_name VARCHAR NOT NULL,
    player_age_category VARCHAR NOT NULL,
    phone VARCHAR NOT NULL,
    email VARCHAR,
    address VARCHAR,
    status VARCHAR NOT NULL DEFAULT 'New',
    next_followup_date TIMESTAMP WITHOUT TIME ZONE,
    center_id INTEGER,
    FOREIGN KEY (center_id) REFERENCES "center"(id) ON DELETE SET NULL
);

-- 5. Create Comments Table
CREATE TABLE IF NOT EXISTS "comment" (
    id SERIAL PRIMARY KEY,
    text VARCHAR NOT NULL,
    timestamp TIMESTAMP WITHOUT TIME ZONE DEFAULT (now() at time zone 'utc'),
    user_id INTEGER NOT NULL,
    lead_id INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES "user"(id) ON DELETE CASCADE,
    FOREIGN KEY (lead_id) REFERENCES "lead"(id) ON DELETE CASCADE
);

-- 6. Create Indexes for Speed
CREATE INDEX IF NOT EXISTS idx_user_email ON "user" (email);
CREATE INDEX IF NOT EXISTS idx_center_meta ON "center" (meta_tag_name);
"""

# 4. backend/database.py (Using Postgres Driver)
file_contents["backend/database.py"] = """
from sqlmodel import SQLModel, create_engine, Session
from dotenv import load_dotenv
import os

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

# If user forgot to change postgres:// to postgresql://
if DATABASE_URL and DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

engine = create_engine(DATABASE_URL)

def get_session():
    with Session(engine) as session:
        yield session

def create_db_and_tables():
    # This checks if tables exist in Supabase and creates them if missing
    SQLModel.metadata.create_all(engine)
"""

# 5. backend/models.py (Same structure)
file_contents["backend/models.py"] = """
from typing import Optional, List
from datetime import datetime
from sqlmodel import Field, SQLModel, Relationship

class UserCenterLink(SQLModel, table=True):
    user_id: Optional[int] = Field(default=None, foreign_key="user.id", primary_key=True)
    center_id: Optional[int] = Field(default=None, foreign_key="center.id", primary_key=True)

class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    email: str = Field(unique=True, index=True)
    hashed_password: str
    full_name: str
    role: str = Field(default="team_member") 

    centers: List["Center"] = Relationship(back_populates="users", link_model=UserCenterLink)
    comments: List["Comment"] = Relationship(back_populates="user")

class Center(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    display_name: str
    meta_tag_name: str = Field(unique=True, index=True)
    city: str
    location: str

    users: List[User] = Relationship(back_populates="centers", link_model=UserCenterLink)
    leads: List["Lead"] = Relationship(back_populates="center")

class Lead(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    created_time: datetime
    player_name: str
    player_age_category: str
    phone: str
    email: Optional[str] = None
    address: Optional[str] = None
    status: str = Field(default="New") 
    next_followup_date: Optional[datetime] = None
    
    center_id: Optional[int] = Field(default=None, foreign_key="center.id")
    center: Optional[Center] = Relationship(back_populates="leads")
    comments: List["Comment"] = Relationship(back_populates="lead")

class Comment(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    text: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    user_id: int = Field(foreign_key="user.id")
    user: Optional[User] = Relationship(back_populates="comments")
    lead_id: int = Field(foreign_key="lead.id")
    lead: Optional[Lead] = Relationship(back_populates="comments")
"""

# 6. backend/auth.py
file_contents["backend/auth.py"] = """
from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlmodel import Session, select
from backend.database import get_session
from backend.models import User
import os
from dotenv import load_dotenv

load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY", "unsafe_secret_key")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 60))

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_session)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
        
    user = db.exec(select(User).where(User.email == email)).first()
    if user is None:
        raise credentials_exception
    return user
"""

# 7. backend/main.py
file_contents["backend/main.py"] = """
from fastapi import FastAPI, Depends, HTTPException, UploadFile, File
from fastapi.security import OAuth2PasswordRequestForm
from sqlmodel import Session, select
from typing import List, Optional
import pandas as pd
from datetime import datetime

from backend.database import create_db_and_tables, get_session
from backend.models import User, Center, Lead, UserCenterLink, Comment
from backend.auth import get_password_hash, verify_password, create_access_token, get_current_user

app = FastAPI()

@app.on_event("startup")
def on_startup():
    # This tries to create tables if they don't exist via Python
    # But using the .sql file in Supabase is safer/cleaner
    create_db_and_tables()
    
    # Create Default Admin
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
            print(f"Database might not be ready yet: {e}")

@app.post("/token")
async def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_session)):
    user = db.exec(select(User).where(User.email == form_data.username)).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect email or password")
    
    access_token = create_access_token(data={"sub": user.email, "role": user.role})
    return {"access_token": access_token, "token_type": "bearer", "role": user.role}

# --- UPLOAD ---
@app.post("/leads/upload/")
async def upload_leads(
    file: UploadFile = File(...), 
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != "team_lead":
        raise HTTPException(status_code=403, detail="Only Team Leads can import data")

    try:
        df = pd.read_excel(file.file)
    except:
        raise HTTPException(status_code=400, detail="Invalid Excel file")
    
    # Identify meta column
    meta_col = "_which_is_the_nearest_tofa_center_to_you?"
    if meta_col not in df.columns:
         # Try finding column by partial match if exact name fails
        possible_cols = [c for c in df.columns if "nearest_tofa" in str(c)]
        if possible_cols:
            meta_col = possible_cols[0]
        else:
            raise HTTPException(status_code=400, detail="Could not find Center/Location column in Excel")

    # Clean column names (strip whitespace)
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
        
        # Check duplicate by phone
        phone_val = str(row.get('phone', ''))
        exists = db.exec(select(Lead).where(Lead.phone == phone_val)).first()
        
        if not exists and center:
            # Handle Date
            created_raw = row.get('created_time', datetime.now())
            try:
                created_dt = pd.to_datetime(created_raw).to_pydatetime()
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

# --- READ/UPDATE ---
@app.get("/leads/my_leads")
def get_my_leads(db: Session = Depends(get_session), current_user: User = Depends(get_current_user)):
    if current_user.role == "team_lead":
        leads = db.exec(select(Lead)).all()
    else:
        center_ids = [c.id for c in current_user.centers]
        if not center_ids:
            return []
        leads = db.exec(select(Lead).where(Lead.center_id.in_(center_ids))).all()
    return leads

@app.put("/leads/{lead_id}")
def update_lead(
    lead_id: int, 
    status: str, 
    next_date: Optional[str] = None, # Received as string from Query Param
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
            pass # Ignore invalid date format
        
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
    try:
        db.add(center)
        db.commit()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Center might already exist. {e}")
    return center

@app.get("/centers/")
def read_centers(db: Session = Depends(get_session)):
    return db.exec(select(Center)).all()
"""

# 8. frontend/app.py
file_contents["frontend/app.py"] = """
import streamlit as st
import requests
import pandas as pd
from datetime import datetime

# CONFIG
API_URL = "http://127.0.0.1:8000"

st.set_page_config(page_title="TOFA CRM", layout="wide")

def login():
    st.title("TOFA Academy CRM")
    col1, col2 = st.columns([1,2])
    with col1:
        st.subheader("Login")
        email = st.text_input("Email")
        password = st.text_input("Password", type="password")
        if st.button("Login"):
            try:
                res = requests.post(f"{API_URL}/token", data={"username": email, "password": password})
                if res.status_code == 200:
                    data = res.json()
                    st.session_state['token'] = data['access_token']
                    st.session_state['role'] = data['role']
                    st.session_state['user_email'] = email
                    st.success("Login Successful!")
                    st.rerun()
                else:
                    st.error("Invalid credentials. (Default: admin@tofa.com / admin123)")
            except Exception as e:
                st.error(f"Cannot connect to backend. Make sure uvicorn is running! {e}")

def authenticated_app():
    st.sidebar.title(f"User: {st.session_state['user_email']}")
    st.sidebar.caption(f"Role: {st.session_state['role']}")
    
    menu_options = ["Dashboard", "My Leads"]
    if st.session_state['role'] == 'team_lead':
        menu_options.extend(["Manage Centers", "Import Data"])
        
    choice = st.sidebar.radio("Menu", menu_options)
    
    headers = {"Authorization": f"Bearer {st.session_state['token']}"}

    if choice == "Dashboard":
        st.header("Academy Overview")
        st.info("Welcome to the Football Academy CRM.")
        st.write("Use the sidebar to navigate.")

    elif choice == "Manage Centers":
        st.header("Manage Centers")
        with st.expander("Add New Center"):
            with st.form("new_center"):
                d_name = st.text_input("Display Name (e.g. TOFA Tellapur)")
                m_tag = st.text_input("Meta Tag (COPY EXACTLY from Excel)")
                city = st.text_input("City")
                loc = st.text_input("Location")
                submitted = st.form_submit_button("Create Center")
                if submitted:
                    payload = {"display_name": d_name, "meta_tag_name": m_tag, "city": city, "location": loc}
                    res = requests.post(f"{API_URL}/centers/", json=payload, headers=headers)
                    if res.status_code == 200:
                        st.success("Center Created")
                    else:
                        st.error(f"Error: {res.text}")

        st.subheader("Existing Centers")
        try:
            centers = requests.get(f"{API_URL}/centers/", headers=headers).json()
            if centers:
                st.dataframe(pd.DataFrame(centers))
        except:
            st.error("Could not fetch centers.")

    elif choice == "Import Data":
        st.header("Import Leads from Excel")
        uploaded_file = st.file_uploader("Upload Excel File", type=['xlsx', 'xls'])
        
        if uploaded_file and st.button("Process Import"):
            files = {"file": uploaded_file.getvalue()}
            res = requests.post(f"{API_URL}/leads/upload/", files={"file": uploaded_file}, headers=headers)
            
            data = res.json()
            if data.get("status") == "error":
                st.error(data['message'])
                st.warning("Please add these centers in 'Manage Centers' tab first:")
                st.code(data['unknown_tags'])
            else:
                st.success(f"Successfully added {data['leads_added']} leads!")

    elif choice == "My Leads":
        st.header("Lead Management")
        leads = requests.get(f"{API_URL}/leads/my_leads", headers=headers).json()
        
        if not leads:
            st.warning("No leads found.")
        else:
            df = pd.DataFrame(leads)
            
            # Filters
            status_filter = st.multiselect("Filter by Status", df['status'].unique(), default=df['status'].unique())
            df_filtered = df[df['status'].isin(status_filter)]
            
            st.dataframe(df_filtered[['player_name', 'phone', 'status', 'next_followup_date', 'player_age_category']])
            
            st.divider()
            st.subheader("Update Lead")
            
            lead_options = df_filtered.to_dict('records')
            selected_lead = st.selectbox("Select Lead to Call/Update", lead_options, format_func=lambda x: f"{x['player_name']} ({x['status']})")
            
            if selected_lead:
                st.write(f"**Phone:** {selected_lead['phone']} | **Center ID:** {selected_lead['center_id']}")
                
                with st.form("update_form"):
                    new_status = st.selectbox("New Status", ["New", "Called", "Trial Scheduled", "Joined", "Dead/Not Interested"], index=0)
                    next_followup = st.date_input("Next Follow Up Date")
                    comment = st.text_area("Add Call Notes")
                    
                    if st.form_submit_button("Update Status"):
                        payload = {
                            "status": new_status, 
                            "next_date": next_followup.isoformat(), 
                            "comment": comment
                        }
                        res = requests.put(f"{API_URL}/leads/{selected_lead['id']}", params=payload, headers=headers)
                        if res.status_code == 200:
                            st.success("Lead Updated!")
                            st.rerun()
                        else:
                            st.error("Failed to update")

    if st.sidebar.button("Logout"):
        del st.session_state['token']
        st.rerun()

if 'token' not in st.session_state:
    login()
else:
    authenticated_app()
"""

file_contents["backend/__init__.py"] = ""

def create_project():
    print("🚀 Initializing TOFA CRM (Supabase Edition)...")
    
    for folder in project_structure:
        if folder != ".":
            os.makedirs(folder, exist_ok=True)
            print(f"✅ Created folder: {folder}/")

    for filepath, content in file_contents.items():
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(content.strip())
        print(f"✅ Created file: {filepath}")

    print("\n✨ Setup Complete! Follow these steps now: ✨")
    print("---------------------------------------------")
    print("1. PIP INSTALL:  pip install -r requirements.txt")
    print("2. SUPABASE:     Go to Supabase -> SQL Editor -> Copy contents of 'supabase_schema.sql' -> Run.")
    print("3. ENV CONFIG:   Open .env file -> Paste your Supabase Connection String.")
    print("4. RUN BACKEND:  uvicorn backend.main:app --reload")
    print("5. RUN FRONTEND: streamlit run frontend/app.py")

if __name__ == "__main__":
    create_project()