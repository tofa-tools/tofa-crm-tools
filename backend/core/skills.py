"""
Skill evaluation management logic.
Handles creation and aggregation of player skill evaluations.
"""
from sqlmodel import Session, select, func
from typing import List, Optional, Dict
from datetime import datetime
from backend.models import SkillEvaluation, Lead, User


def create_skill_evaluation(
    db: Session,
    lead_id: int,
    coach_id: int,
    technical_score: int,
    fitness_score: int,
    teamwork_score: int,
    discipline_score: int,
    coach_notes: Optional[str] = None
) -> SkillEvaluation:
    """
    Create a new skill evaluation record.
    
    Args:
        db: Database session
        lead_id: Lead (student) ID
        coach_id: Coach (user) ID who created the evaluation
        technical_score: Technical skill score (1-5)
        fitness_score: Fitness score (1-5)
        teamwork_score: Teamwork score (1-5)
        discipline_score: Discipline score (1-5)
        coach_notes: Optional notes from the coach
        
    Returns:
        Created SkillEvaluation object
        
    Raises:
        ValueError: If lead or coach not found, or scores out of range
    """
    # Verify lead exists
    lead = db.get(Lead, lead_id)
    if not lead:
        raise ValueError(f"Lead {lead_id} not found")
    
    # Verify coach exists
    coach = db.get(User, coach_id)
    if not coach:
        raise ValueError(f"Coach {coach_id} not found")
    
    # Validate scores are in range (already handled by Field constraints, but double-check)
    for score_name, score in [
        ("technical_score", technical_score),
        ("fitness_score", fitness_score),
        ("teamwork_score", teamwork_score),
        ("discipline_score", discipline_score),
    ]:
        if score < 1 or score > 5:
            raise ValueError(f"{score_name} must be between 1 and 5")
    
    # Create evaluation record
    evaluation = SkillEvaluation(
        lead_id=lead_id,
        coach_id=coach_id,
        technical_score=technical_score,
        fitness_score=fitness_score,
        teamwork_score=teamwork_score,
        discipline_score=discipline_score,
        coach_notes=coach_notes,
        created_at=datetime.utcnow()
    )
    
    db.add(evaluation)
    db.commit()
    db.refresh(evaluation)
    
    return evaluation


def get_skill_evaluations_for_lead(
    db: Session,
    lead_id: int
) -> List[SkillEvaluation]:
    """
    Get all skill evaluations for a specific lead.
    
    Args:
        db: Database session
        lead_id: Lead ID
        
    Returns:
        List of SkillEvaluation objects, ordered by created_at (newest first)
    """
    query = select(SkillEvaluation).where(
        SkillEvaluation.lead_id == lead_id
    ).order_by(SkillEvaluation.created_at.desc())
    
    return list(db.exec(query).all())


def get_skill_summary_for_lead(
    db: Session,
    lead_id: int
) -> Dict:
    """
    Get aggregated skill summary for a lead.
    Calculates average scores for each category based on all evaluations.
    Returns the most recent coach_notes.
    
    Args:
        db: Database session
        lead_id: Lead ID
        
    Returns:
        Dictionary with:
        - average_technical_score: float
        - average_fitness_score: float
        - average_teamwork_score: float
        - average_discipline_score: float
        - total_evaluations: int
        - most_recent_notes: Optional[str]
        - most_recent_evaluation_date: Optional[datetime]
    """
    evaluations = get_skill_evaluations_for_lead(db, lead_id)
    
    if not evaluations:
        return {
            "average_technical_score": None,
            "average_fitness_score": None,
            "average_teamwork_score": None,
            "average_discipline_score": None,
            "total_evaluations": 0,
            "most_recent_notes": None,
            "most_recent_evaluation_date": None,
        }
    
    # Calculate averages
    total = len(evaluations)
    avg_technical = sum(e.technical_score for e in evaluations) / total
    avg_fitness = sum(e.fitness_score for e in evaluations) / total
    avg_teamwork = sum(e.teamwork_score for e in evaluations) / total
    avg_discipline = sum(e.discipline_score for e in evaluations) / total
    
    # Get most recent evaluation (they're already ordered by created_at desc)
    most_recent = evaluations[0]
    
    return {
        "average_technical_score": round(avg_technical, 2),
        "average_fitness_score": round(avg_fitness, 2),
        "average_teamwork_score": round(avg_teamwork, 2),
        "average_discipline_score": round(avg_discipline, 2),
        "total_evaluations": total,
        "most_recent_notes": most_recent.coach_notes,
        "most_recent_evaluation_date": most_recent.created_at.isoformat() if most_recent.created_at else None,
    }

