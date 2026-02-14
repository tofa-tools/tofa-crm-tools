"""
Shared dependencies for API routes.
Centralizes get_session, get_current_user, oauth2_scheme, and limiter.
"""
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlmodel import Session
from slowapi import Limiter
from slowapi.util import get_remote_address

from backend.core.db import get_session
from backend.core.auth import get_user_email_from_token
from backend.core.users import get_user_by_email
from backend.models import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")
limiter = Limiter(key_func=get_remote_address)


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_session),
) -> User:
    """
    FastAPI dependency to get current authenticated user from JWT token.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    email = get_user_email_from_token(token)
    if email is None:
        raise credentials_exception

    user = get_user_by_email(db, email)
    if user is None:
        raise credentials_exception

    return user
