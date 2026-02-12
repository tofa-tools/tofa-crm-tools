from typing import Optional, List, Dict
from datetime import datetime, date, time
from sqlmodel import Field, SQLModel, Relationship
from sqlalchemy import Column, Time
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship as sa_relationship
import uuid

# ==========================================
# 1. USER & ACCESS SYSTEM
# ==========================================

class UserCenterLink(SQLModel, table=True):
    """Join table linking Users to Centers."""
    user_id: Optional[int] = Field(default=None, foreign_key="user.id", primary_key=True)
    center_id: Optional[int] = Field(default=None, foreign_key="center.id", primary_key=True)


class BatchCoachLink(SQLModel, table=True):
    """Join table linking Coaches (Users) to Batches."""
    user_id: Optional[int] = Field(default=None, foreign_key="user.id", primary_key=True)
    batch_id: Optional[int] = Field(default=None, foreign_key="batch.id", primary_key=True)


class StudentBatchLink(SQLModel, table=True):
    """Join table linking Students to Batches for multi-batch assignment."""
    student_id: Optional[int] = Field(default=None, foreign_key="student.id", primary_key=True)
    batch_id: Optional[int] = Field(default=None, foreign_key="batch.id", primary_key=True)


class User(SQLModel, table=True):
    """User model with roles: team_lead, team_member, coach, observer"""
    id: Optional[int] = Field(default=None, primary_key=True)
    email: str = Field(unique=True, index=True)
    hashed_password: str
    full_name: str
    phone: Optional[str] = Field(default=None)  # Staff contact for parents (Center Head)
    role: str = Field(default="team_member")  # 'team_lead', 'team_member', 'coach', 'observer'
    is_active: bool = Field(default=True)
    
    # Relationships
    centers: List["Center"] = Relationship(back_populates="users", link_model=UserCenterLink)
    batches_coached: List["Batch"] = Relationship(back_populates="coaches", link_model=BatchCoachLink)
    comments: List["Comment"] = Relationship(back_populates="user")
    audit_logs: List["AuditLog"] = Relationship(back_populates="user")
    attendances_taken: List["Attendance"] = Relationship(back_populates="user")
    approval_requests_made: List["ApprovalRequest"] = Relationship(
        back_populates="requested_by",
        sa_relationship_kwargs={"foreign_keys": "[ApprovalRequest.requested_by_id]"}
    )
    notifications: List["Notification"] = Relationship(back_populates="user")


class Center(SQLModel, table=True):
    """Center/Location model"""
    id: Optional[int] = Field(default=None, primary_key=True)
    display_name: str
    meta_tag_name: str = Field(unique=True, index=True)
    city: str
    location: str
    map_link: Optional[str] = Field(default=None)  # Dedicated Google Maps URL for parent-facing pages
    group_email: Optional[str] = Field(default=None)  # Center Head / group email for internal notifications (fallback: SMTP_USER)

    # Relationships
    users: List[User] = Relationship(back_populates="centers", link_model=UserCenterLink)
    leads: List["Lead"] = Relationship(back_populates="center")
    batches: List["Batch"] = Relationship(back_populates="center")


# ==========================================
# 2. BATCH MANAGEMENT SYSTEM
# ==========================================

class Batch(SQLModel, table=True):
    """Batch model - represents a training group/session"""
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    center_id: int = Field(foreign_key="center.id")
    min_age: int = Field(default=0)  # Minimum age for this batch (inclusive)
    max_age: int = Field(default=99)  # Maximum age for this batch (inclusive)
    max_capacity: int = Field(default=20)
    
    # Seven-Boolean Schedule
    is_mon: bool = Field(default=False)
    is_tue: bool = Field(default=False)
    is_wed: bool = Field(default=False)
    is_thu: bool = Field(default=False)
    is_fri: bool = Field(default=False)
    is_sat: bool = Field(default=False)
    is_sun: bool = Field(default=False)
    
    # Time fields
    start_time: Optional[time] = Field(default=None, sa_column=Column(Time))
    end_time: Optional[time] = Field(default=None, sa_column=Column(Time))
    
    # Date field
    start_date: date  # Batch start date
    
    # Status field
    is_active: bool = Field(default=True)  # Whether the batch is currently active
    
    # Relationships
    center: Optional[Center] = Relationship(back_populates="batches")
    coaches: List[User] = Relationship(back_populates="batches_coached", link_model=BatchCoachLink)
    trial_leads: List["Lead"] = Relationship(
        back_populates="trial_batch",
        sa_relationship_kwargs={
            "primaryjoin": "Batch.id == Lead.trial_batch_id",
            "foreign_keys": "[Lead.trial_batch_id]"
        }
    )
    permanent_leads: List["Lead"] = Relationship(
        back_populates="permanent_batch",
        sa_relationship_kwargs={
            "primaryjoin": "Batch.id == Lead.permanent_batch_id",
            "foreign_keys": "[Lead.permanent_batch_id]"
        }
    )
    students: List["Student"] = Relationship(
        back_populates="batches",
        link_model=StudentBatchLink
    )
    attendances: List["Attendance"] = Relationship(back_populates="batch")


