"""
Pydantic schemas for Attendance operations.
"""
from pydantic import BaseModel
from typing import Optional
from datetime import date, datetime


class AttendanceCreate(BaseModel):
    """Schema for creating/recording attendance."""
    lead_id: int
    batch_id: int
    date: date
    status: str  # 'Present', 'Absent', 'Excused', 'Late'
    remarks: Optional[str] = None
    internal_note: Optional[str] = None  # Coach's internal feedback (for Present marks)


class AttendanceRead(BaseModel):
    """Schema for reading attendance data."""
    id: int
    lead_id: int
    batch_id: int
    user_id: int  # Coach who took attendance
    date: date
    status: str
    remarks: Optional[str] = None
    recorded_at: datetime
    
    class Config:
        from_attributes = True  # For Pydantic v2, or orm_mode = True for v1


class AttendanceUpdate(BaseModel):
    """Schema for updating attendance."""
    status: Optional[str] = None
    remarks: Optional[str] = None

