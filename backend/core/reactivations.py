"""
Reactivation logic for identifying potential leads to re-engage when new batches are created.
"""
from sqlmodel import Session, select, and_, or_
from typing import List, Optional
from backend.models import Lead, Batch, Center


def get_potential_reactivations(db: Session, batch_id: int) -> List[Lead]:
    """
    Find potential leads to re-activate when a new batch is created.
    
    Criteria:
    - Leads with matching center_id and age group (min_age/max_age)
    - Status is 'Nurture' OR 'On Break' OR status is 'Dead/Not Interested' with loss_reason = 'Timing Mismatch'
    - do_not_contact is False (respect opt-out)
    
    Args:
        db: Database session
        batch_id: ID of the newly created batch
        
    Returns:
        List of Lead objects that match the criteria
    """
    # Get the batch to find its center and age group
    batch = db.get(Batch, batch_id)
    if not batch:
        return []
    
    # Build query for matching leads
    # Must match center and age group
    # Status must be Nurture OR On Break OR (Dead/Not Interested with Timing Mismatch)
    # Must not have do_not_contact = True
    # Filter leads by age range (min_age <= lead_age <= max_age)
    query = select(Lead).where(
        and_(
            Lead.center_id == batch.center_id,
            Lead.do_not_contact == False,  # Respect opt-out flag
            or_(
                Lead.status == "Nurture",
                Lead.status == "On Break",
                and_(
                    Lead.status == "Dead/Not Interested",
                    Lead.loss_reason == "Timing Mismatch"
                )
            )
        )
    )
    
    all_leads = db.exec(query).all()
    
    # Filter leads by age group (batch can have multiple groups like "U11,U13")
    from backend.core.age_utils import calculate_age
    batch_min = getattr(batch, 'min_age', 0) or 0
    batch_max = getattr(batch, 'max_age', 99) or 99
    leads = []
    for lead in all_leads:
        lead_age = calculate_age(lead.date_of_birth)
        if lead_age is not None and batch_min <= lead_age <= batch_max:
            leads.append(lead)
    
    return list(leads)

