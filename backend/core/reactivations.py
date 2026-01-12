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
    - Status is 'Nurture' OR 'On Break' OR status is 'Dead/Not Interested' with loss_reason = 'Timing Mismatch'
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
    # Status must be Nurture OR On Break OR (Dead/Not Interested with Timing Mismatch)
    # Must not have do_not_contact = True
    # Note: Batch age_category can be comma-separated, so we need to filter in Python
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
    
    # Filter leads by age category (batch can have multiple categories like "U11,U13")
    batch_categories = [cat.strip() for cat in batch.age_category.split(',')] if batch.age_category else []
    leads = [lead for lead in all_leads if lead.player_age_category in batch_categories]
    
    return list(leads)

