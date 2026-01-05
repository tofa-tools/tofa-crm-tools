"""
User-related Pydantic schemas.
"""
from pydantic import BaseModel
from typing import List, Optional


class UserCreateSchema(BaseModel):
    """Schema for creating a new user."""
    email: str
    password: str
    full_name: str
    role: str = "regular_user"  # 'team_lead', 'regular_user', 'coach'
    center_ids: List[int] = []
    is_active: bool = True


class UserReadSchema(BaseModel):
    """Schema for reading user data."""
    id: int
    email: str
    full_name: str
    role: str
    is_active: bool
    
    class Config:
        from_attributes = True  # For Pydantic v2, or orm_mode = True for v1