# ==========================================
# 3. ENHANCED LEAD SYSTEM
# ==========================================

class Lead(SQLModel, table=True):
    """Lead model - potential students/clients"""
    id: Optional[int] = Field(default=None, primary_key=True)
    created_time: datetime = Field(default_factory=datetime.utcnow)
    last_updated: Optional[datetime] = None  # Updated explicitly on changes, DB has default
    
    # Player Info
    player_name: str
    date_of_birth: Optional[date] = None  # Age derived from DOB in UI
    
    # Contact Info (Sensitive - Hidden from Coaches)
    phone: str
    email: Optional[str] = None
    address: Optional[str] = None
    
    # Status & Workflow
    status: str = Field(default="New") 
    next_followup_date: Optional[datetime] = None
    extra_data: Optional[Dict] = Field(default={}, sa_column=Column(JSONB))  # For Skill Reports and extensible data (renamed from metadata to avoid SQLAlchemy conflict)
    do_not_contact: bool = Field(default=False)  # Opt-out flag for Dead/Not Interested leads
    
    # Relationships & Batching
    center_id: Optional[int] = Field(default=None, foreign_key="center.id")
    center: Optional[Center] = Relationship(back_populates="leads")
    
    trial_batch_id: Optional[int] = Field(default=None, foreign_key="batch.id")
    trial_batch: Optional["Batch"] = Relationship(
        back_populates="trial_leads",
        sa_relationship_kwargs={
            "foreign_keys": "[Lead.trial_batch_id]"
        }
    )
    
    permanent_batch_id: Optional[int] = Field(default=None, foreign_key="batch.id")
    permanent_batch: Optional["Batch"] = Relationship(
        back_populates="permanent_leads",
        sa_relationship_kwargs={
            "foreign_keys": "[Lead.permanent_batch_id]"
        }
    )
    
    # Note: student_batches relationship moved to Student model
    
    # Public Preference System
    public_token: Optional[str] = Field(default=None, unique=True, index=True)  # UUID string for public access
    preferences_submitted: bool = Field(default=False)  # Submit-once: blocks form after first submission
    preferred_batch_id: Optional[int] = Field(default=None, foreign_key="batch.id")
    
    # Enrollment Link & Pending Subscription (automated enrollment pipeline)
    enrollment_link_sent_at: Optional[datetime] = None  # When enrollment link was sent
    link_expires_at: Optional[datetime] = None  # When enrollment link expires
    pending_subscription_data: Optional[Dict] = Field(default=None, sa_column=Column(JSONB))  # Parent's choices before verification (email, plan, start_date, utr, payment_proof_url, batch_id)
    preferred_call_time: Optional[str] = None  # e.g., 'Evenings after 6 PM'
    preferred_timing_notes: Optional[str] = None
    
    # Loss Analysis & No-Show Tracking
    loss_reason: Optional[str] = None  # Reason for losing the lead (use LOSS_REASONS from core)
    loss_reason_notes: Optional[str] = None  # Additional notes about the loss
    status_at_loss: Optional[str] = None  # Lifecycle stage when moved to Dead/Nurture (e.g. 'Called', 'Trial Attended')
    reschedule_count: int = Field(default=0)  # Count of times trial was rescheduled due to absence
    nudge_count: int = Field(default=0)  # Count of re-engagement nudges sent to Nurture leads
    needs_escalation: bool = Field(default=False)  # True when preference link not clicked within 48h (nudge failure)

    # Note: Subscription and payment fields moved to Student model
    
    call_confirmation_note: Optional[str] = None  # Note confirming call with parent
    
    comments: List["Comment"] = Relationship(back_populates="lead")
    audit_logs: List["AuditLog"] = Relationship(back_populates="lead")
    attendances: List["Attendance"] = Relationship(back_populates="lead")
    approval_requests: List["ApprovalRequest"] = Relationship(back_populates="lead")
    
    # Relationship to Student (one-to-one: a lead can become one student)
    student: Optional["Student"] = Relationship(back_populates="lead", sa_relationship_kwargs={"uselist": False})


