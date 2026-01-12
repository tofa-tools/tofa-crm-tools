"""
Functions for managing lead metadata (skill reports, etc.)
"""
from sqlmodel import Session, select
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
    For skill_reports, also updates the associated Student's extra_data if it exists.
    
    Args:
        db: Database session
        lead_id: ID of the lead to update
        metadata_updates: Dictionary of data to merge into existing extra_data
        user_id: Optional user ID for audit log (used for skill reports)
        
    Returns:
        Updated Lead object
        
    Raises:
        ValueError: If lead not found
    """
    from backend.models import Student
    from backend.core.analytics import get_student_milestones
    from datetime import datetime
    
    lead = db.get(Lead, lead_id)
    if not lead:
        raise ValueError(f"Lead {lead_id} not found")
    
    # Merge extra_data (existing data + new updates)
    current_data = lead.extra_data or {}
    
    # Special handling for skill_reports: append to array instead of replacing
    if 'skill_reports' in metadata_updates:
        if isinstance(metadata_updates['skill_reports'], list):
            existing_reports = current_data.get('skill_reports', [])
            new_reports = metadata_updates['skill_reports']
            
            # For each new report, add milestone information if student exists
            enriched_reports = []
            student = db.exec(select(Student).where(Student.lead_id == lead_id)).first()
            
            for report in new_reports:
                enriched_report = dict(report) if isinstance(report, dict) else {}
                
                # Add timestamp if not present
                if 'timestamp' not in enriched_report:
                    enriched_report['timestamp'] = datetime.utcnow().isoformat()
                
                # Add coach user_id if provided
                if user_id and 'coach_user_id' not in enriched_report:
                    enriched_report['coach_user_id'] = user_id
                
                # Calculate and add milestone information if student exists
                if student:
                    milestone_info = get_student_milestones(db, student.id)
                    current_session_count = milestone_info.get('current_session_count', 0)
                    
                    # Determine which 15-session milestone this report is for
                    # Find the highest 15-session milestone the student has reached that matches the unlocked milestone
                    report_milestones = [15, 30, 45, 60, 75, 90, 105, 120]
                    milestone_sessions = None
                    
                    # If report is unlocked, find the milestone that triggered it
                    if milestone_info.get('report_unlocked'):
                        # Find the highest milestone reached that doesn't have a report yet
                        # Use existing_reports from current_data (already fetched above)
                        existing_milestones = set()
                        for rpt in existing_reports:
                            if isinstance(rpt, dict) and 'milestone_sessions' in rpt:
                                existing_milestones.add(rpt['milestone_sessions'])
                        
                        # Find highest milestone reached without a report
                        for milestone in sorted(report_milestones, reverse=True):
                            if current_session_count >= milestone and milestone not in existing_milestones:
                                milestone_sessions = milestone
                                break
                    else:
                        # Fallback: use the highest milestone reached
                        for milestone in sorted(report_milestones, reverse=True):
                            if current_session_count >= milestone:
                                milestone_sessions = milestone
                                break
                    
                    if milestone_sessions:
                        enriched_report['milestone_sessions'] = milestone_sessions
                        enriched_report['milestone_label'] = f'Milestone: {milestone_sessions} sessions'
                        enriched_report['session_count_at_report'] = current_session_count
                
                enriched_reports.append(enriched_report)
            
            # Append new reports to existing ones
            # Note: Skill reports are stored in Lead.extra_data, not Student.extra_data
            updated_data = {
                **current_data,
                **{k: v for k, v in metadata_updates.items() if k != 'skill_reports'},
                'skill_reports': existing_reports + enriched_reports
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

