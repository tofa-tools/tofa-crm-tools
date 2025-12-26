"""
User-related Pydantic schemas.
"""
from pydantic import BaseModel
from typing import List


class UserCreateSchema(BaseModel):
    """Schema for creating a new user."""
    email: str
    password: str
    full_name: str
    role: str
    center_ids: List[int]

