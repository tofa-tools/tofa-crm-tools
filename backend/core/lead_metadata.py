"""
Functions for managing lead metadata (skill reports, etc.)
"""
from sqlmodel import Session
from backend.models import Lead
from typing import Dict, Optional


def update_lead_metadata(
    db: Session,
    lead_id: int,
    metadata_updates: Dict,
    user_id: Optional[int] = None
) -> Lead:
    """
    Update a lead's extra_data field (renamed from metadata to avoid SQLAlchemy conflict).
    Merges new updates with existing extra_data.
    
    Args:
        db: Database session
        lead_id: ID of the lead to update
        metadata_updates: Dictionary of data to merge into existing extra_data
        user_id: Optional user ID for audit log
        
    Returns:
        Updated Lead object
        
    Raises:
        ValueError: If lead not found
    """
    lead = db.get(Lead, lead_id)
    if not lead:
        raise ValueError(f"Lead {lead_id} not found")
    
    # Merge extra_data (existing data + new updates)
    current_data = lead.extra_data or {}
    
    # Special handling for skill_reports: append to array instead of replacing
    if 'skill_reports' in metadata_updates:
        if isinstance(metadata_updates['skill_reports'], list):
            existing_reports = current_data.get('skill_reports', [])
            # Append new reports to existing ones
            updated_data = {
                **current_data,
                **{k: v for k, v in metadata_updates.items() if k != 'skill_reports'},
                'skill_reports': existing_reports + metadata_updates['skill_reports']
            }
        else:
            # If skill_reports is not a list, just replace it
            updated_data = {**current_data, **metadata_updates}
    else:
        # Regular merge for other fields
        updated_data = {**current_data, **metadata_updates}
    
    lead.extra_data = updated_data
    
    db.add(lead)
    db.commit()
    db.refresh(lead)
    
    return lead


def get_skill_report(lead: Lead) -> Optional[Dict]:
    """
    Get the most recent skill report from a lead's extra_data.
    
    Args:
        lead: Lead object
        
    Returns:
        Dictionary with skill report data, or None if no report exists
    """
    if not lead.extra_data:
        return None
    
    # Skill reports are stored in extra_data under 'skill_reports' key
    # The most recent one is the last in the list
    skill_reports = lead.extra_data.get('skill_reports', [])
    if not skill_reports:
        return None
    
    # Return the most recent report (last one in the list)
    return skill_reports[-1] if skill_reports else None

