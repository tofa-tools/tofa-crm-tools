"""
Pydantic schemas for Student operations.
"""
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, date


class StudentRead(BaseModel):
    """Schema for reading student data."""
    id: int
    lead_id: int
    center_id: int
    subscription_plan: str
    subscription_start_date: date
    subscription_end_date: Optional[date] = None
    payment_proof_url: Optional[str] = None
    utr_number: Optional[str] = None
    is_payment_verified: bool = False
    kit_size: Optional[str] = None
    medical_info: Optional[str] = None
    secondary_contact: Optional[str] = None
    renewal_intent: bool = False
    in_grace_period: bool = False
    grace_nudge_count: int = 0
    is_active: bool
    created_at: datetime
    # Include lead information
    lead_player_name: Optional[str] = None  # Will be populated from relationship
    lead_phone: Optional[str] = None  # Phone from lead
    lead_email: Optional[str] = None  # Email from lead
    lead_address: Optional[str] = None  # Address from lead
    lead_player_age: Optional[int] = None  # Age from lead's DOB
    lead_date_of_birth: Optional[date] = None  # DOB from lead (for missing-DOB flag)
    lead_status: Optional[str] = None  # Status from lead
    student_batch_ids: Optional[List[int]] = None  # Batch IDs from relationship
    
    class Config:
        from_attributes = True
        
    @staticmethod
    def from_student(obj):
        """Create StudentRead from Student model with relationships."""
        # Get batch IDs
        batch_ids = []
        if hasattr(obj, 'batches') and obj.batches:
            batch_ids = [b.id for b in obj.batches]
        
        # Get lead information
        player_name = None
        phone = None
        email = None
        address = None
        lead_age = None
        lead_dob = None
        status = None
        if hasattr(obj, 'lead') and obj.lead:
            lead = obj.lead
            player_name = lead.player_name
            phone = lead.phone
            email = lead.email
            address = lead.address
            lead_dob = getattr(lead, 'date_of_birth', None)
            if lead_dob:
                from backend.core.age_utils import calculate_age
                lead_age = calculate_age(lead_dob)
            status = lead.status
        
        return StudentRead(
            id=obj.id,
            lead_id=obj.lead_id,
            center_id=obj.center_id,
            subscription_plan=obj.subscription_plan,
            subscription_start_date=obj.subscription_start_date,
            subscription_end_date=obj.subscription_end_date,
            payment_proof_url=obj.payment_proof_url,
            utr_number=getattr(obj, 'utr_number', None),
            is_payment_verified=getattr(obj, 'is_payment_verified', False),
            kit_size=getattr(obj, 'kit_size', None),
            medical_info=getattr(obj, 'medical_info', None),
            secondary_contact=getattr(obj, 'secondary_contact', None),
            renewal_intent=obj.renewal_intent if hasattr(obj, 'renewal_intent') else False,
            in_grace_period=obj.in_grace_period if hasattr(obj, 'in_grace_period') else False,
            grace_nudge_count=obj.grace_nudge_count if hasattr(obj, 'grace_nudge_count') else 0,
            is_active=obj.is_active,
            created_at=obj.created_at,
            lead_player_name=player_name,
            lead_phone=phone,
            lead_email=email,
            lead_address=address,
            lead_player_age=lead_age,
            lead_date_of_birth=lead_dob,
            lead_status=status,
            student_batch_ids=batch_ids
        )


class StudentCreate(BaseModel):
    """Schema for creating a student (used internally)."""
    lead_id: int
    center_id: int
    subscription_plan: str
    subscription_start_date: date
    subscription_end_date: Optional[date] = None
    payment_proof_url: Optional[str] = None
    student_batch_ids: Optional[List[int]] = None

