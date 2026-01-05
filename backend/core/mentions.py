"""
Mention parsing and handling utilities.
Framework-agnostic mention processing.
"""
import re
import json
from typing import List, Dict, Optional
from sqlmodel import Session
from backend.models import User


def parse_mentions(text: str) -> List[str]:
    """
    Parse @username mentions from text.
    
    Returns list of usernames (without @ symbol).
    
    Example:
        parse_mentions("Hey @john, can you check @jane?")
        Returns: ['john', 'jane']
    """
    # Match @username pattern (alphanumeric + underscore, not at start of line after word char)
    # Allow @username at start of text, after space, or after punctuation
    pattern = r'@(\w+)'
    matches = re.findall(pattern, text)
    # Remove duplicates while preserving order
    seen = set()
    unique_mentions = []
    for match in matches:
        if match.lower() not in seen:
            seen.add(match.lower())
            unique_mentions.append(match)
    return unique_mentions


def resolve_mentions_to_user_ids(
    db: Session,
    usernames: List[str]
) -> List[int]:
    """
    Resolve usernames (emails or full names) to user IDs.
    
    Args:
        db: Database session
        usernames: List of usernames (without @)
        
    Returns:
        List of user IDs
    """
    if not usernames:
        return []
    
    from sqlmodel import select
    
    user_ids = []
    for username in usernames:
        user = None
        
        # Try email match (exact, case-insensitive)
        users_by_email = db.exec(
            select(User).where(User.email.ilike(username))
        ).all()
        if users_by_email:
            user = users_by_email[0]
        else:
            # Try full_name match (case-insensitive, partial)
            users_by_name = db.exec(
                select(User).where(User.full_name.ilike(f"%{username}%"))
            ).all()
            if users_by_name:
                user = users_by_name[0]  # Take first match
        
        if user and user.id not in user_ids:
            user_ids.append(user.id)
    
    return user_ids


def store_mentions(mentioned_user_ids: List[int]) -> Optional[str]:
    """
    Store mentioned user IDs as JSON string.
    
    Args:
        mentioned_user_ids: List of user IDs
        
    Returns:
        JSON string or None if empty
    """
    if not mentioned_user_ids:
        return None
    return json.dumps(mentioned_user_ids)


def load_mentions(mentions_json: Optional[str]) -> List[int]:
    """
    Load mentioned user IDs from JSON string.
    
    Args:
        mentions_json: JSON string of user IDs
        
    Returns:
        List of user IDs
    """
    if not mentions_json:
        return []
    try:
        return json.loads(mentions_json)
    except (json.JSONDecodeError, TypeError):
        return []

