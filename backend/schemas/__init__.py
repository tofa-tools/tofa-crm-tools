"""
Pydantic schemas for request/response validation.
"""
from .users import UserCreateSchema, UserUpdateSchema, UserReadSchema
from .batches import BatchCreate, BatchRead, BatchUpdate
from .attendance import AttendanceCreate, AttendanceRead, AttendanceUpdate
from .leads import LeadCreate, LeadUpdate, LeadRead, LeadReadCoach
from .bulk import BulkUpdateStatusRequest, BulkAssignCenterRequest

__all__ = [
    # Users
    "UserCreateSchema",
    "UserUpdateSchema",
    "UserReadSchema",
    # Batches
    "BatchCreate",
    "BatchRead",
    "BatchUpdate",
    # Attendance
    "AttendanceCreate",
    "AttendanceRead",
    "AttendanceUpdate",
    # Leads
    "LeadCreate",
    "LeadUpdate",
    "LeadRead",
    "LeadReadCoach",
    # Bulk operations
    "BulkUpdateStatusRequest",
    "BulkAssignCenterRequest",
]

