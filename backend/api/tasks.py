"""
Task queue, calendar, and user stats API routes.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session
from typing import Optional
from datetime import datetime

from backend.api.deps import get_current_user, get_session
from backend.core.tasks import get_daily_task_queue, get_calendar_month_view, get_daily_stats
from backend.core.user_stats import get_user_completion_streak, get_user_today_completion_stats
from backend.core.lead_privacy import serialize_leads_for_user
from backend.models import User

router = APIRouter()


@router.get("/daily-queue")
def get_daily_queue(
    target_date: Optional[str] = None,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Get tasks for the daily queue (overdue, due_today, upcoming)."""
    target = None
    if target_date:
        try:
            target = datetime.fromisoformat(target_date).date()
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    tasks = get_daily_task_queue(db, current_user, target)
    serialized = {k: serialize_leads_for_user(v, current_user.role) for k, v in tasks.items()}
    return serialized


@router.get("/daily-stats")
def get_daily_stats_endpoint(
    target_date: Optional[str] = None,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Get daily vital stats for the task queue header."""
    target = None
    if target_date:
        try:
            target = datetime.fromisoformat(target_date).date()
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    return get_daily_stats(db, current_user, target)


calendar_router = APIRouter()


@calendar_router.get("/month")
def get_calendar_month(
    year: int,
    month: int,
    center_ids: Optional[str] = None,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Get calendar data for a specific month with workload heatmap."""
    center_ids_list = None
    if center_ids:
        try:
            center_ids_list = [int(x.strip()) for x in center_ids.split(",") if x.strip()]
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid center_ids format")
    return get_calendar_month_view(db, current_user, year, month, center_ids_list)


user_stats_router = APIRouter()


@user_stats_router.get("/streak")
def get_user_streak(
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Get user's task completion streak."""
    return get_user_completion_streak(db, current_user.id)


@user_stats_router.get("/today")
def get_user_today_stats(
    target_date: Optional[str] = None,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Get user's completion stats for today."""
    target = None
    if target_date:
        try:
            target = datetime.fromisoformat(target_date).date()
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    return get_user_today_completion_stats(db, current_user.id, target)
