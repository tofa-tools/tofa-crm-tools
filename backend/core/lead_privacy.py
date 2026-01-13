"""
Privacy and field masking utilities for leads.
"""
from typing import Dict, Any, Optional, List
from backend.models import Lead


def mask_lead_for_coach(lead: Lead) -> Dict[str, Any]:
    """
    Convert a Lead model to a dictionary with sensitive fields masked for coaches.
    Returns a dict suitable for JSON serialization with phone, email, and address hidden.
    """
    from datetime import datetime, timezone
    from typing import Optional
    
    def format_datetime(dt: Optional[datetime]) -> Optional[str]:
        """Format datetime to ISO string with timezone if needed."""
        if dt is None:
            return None
        # If datetime is naive (no timezone), assume it's UTC and make it timezone-aware
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        # Return ISO format with 'Z' suffix for UTC (more compatible with Zod)
        iso_str = dt.isoformat()
        # Ensure it ends with 'Z' if it's UTC (Zod prefers this format)
        if dt.tzinfo == timezone.utc and not iso_str.endswith('Z'):
            # Replace +00:00 with Z for better Zod compatibility
            iso_str = iso_str.replace('+00:00', 'Z')
        return iso_str
    
    lead_dict = {
        "id": lead.id,
        "created_time": format_datetime(lead.created_time),
        "last_updated": format_datetime(lead.last_updated),
        "player_name": lead.player_name,
        "player_age_category": lead.player_age_category,
        "date_of_birth": lead.date_of_birth.isoformat() if lead.date_of_birth else None,
        "phone": None,  # Masked
        "email": None,  # Masked
        "address": None,  # Masked
        "status": lead.status,
        "next_followup_date": format_datetime(lead.next_followup_date),
        "extra_data": lead.extra_data or {},
        "center_id": lead.center_id,
        "trial_batch_id": lead.trial_batch_id,
        "permanent_batch_id": lead.permanent_batch_id,
        "public_token": lead.public_token,
        "preferred_batch_id": lead.preferred_batch_id,
        "preferred_call_time": lead.preferred_call_time,
        "preferred_timing_notes": lead.preferred_timing_notes,
        "loss_reason": lead.loss_reason,
        "loss_reason_notes": lead.loss_reason_notes,
        "reschedule_count": lead.reschedule_count if hasattr(lead, 'reschedule_count') else 0,
        "do_not_contact": lead.do_not_contact,
        "student_batch_ids": [],  # Empty list for leads (batches are on Student model)
    }
    return lead_dict


def serialize_leads_for_user(leads: List[Lead], user_role: str) -> List[Dict[str, Any]]:
    """
    Serialize a list of leads, masking sensitive fields for coaches.
    
    Args:
        leads: List of Lead models
        user_role: User role ('team_lead', 'team_member', 'coach', 'observer')
        
    Returns:
        List of dictionaries suitable for JSON serialization
    """
    from datetime import datetime, timezone
    
    def format_datetime(dt: Optional[datetime]) -> Optional[str]:
        """Format datetime to ISO string with timezone if needed."""
        if dt is None:
            return None
        # If datetime is naive (no timezone), assume it's UTC and make it timezone-aware
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        # Return ISO format with 'Z' suffix for UTC (more compatible with Zod)
        iso_str = dt.isoformat()
        # Ensure it ends with 'Z' if it's UTC (Zod prefers this format)
        if dt.tzinfo == timezone.utc and not iso_str.endswith('Z'):
            # Replace +00:00 with Z for better Zod compatibility
            iso_str = iso_str.replace('+00:00', 'Z')
        return iso_str
    
    if user_role == "coach":
        return [mask_lead_for_coach(lead) for lead in leads]
    else:
        # For team_lead and team_member, return full data
        return [
            {
                "id": lead.id,
                "created_time": format_datetime(lead.created_time),
                "last_updated": format_datetime(lead.last_updated),
                "player_name": lead.player_name,
                "player_age_category": lead.player_age_category,
                "date_of_birth": lead.date_of_birth.isoformat() if lead.date_of_birth else None,
                "phone": lead.phone,
                "email": lead.email,
                "address": lead.address,
                "status": lead.status,
                "next_followup_date": format_datetime(lead.next_followup_date),
                "extra_data": lead.extra_data or {},
                "center_id": lead.center_id,
                "trial_batch_id": lead.trial_batch_id,
                "permanent_batch_id": lead.permanent_batch_id,
                "public_token": lead.public_token,
                "preferred_batch_id": lead.preferred_batch_id,
                "preferred_call_time": lead.preferred_call_time,
                "preferred_timing_notes": lead.preferred_timing_notes,
                "loss_reason": lead.loss_reason,
                "loss_reason_notes": lead.loss_reason_notes,
                "reschedule_count": lead.reschedule_count if hasattr(lead, 'reschedule_count') else 0,
                "do_not_contact": lead.do_not_contact,
                "student_batch_ids": [],  # Empty list for leads (batches are on Student model)
            }
            for lead in leads
        ]


def mask_student_for_coach(student_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Mask sensitive fields in a student data dictionary for coaches.
    
    Args:
        student_data: Dictionary containing student data (typically from StudentRead model)
        
    Returns:
        Dictionary with lead_phone, lead_email, and lead_address set to None
    """
    masked_data = student_data.copy()
    masked_data["lead_phone"] = None
    masked_data["lead_email"] = None
    masked_data["lead_address"] = None
    return masked_data

