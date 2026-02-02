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

# Bcrypt has a 72-BYTE limit (not characters). Truncate by bytes to avoid ValueError in production.
BCRYPT_MAX_BYTES = 72


def _truncate_to_bytes(s: str, max_bytes: int = BCRYPT_MAX_BYTES) -> str:
    """Truncate string to at most max_bytes when encoded as UTF-8. Prevents bcrypt 72-byte error."""
    if not s:
        return ""
    encoded = s.encode("utf-8")
    if len(encoded) <= max_bytes:
        return s
    return encoded[:max_bytes].decode("utf-8", errors="ignore")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plain password against a hash. Truncate to 72 bytes for bcrypt limit."""
    return pwd_context.verify(_truncate_to_bytes(plain_password or ""), hashed_password or "")


def get_password_hash(password: str) -> str:
    """Hash a password. Truncate to 72 bytes for bcrypt limit."""
    return pwd_context.hash(_truncate_to_bytes(password or ""))


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

