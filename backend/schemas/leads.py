"""
Pydantic schemas for Lead operations.
"""
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime, date


class LeadCreate(BaseModel):
    """Schema for creating a new lead."""
    player_name: str
    player_age_category: str
    phone: str
    email: Optional[str] = None
    address: Optional[str] = None
    date_of_birth: Optional[date] = None
    center_id: int
    status: str = "New"
    trial_batch_id: Optional[int] = None
    permanent_batch_id: Optional[int] = None


class LeadUpdate(BaseModel):
    """Schema for updating a lead."""
    status: Optional[str] = None
    next_followup_date: Optional[datetime] = None
    comment: Optional[str] = None  # For adding comments
    age_category: Optional[str] = None
    date_of_birth: Optional[date] = None
    trial_batch_id: Optional[int] = None
    permanent_batch_id: Optional[int] = None
    subscription_plan: Optional[str] = None
    subscription_start_date: Optional[date] = None
    subscription_end_date: Optional[date] = None


class LeadRead(BaseModel):
    """Schema for reading lead data (full access - team leads, regular users)."""
    id: int
    created_time: datetime
    last_updated: Optional[datetime] = None
    player_name: str
    player_age_category: str
    date_of_birth: Optional[date] = None
    phone: str
    email: Optional[str] = None
    address: Optional[str] = None
    status: str
    next_followup_date: Optional[datetime] = None
    score: int
    extra_data: Optional[Dict[str, Any]] = None
    center_id: Optional[int] = None
    trial_batch_id: Optional[int] = None
    permanent_batch_id: Optional[int] = None
    subscription_plan: Optional[str] = None
    subscription_start_date: Optional[date] = None
    subscription_end_date: Optional[date] = None
    
    class Config:
        from_attributes = True  # For Pydantic v2, or orm_mode = True for v1


class LeadReadCoach(BaseModel):
    """
    Schema for reading lead data for coaches (privacy-protected).
    Excludes sensitive contact information (phone, email).
    """
    id: int
    created_time: datetime
    last_updated: Optional[datetime] = None
    player_name: str
    player_age_category: str
    date_of_birth: Optional[date] = None
    address: Optional[str] = None  # Address may be less sensitive, keep for now
    status: str
    next_followup_date: Optional[datetime] = None
    score: int
    extra_data: Optional[Dict[str, Any]] = None
    center_id: Optional[int] = None
    trial_batch_id: Optional[int] = None
    permanent_batch_id: Optional[int] = None
    subscription_plan: Optional[str] = None
    subscription_start_date: Optional[date] = None
    subscription_end_date: Optional[date] = None
    # phone and email are intentionally excluded
    
    class Config:
        from_attributes = True  # For Pydantic v2, or orm_mode = True for v1


class LeadPreferencesRead(BaseModel):
    """Schema for public lead preferences read (no auth required)."""
    player_name: str
    center_name: str
    player_age_category: Optional[str] = None  # Lead's age category
    batches: List[Dict[str, Any]]  # List of batches filtered by age (for permanent batch selection)
    demo_batches: Optional[List[Dict[str, Any]]] = None  # List of demo batches (with nearest age fallback)
    preferred_batch_id: Optional[int] = None
    preferred_demo_batch_id: Optional[int] = None  # Demo/trial batch preference
    preferred_call_time: Optional[str] = None
    preferred_timing_notes: Optional[str] = None
    status: Optional[str] = None
    reschedule_count: Optional[int] = None
    
    class Config:
        from_attributes = True


class LeadPreferencesUpdate(BaseModel):
    """Schema for updating lead preferences."""
    preferred_batch_id: Optional[int] = None
    preferred_demo_batch_id: Optional[int] = None  # Demo/trial batch preference
    preferred_call_time: Optional[str] = None
    preferred_timing_notes: Optional[str] = None
    loss_reason: Optional[str] = None
    loss_reason_notes: Optional[str] = None

