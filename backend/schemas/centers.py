"""
Pydantic schemas for Center operations.
"""
from pydantic import BaseModel
from typing import Optional


class CenterCreate(BaseModel):
    """Schema for creating a center."""
    display_name: str
    meta_tag_name: str
    city: str
    location: str = ""
    map_link: Optional[str] = None
    group_email: Optional[str] = None


class CenterUpdate(BaseModel):
    """Schema for updating a center (all fields optional)."""
    display_name: Optional[str] = None
    meta_tag_name: Optional[str] = None
    city: Optional[str] = None
    location: Optional[str] = None
    map_link: Optional[str] = None
    group_email: Optional[str] = None
