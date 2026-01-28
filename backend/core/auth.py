"""
Framework-agnostic authentication utilities.
JWT encoding/decoding and password hashing.
"""
from datetime import datetime, timedelta
from typing import Optional, Dict
from jose import JWTError, jwt
from passlib.context import CryptContext
import os
from dotenv import load_dotenv

load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY", "unsafe_secret_key")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 60))

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plain password against a hash."""
    if not isinstance(plain_password, str):
        raise TypeError("plain_password must be a str")
    if not isinstance(hashed_password, str):
        raise TypeError("hashed_password must be a str")

    # bcrypt only uses the first 72 bytes of the input. If you are seeing
    # "password cannot be longer than 72 bytes", something upstream is likely
    # passing a long string (e.g., a token) as the password.
    if len(plain_password.encode("utf-8")) > 72:
        raise ValueError(
            "Password is longer than 72 bytes (bcrypt limit). "
            "Ensure you are hashing/verifying ONLY the user's plain password."
        )

    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(plain_password: str) -> str:
    """Hash a plain password.

    Important: do NOT mix in SECRET_KEY here. SECRET_KEY is only for JWT signing.
    """
    if not isinstance(plain_password, str):
        raise TypeError("plain_password must be a str")
    if len(plain_password.encode("utf-8")) > 72:
        raise ValueError(
            "Password is longer than 72 bytes (bcrypt limit). "
            "Ensure you are hashing ONLY the user's plain password."
        )
    return pwd_context.hash(plain_password)


def create_access_token(data: Dict) -> str:
    """Create a JWT access token."""
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def decode_access_token(token: str) -> Optional[Dict]:
    """Decode a JWT access token. Returns None if invalid."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        return None


def get_user_email_from_token(token: str) -> Optional[str]:
    """Extract email from JWT token. Returns None if invalid."""
    payload = decode_access_token(token)
    if payload:
        return payload.get("sub")
    return None

