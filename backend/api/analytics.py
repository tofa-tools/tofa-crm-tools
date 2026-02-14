"""
Analytics and dashboard API routes.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session
from typing import Optional
from datetime import datetime

from backend.api.deps import get_current_user, get_session
from backend.core.analytics import (
    get_command_center_analytics,
    get_conversion_rates_cached,
    calculate_average_time_to_contact_cached,
    get_status_distribution,
)
from backend.core.abandoned_leads import get_abandoned_leads_count
from backend.core.at_risk_leads import get_at_risk_leads_count
from backend.core.pending_reports import get_pending_student_reports
from backend.models import User

router = APIRouter()


@router.get("/command-center")
def get_command_center_analytics_endpoint(
    target_date: Optional[str] = None,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """
    Get role-based command center analytics.
    Query Parameters:
        target_date: Optional date in YYYY-MM-DD format (defaults to today)
    """
    target = None
    if target_date:
        try:
            target = datetime.fromisoformat(target_date).date()
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    return get_command_center_analytics(db, current_user, target)


@router.get("/conversion-rates")
def get_conversion_rates_endpoint(
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """
    Get conversion rates and business funnel (5-min cached).
    Returns legacy conversion_rates and new funnel (Engagement, Commitment, Success).
    """
    return get_conversion_rates_cached(db)


@router.get("/time-to-contact")
def get_time_to_contact_endpoint(
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """
    Get average time (in hours) from lead creation to first contact (status change) (5-min cached).
    """
    avg_hours = calculate_average_time_to_contact_cached(db)
    if avg_hours is None:
        return {"average_hours": None, "message": "No data available"}
    return {"average_hours": avg_hours}


@router.get("/status-distribution")
def get_status_distribution_endpoint(
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Get count of leads per status."""
    distribution = get_status_distribution(db)
    return {"distribution": distribution}


@router.get("/abandoned-count")
def get_abandoned_leads_count_endpoint(
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Get the count of abandoned leads."""
    count = get_abandoned_leads_count(db)
    return {"abandoned_leads_count": count}


@router.get("/at-risk-count")
def get_at_risk_leads_count_endpoint(
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Get the count of at-risk leads (10 days inactive)."""
    count = get_at_risk_leads_count(db)
    return {"at_risk_leads_count": count}


@router.get("/pending-student-reports")
def get_pending_student_reports_endpoint(
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Get students with new evaluations awaiting progress reports."""
    pending_students = get_pending_student_reports(db)
    return {"pending_students": pending_students, "count": len(pending_students)}
