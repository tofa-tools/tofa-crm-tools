"""
Bulk operations for leads.
Framework-agnostic bulk update utilities.
"""
from sqlmodel import Session, select
from typing import List, Optional
from datetime import datetime
from backend.models import Lead, User
from backend.core.audit import log_status_change, log_field_update


def bulk_update_lead_status(
    db: Session,
    lead_ids: List[int],
    new_status: str,
    user_id: int
) -> dict:
    """
    Bulk update status for multiple leads.
    
    Args:
        db: Database session
        lead_ids: List of lead IDs to update
        new_status: New status to set
        user_id: User ID performing the update
        
    Returns:
        Dictionary with count of updated leads and any errors
    """
    updated_count = 0
    errors = []
    
    for lead_id in lead_ids:
        try:
            lead = db.get(Lead, lead_id)
            if not lead:
                errors.append(f"Lead {lead_id} not found")
                continue
            
            old_status = lead.status
            if old_status != new_status:
                lead.status = new_status
                lead.last_updated = datetime.utcnow()
                db.add(lead)
                
                # Log the change
                log_status_change(db, lead_id, user_id, old_status, new_status)
                updated_count += 1
        except Exception as e:
            errors.append(f"Error updating lead {lead_id}: {str(e)}")
    
    if updated_count > 0:
        db.commit()
    
    return {
        "updated_count": updated_count,
        "errors": errors
    }


def bulk_update_lead_assignment(
    db: Session,
    lead_ids: List[int],
    new_center_id: int,
    user_id: int
) -> dict:
    """
    Bulk update center assignment for multiple leads.
    Only team leads can perform this operation.
    
    Args:
        db: Database session
        lead_ids: List of lead IDs to update
        new_center_id: New center ID to assign
        user_id: User ID performing the update (must be team_lead)
        
    Returns:
        Dictionary with count of updated leads and any errors
    """
    from backend.models import Center
    
    # Verify center exists
    center = db.get(Center, new_center_id)
    if not center:
        return {
            "updated_count": 0,
            "errors": [f"Center {new_center_id} not found"]
        }
    
    updated_count = 0
    errors = []
    
    for lead_id in lead_ids:
        try:
            lead = db.get(Lead, lead_id)
            if not lead:
                errors.append(f"Lead {lead_id} not found")
                continue
            
            old_center_id = lead.center_id
            if old_center_id != new_center_id:
                lead.center_id = new_center_id
                lead.last_updated = datetime.utcnow()
                db.add(lead)
                
                # Log the change
                log_field_update(
                    db, lead_id, user_id,
                    'center_id',
                    str(old_center_id) if old_center_id else None,
                    str(new_center_id)
                )
                updated_count += 1
        except Exception as e:
            errors.append(f"Error updating lead {lead_id}: {str(e)}")
    
    if updated_count > 0:
        db.commit()
    
    return {
        "updated_count": updated_count,
        "errors": errors
    }


def verify_leads_accessible(
    db: Session,
    lead_ids: List[int],
    user: User
) -> List[int]:
    """
    Verify that the user has access to all requested leads.
    Returns list of accessible lead IDs.
    
    Args:
        db: Database session
        lead_ids: List of lead IDs to check
        user: User object
        
    Returns:
        List of lead IDs that user has access to
    """
    if user.role == "team_lead":
        # Team leads can access all leads
        return lead_ids
    
    # Other users can only access leads from their assigned centers
    user_center_ids = [c.id for c in user.centers]
    if not user_center_ids:
        return []
    
    accessible_leads = db.exec(
        select(Lead).where(
            Lead.id.in_(lead_ids),
            Lead.center_id.in_(user_center_ids)
        )
    ).all()
    
    return [lead.id for lead in accessible_leads]

