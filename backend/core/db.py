"""
Database connection and session management.
Framework-agnostic database utilities.
"""
from sqlmodel import SQLModel, create_engine, Session
from dotenv import load_dotenv
import os
from typing import Generator

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

# If user forgot to change postgres:// to postgresql://
if DATABASE_URL and DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

engine = create_engine(DATABASE_URL)


def get_session() -> Generator[Session, None, None]:
    """Get a database session. Use as context manager or generator."""
    with Session(engine) as session:
        yield session


def get_session_sync() -> Session:
    """Get a synchronous database session (for Flask)."""
    return Session(engine)


def create_db_and_tables():
    """Create database tables if they don't exist."""
    SQLModel.metadata.create_all(engine)

