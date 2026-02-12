"""
Pydantic schemas for Lead operations.
"""
from pydantic import BaseModel, field_validator, model_validator
from typing import Optional, List, Dict, Any
from datetime import datetime, date


class LeadCreate(BaseModel):
    """Schema for creating a new lead."""
    player_name: str
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
    date_of_birth: Optional[date] = None
    trial_batch_id: Optional[int] = None
    permanent_batch_id: Optional[int] = None
    subscription_plan: Optional[str] = None
    subscription_start_date: Optional[date] = None
    subscription_end_date: Optional[date] = None
    payment_proof_url: Optional[str] = None  # URL to payment proof image
    call_confirmation_note: Optional[str] = None  # Note confirming call with parent


class LeadRead(BaseModel):
    """Schema for reading lead data (full access - team leads, regular users)."""
    id: int
    created_time: datetime
    last_updated: Optional[datetime] = None
    player_name: str
    date_of_birth: Optional[date] = None
    phone: str
    email: Optional[str] = None
    address: Optional[str] = None
    status: str
    next_followup_date: Optional[datetime] = None
    extra_data: Optional[Dict[str, Any]] = None
    center_id: Optional[int] = None
    trial_batch_id: Optional[int] = None
    permanent_batch_id: Optional[int] = None
    subscription_plan: Optional[str] = None
    subscription_start_date: Optional[date] = None
    subscription_end_date: Optional[date] = None
    payment_proof_url: Optional[str] = None
    call_confirmation_note: Optional[str] = None
    student_batch_ids: Optional[List[int]] = None  # IDs of batches assigned via StudentBatchLink
    
    @model_validator(mode='before')
    @classmethod
    def extract_student_batch_ids(cls, data):
        """Extract student_batch_ids from student_batches relationship."""
        # Handle SQLModel instance
        if hasattr(data, 'student_batches'):
            batches = getattr(data, 'student_batches', None)
            if batches:
                # Relationship is loaded
                student_batch_ids = [batch.id for batch in batches]
                # Convert to dict-like structure for Pydantic
                if hasattr(data, '__dict__'):
                    data_dict = {k: v for k, v in data.__dict__.items() if not k.startswith('_')}
                    data_dict['student_batch_ids'] = student_batch_ids
                    return data_dict
                elif hasattr(data, 'model_dump'):
                    data_dict = data.model_dump()
                    data_dict['student_batch_ids'] = student_batch_ids
                    return data_dict
        # Handle dict
        elif isinstance(data, dict):
            if 'student_batches' in data and 'student_batch_ids' not in data:
                batches = data.get('student_batch_ids', [])
                if batches:
                    data['student_batch_ids'] = [b.id if hasattr(b, 'id') else b for b in batches]
                else:
                    data['student_batch_ids'] = []
            elif 'student_batch_ids' not in data:
                data['student_batch_ids'] = []
        return data
    
    class Config:
        from_attributes = True  # For Pydantic v2


class LeadReadCoach(BaseModel):
    """
    Schema for reading lead data for coaches (privacy-protected).
    Excludes sensitive contact information (phone, email).
    """
    id: int
    created_time: datetime
    last_updated: Optional[datetime] = None
    player_name: str
    date_of_birth: Optional[date] = None
    address: Optional[str] = None  # Address may be less sensitive, keep for now
    status: str
    next_followup_date: Optional[datetime] = None
    extra_data: Optional[Dict[str, Any]] = None
    center_id: Optional[int] = None
    trial_batch_id: Optional[int] = None
    permanent_batch_id: Optional[int] = None
    subscription_plan: Optional[str] = None
    subscription_start_date: Optional[date] = None
    subscription_end_date: Optional[date] = None
    payment_proof_url: Optional[str] = None
    call_confirmation_note: Optional[str] = None
    # phone and email are intentionally excluded
    
    class Config:
        from_attributes = True  # For Pydantic v2, or orm_mode = True for v1


class LeadPreferencesRead(BaseModel):
    """Schema for public lead preferences read (no auth required). Never exposes lead phone, email, or address."""
    player_name: str
    center_name: str
    preferences_submitted: bool = False  # Submit-once: when True, show Thank You instead of form
    link_expired: bool = False  # Time-based: True if lead >7 days old and preferences not submitted
    location_link: Optional[str] = None  # Google Maps URL for center
    center_head: Optional[Dict[str, Any]] = None  # { name, phone } of primary team member
    player_age: Optional[int] = None  # Lead's age (derived from DOB)
    batches: List[Dict[str, Any]]  # All active batches at center (no age filter; age is label-only)
    demo_batches: Optional[List[Dict[str, Any]]] = None  # Same; for trial/demo selection
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

