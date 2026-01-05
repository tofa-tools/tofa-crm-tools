"""
Pydantic schemas for bulk operations.
"""
from pydantic import BaseModel
from typing import List


class BulkUpdateStatusRequest(BaseModel):
    lead_ids: List[int]
    new_status: str


class BulkAssignCenterRequest(BaseModel):
    lead_ids: List[int]
    center_id: int