# ==========================================
# 4. STUDENT SYSTEM (Active Members)
# ==========================================

class Student(SQLModel, table=True):
    """Student model - Active members who have graduated from Lead status"""
    id: Optional[int] = Field(default=None, primary_key=True)
    lead_id: int = Field(foreign_key="lead.id", unique=True)  # One-to-one with Lead
    center_id: int = Field(foreign_key="center.id")
    
    # Subscription & Membership
    subscription_plan: str  # 'Monthly', 'Quarterly', '6 Months', 'Yearly'
    subscription_start_date: date
    subscription_end_date: Optional[date] = None
    
    # Payment
    payment_proof_url: Optional[str] = None  # URL to uploaded payment proof image
    utr_number: Optional[str] = None  # Parent-reported UTR/reference number
    is_payment_verified: bool = Field(default=False)  # Admin-verified payment
    
    # Enrollment form (parent-reported)
    kit_size: Optional[str] = None
    medical_info: Optional[str] = None  # Text
    secondary_contact: Optional[str] = None
    
    # Renewal & Grace Period
    renewal_intent: bool = Field(default=False)  # Parent has indicated intent to renew
    in_grace_period: bool = Field(default=False)  # Subscription expired but within 4-day grace period
    grace_nudge_count: int = Field(default=0)  # Count of grace period nudges sent (0, 1, or 2)
    
    # Status
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    # Relationships
    lead: Optional["Lead"] = Relationship(back_populates="student")
    center: Optional["Center"] = Relationship()
    
    # Multi-batch assignment
    batches: List["Batch"] = Relationship(
        back_populates="students",
        link_model=StudentBatchLink
    )
    
    attendances: List["Attendance"] = Relationship(back_populates="student")


# ==========================================
# 5. COMMUNICATION & AUDIT
# ==========================================

class Comment(SQLModel, table=True):
    """Comment model for lead notes and communication"""
    id: Optional[int] = Field(default=None, primary_key=True)
    text: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    user_id: int = Field(foreign_key="user.id")
    user: Optional[User] = Relationship(back_populates="comments")
    lead_id: int = Field(foreign_key="lead.id")
    lead: Optional[Lead] = Relationship(back_populates="comments")
    mentioned_user_ids: Optional[List[int]] = Field(default=[], sa_column=Column(JSONB))  # JSON array of user IDs mentioned via @username


class AuditLog(SQLModel, table=True):
    """
    Audit log for tracking all changes to leads.
    Automatically created when a lead is updated.
    """
    id: Optional[int] = Field(default=None, primary_key=True)
    timestamp: datetime = Field(default_factory=datetime.utcnow, index=True)
    lead_id: int = Field(foreign_key="lead.id", index=True)
    user_id: Optional[int] = Field(default=None, foreign_key="user.id")
    action_type: str  # 'status_change', 'batch_update', 'field_update', 'duplicate_merge', 'comment_added'
    description: Optional[str] = None  # Human-readable description of the action
    old_value: Optional[str] = None  # Previous value (e.g., old status)
    new_value: Optional[str] = None  # New value (e.g., new status)
    
    lead: Optional[Lead] = Relationship(back_populates="audit_logs")
    user: Optional[User] = Relationship(back_populates="audit_logs")


# ==========================================
# 4b. NOTIFICATION SYSTEM
# ==========================================

class Notification(SQLModel, table=True):
    """In-app notifications for users (bell feed). center_id for role-based filtering; priority for high/low; target_url for deep-linking."""
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    type: str = Field(index=True)  # SALES_ALERT, OPS_ALERT, FINANCE_ALERT, GOVERNANCE_ALERT
    title: str = Field(max_length=255)
    message: str = Field(max_length=2000)
    link: Optional[str] = Field(default=None, max_length=500)
    target_url: Optional[str] = Field(default=None, max_length=500)  # App path for deep-linking e.g. /leads?search=...
    is_read: bool = Field(default=False)
    created_at: datetime = Field(default_factory=datetime.utcnow, index=True)
    center_id: Optional[int] = Field(default=None, foreign_key="center.id", index=True)
    priority: str = Field(default="low", index=True)  # "high" | "low"

    # Relationships
    user: Optional["User"] = Relationship(back_populates="notifications")


