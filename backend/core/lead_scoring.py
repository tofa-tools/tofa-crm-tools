"""
Lead scoring logic to prioritize leads based on quality indicators.
"""
from sqlmodel import Session, select, func
from typing import Optional
from backend.models import Lead, Center, AuditLog


def calculate_lead_score(db: Session, lead: Lead) -> int:
    """
    Calculate a lead quality score (0-5) based on various factors.
    
    Scoring rules:
    +1 point if email is present and valid
    +1 point if phone is valid (length >= 10)
    +1 point if 'Age Category' is filled and not "Unknown"
    +2 points if the lead source is from a high-converting 'Meta Tag' (if center has high conversion rate)
    -1 point if the lead has been 'Called' 3+ times with no status change
    
    Args:
        db: Database session
        lead: Lead object to score
        
    Returns:
        Integer score between 0 and 5
    """
    score = 0
    
    # +1 if email is present and valid (contains @)
    if lead.email and '@' in lead.email:
        score += 1
    
    # +1 if phone is valid (length >= 10)
    if lead.phone and len(str(lead.phone).strip()) >= 10:
        score += 1
    
    # +1 if age category is filled and not "Unknown"
    if lead.player_age_category and lead.player_age_category.strip().lower() != "unknown":
        score += 1
    
    # +2 points if from high-converting center (simplified: check if center exists and has high activity)
    # For now, we'll give +2 if center exists (can be enhanced later with conversion rate data)
    if lead.center_id:
        center = db.get(Center, lead.center_id)
        if center:
            # Simple heuristic: if center has many leads, it's likely high-converting
            # This can be enhanced with actual conversion rate data later
            center_lead_count = db.exec(
                select(func.count(Lead.id)).where(Lead.center_id == center.id)
            ).one()
            if center_lead_count > 50:  # High-activity center threshold
                score += 2
    
    # -1 point if called 3+ times with no status change
    # Count audit logs with status_change to "Called"
    called_count = db.exec(
        select(func.count()).select_from(AuditLog).where(
            AuditLog.lead_id == lead.id,
            AuditLog.action_type == "status_change",
            AuditLog.new_value == "Called"
        )
    ).one()
    
    # If status is still "Called" or "New" and has been called 3+ times, deduct point
    if called_count >= 3 and lead.status in ["New", "Called"]:
        score -= 1
    
    # Ensure score is between 0 and 5
    return max(0, min(5, score))


def update_lead_score(db: Session, lead: Lead) -> Lead:
    """
    Calculate and update the lead's score.
    
    Args:
        db: Database session
        lead: Lead object to update
        
    Returns:
        Updated Lead object
    """
    lead.score = calculate_lead_score(db, lead)
    db.add(lead)
    db.commit()
    db.refresh(lead)
    return lead

