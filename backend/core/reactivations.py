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
    - Leads with matching center_id and player_age_category
    - Status is 'Nurture' OR status is 'Dead/Not Interested' with loss_reason = 'Timing Mismatch'
    - do_not_contact is False (respect opt-out)
    
    Args:
        db: Database session
        batch_id: ID of the newly created batch
        
    Returns:
        List of Lead objects that match the criteria
    """
    # Get the batch to find its center and age category
    batch = db.get(Batch, batch_id)
    if not batch:
        return []
    
    # Build query for matching leads
    # Must match center and age category
    # Status must be Nurture OR (Dead/Not Interested with Timing Mismatch)
    # Must not have do_not_contact = True
    query = select(Lead).where(
        and_(
            Lead.center_id == batch.center_id,
            Lead.player_age_category == batch.age_category,
            Lead.do_not_contact == False,  # Respect opt-out flag
            or_(
                Lead.status == "Nurture",
                and_(
                    Lead.status == "Dead/Not Interested",
                    Lead.loss_reason == "Timing Mismatch"
                )
            )
        )
    )
    
    leads = db.exec(query).all()
    return list(leads)