# ==========================================
# 5. UNIFIED APPROVAL REQUEST SYSTEM
# ==========================================

class ApprovalRequest(SQLModel, table=True):
    """Unified approval request - all Team Member requests in one place."""
    id: Optional[int] = Field(default=None, primary_key=True)
    lead_id: Optional[int] = Field(default=None, foreign_key="lead.id")
    student_id: Optional[int] = Field(default=None, foreign_key="student.id")
    requested_by_id: int = Field(foreign_key="user.id")
    request_type: str = Field(index=True)  # e.g. STATUS_REVERSAL, DEACTIVATE, CENTER_TRANSFER, AGE_GROUP, DATA_UPDATE
    current_value: str = Field(default="")
    requested_value: str = Field(default="")
    reason: str = Field(default="")
    status: str = Field(default="pending", index=True)  # pending, approved, rejected
    created_at: datetime = Field(default_factory=datetime.utcnow)
    resolved_at: Optional[datetime] = None
    resolved_by_id: Optional[int] = Field(default=None, foreign_key="user.id")

    # Relationships
    requested_by: Optional["User"] = Relationship(
        back_populates="approval_requests_made",
        sa_relationship_kwargs={"foreign_keys": "[ApprovalRequest.requested_by_id]"}
    )
    lead: Optional["Lead"] = Relationship(back_populates="approval_requests")


# ==========================================
# 6. ATTENDANCE SYSTEM
# ==========================================

class Attendance(SQLModel, table=True):
    """Attendance model for tracking player attendance in batches"""
    id: Optional[int] = Field(default=None, primary_key=True)
    lead_id: Optional[int] = Field(default=None, foreign_key="lead.id")  # Optional for backward compatibility
    student_id: Optional[int] = Field(default=None, foreign_key="student.id")  # Use this for active students
    batch_id: int = Field(foreign_key="batch.id")
    user_id: int = Field(foreign_key="user.id")  # Coach who took attendance
    date: date  # Will default in database, but we can also set it explicitly
    status: str  # 'Present', 'Absent', 'Excused', 'Late'
    remarks: Optional[str] = None
    recorded_at: datetime = Field(default_factory=datetime.utcnow)
    
    # Relationships
    lead: Optional[Lead] = Relationship(back_populates="attendances")
    student: Optional["Student"] = Relationship(back_populates="attendances")
    batch: Optional[Batch] = Relationship(back_populates="attendances")
    user: Optional[User] = Relationship(back_populates="attendances_taken")


# ==========================================
# 7. SKILL EVALUATION SYSTEM
# ==========================================

class SkillEvaluation(SQLModel, table=True):
    """Skill evaluation model for tracking player skill assessments over time"""
    id: Optional[int] = Field(default=None, primary_key=True)
    lead_id: int = Field(foreign_key="lead.id")
    coach_id: int = Field(foreign_key="user.id")  # Coach who created the evaluation
    technical_score: int = Field(ge=1, le=5)  # 1-5 scale
    fitness_score: int = Field(ge=1, le=5)  # 1-5 scale
    teamwork_score: int = Field(ge=1, le=5)  # 1-5 scale
    discipline_score: int = Field(ge=1, le=5)  # 1-5 scale
    coach_notes: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    # Relationships
    lead: Optional[Lead] = Relationship()
    coach: Optional[User] = Relationship()


# ==========================================
# 6. LEAD STAGING SYSTEM
# ==========================================

class LeadStaging(SQLModel, table=True):
    """Staging area for leads captured by coaches before promotion to full Lead records"""
    id: Optional[int] = Field(default=None, primary_key=True)
    player_name: str
    phone: str
    email: Optional[str] = None
    age: Optional[int] = None  # Numeric age (captured by coach)
    date_of_birth: Optional[date] = None  # Optional; set when center head captures or on promote
    center_id: int = Field(foreign_key="center.id")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    created_by_id: Optional[int] = Field(default=None, foreign_key="user.id")
    
    # Relationships
    center: Optional[Center] = Relationship()
    created_by: Optional[User] = Relationship()
