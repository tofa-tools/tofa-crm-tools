"""
Pydantic schemas for Batch operations.
"""
from pydantic import BaseModel
from typing import Optional
from datetime import time, date


class BatchCreate(BaseModel):
    """Schema for creating a new batch."""
    name: str
    center_id: int
    age_category: str  # e.g., 'U9', 'U11'
    max_capacity: int = 20
    
    # Seven-Boolean Schedule
    is_mon: bool = False
    is_tue: bool = False
    is_wed: bool = False
    is_thu: bool = False
    is_fri: bool = False
    is_sat: bool = False
    is_sun: bool = False
    
    # Time fields
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    
    # Date field
    start_date: date  # Batch start date
    
    # Status field
    is_active: bool = True  # Whether the batch is currently active


class BatchRead(BaseModel):
    """Schema for reading batch data."""
    id: int
    name: str
    center_id: int
    age_category: str
    max_capacity: int
    
    # Seven-Boolean Schedule
    is_mon: bool
    is_tue: bool
    is_wed: bool
    is_thu: bool
    is_fri: bool
    is_sat: bool
    is_sun: bool
    
    # Time fields
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    
    # Date field
    start_date: date
    
    # Status field
    is_active: bool
    
    class Config:
        from_attributes = True  # For Pydantic v2, or orm_mode = True for v1


class BatchUpdate(BaseModel):
    """Schema for updating a batch."""
    name: Optional[str] = None
    center_id: Optional[int] = None
    age_category: Optional[str] = None
    max_capacity: Optional[int] = None
    
    # Seven-Boolean Schedule
    is_mon: Optional[bool] = None
    is_tue: Optional[bool] = None
    is_wed: Optional[bool] = None
    is_thu: Optional[bool] = None
    is_fri: Optional[bool] = None
    is_sat: Optional[bool] = None
    is_sun: Optional[bool] = None
    
    # Time fields
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    
    # Date field
    start_date: Optional[date] = None
    
    # Status field
    is_active: Optional[bool] = None

