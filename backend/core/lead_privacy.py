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
    lead_dict = {
        "id": lead.id,
        "created_time": lead.created_time.isoformat() if lead.created_time else None,
        "last_updated": lead.last_updated.isoformat() if lead.last_updated else None,
        "player_name": lead.player_name,
        "player_age_category": lead.player_age_category,
        "date_of_birth": lead.date_of_birth.isoformat() if lead.date_of_birth else None,
        "phone": None,  # Masked
        "email": None,  # Masked
        "address": None,  # Masked
        "status": lead.status,
        "next_followup_date": lead.next_followup_date.isoformat() if lead.next_followup_date else None,
        "score": lead.score,
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
    }
    return lead_dict


def serialize_leads_for_user(leads: List[Lead], user_role: str) -> List[Dict[str, Any]]:
    """
    Serialize a list of leads, masking sensitive fields for coaches.
    
    Args:
        leads: List of Lead models
        user_role: User role ('team_lead', 'regular_user', 'coach')
        
    Returns:
        List of dictionaries suitable for JSON serialization
    """
    if user_role == "coach":
        return [mask_lead_for_coach(lead) for lead in leads]
    else:
        # For team_lead and regular_user, return full data
        return [
            {
                "id": lead.id,
                "created_time": lead.created_time.isoformat() if lead.created_time else None,
                "last_updated": lead.last_updated.isoformat() if lead.last_updated else None,
                "player_name": lead.player_name,
                "player_age_category": lead.player_age_category,
                "date_of_birth": lead.date_of_birth.isoformat() if lead.date_of_birth else None,
                "phone": lead.phone,
                "email": lead.email,
                "address": lead.address,
                "status": lead.status,
                "next_followup_date": lead.next_followup_date.isoformat() if lead.next_followup_date else None,
                "score": lead.score,
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
            }
            for lead in leads
        ]

