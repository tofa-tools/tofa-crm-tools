"""
Pydantic schemas for Attendance operations.
"""
from pydantic import BaseModel, model_validator
from typing import Optional
from datetime import date, datetime


class AttendanceCreate(BaseModel):
    """Schema for creating/recording attendance.
    Provide either lead_id (trial students) or student_id (active students).
    """
    lead_id: Optional[int] = None
    student_id: Optional[int] = None
    batch_id: int
    date: Optional[date] = None  # Defaults to today if not provided
    status: str  # 'Present', 'Absent', 'Excused', 'Late'
    remarks: Optional[str] = None
    internal_note: Optional[str] = None  # Coach's internal feedback (for Present marks)

    @model_validator(mode="after")
    def require_lead_or_student(self):
        if not self.lead_id and not self.student_id:
            raise ValueError("Either lead_id or student_id is required")
        if self.lead_id and self.student_id:
            raise ValueError("Provide only one of lead_id or student_id")
        return self


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

