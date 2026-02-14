"""
Webhook endpoints (unauthenticated).
"""
import os
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlmodel import Session
from typing import Optional
from datetime import date as date_type

from backend.api.deps import get_session
from backend.core.leads import create_lead_from_meta
from backend.models import Center

router = APIRouter()


@router.post("/meta")
async def meta_webhook(
    phone: str,
    name: str,
    email: Optional[str] = None,
    center_tag: Optional[str] = None,
    date_of_birth: Optional[str] = None,
    age_group: Optional[str] = None,
    address: Optional[str] = None,
    db: Session = Depends(get_session),
    background_tasks: BackgroundTasks = None,
):
    """Webhook endpoint for Meta lead ads. Creates a new lead from Meta form submission."""
    try:
        if not center_tag:
            center_tag = "unknown"
        dob_parsed = None
        if date_of_birth:
            try:
                dob_parsed = date_type.fromisoformat(date_of_birth)
            except (ValueError, TypeError):
                pass
        lead = create_lead_from_meta(
            db=db,
            phone=phone,
            name=name,
            email=email,
            center_tag=center_tag,
            date_of_birth=dob_parsed,
            age_group=age_group,
            address=address,
        )
        try:
            from backend.core.notifications import notify_center_users
            center = db.get(Center, lead.center_id)
            center_name = (center.display_name or center.city or "Unknown") if center else "Unknown"
            base_url = os.getenv("CRM_BASE_URL", "").strip().rstrip("/")
            from urllib.parse import quote
            link = f"{base_url}/leads?search={quote(lead.phone or '')}" if base_url else None
            notify_center_users(
                db, lead.center_id,
                type="SALES_ALERT",
                title=f"New Lead: {lead.player_name or 'Unknown'}",
                message=f"New lead from Meta Ads at {center_name}. Phone: {lead.phone or '—'}.",
                link=link,
                priority="low",
            )
        except Exception as e:
            import logging
            logging.getLogger(__name__).exception("New lead in-app notification failed: %s", e)
        return {"status": "success", "lead_id": lead.id}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")
