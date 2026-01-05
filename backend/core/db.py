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

# Validate DATABASE_URL
if not DATABASE_URL:
    raise ValueError(
        "DATABASE_URL environment variable is not set. "
        "Please set it in your .env file: DATABASE_URL=postgresql://user:password@host:port/database"
    )

# If user forgot to change postgres:// to postgresql://
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

# Check if DATABASE_URL contains placeholder values
if "user:password" in DATABASE_URL or ":port" in DATABASE_URL or "/database" in DATABASE_URL:
    raise ValueError(
        "DATABASE_URL appears to contain placeholder values. "
        "Please set actual database credentials in your .env file."
    )

# Create engine with connection pool settings to handle stale connections
engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,  # Verify connections before using them (handles stale connections)
    pool_recycle=3600,   # Recycle connections after 1 hour
    pool_size=5,         # Number of connections to keep in pool
    max_overflow=10      # Max connections that can be created beyond pool_size
)


def get_session() -> Generator[Session, None, None]:
    """Get a database session. Use as context manager or generator."""
    with Session(engine) as session:
        yield session


def get_session_sync() -> Session:
    """Get a synchronous database session."""
    return Session(engine)


def create_db_and_tables():
    """Create database tables if they don't exist."""
    SQLModel.metadata.create_all(engine)
    
    # Create composite index on AuditLog for performance
    # This index optimizes queries filtering by lead_id and ordering by timestamp
    from sqlalchemy import text, inspect
    inspector = inspect(engine)
    
    try:
        # Check if index already exists
        indexes = [idx['name'] for idx in inspector.get_indexes('auditlog')]
        if 'ix_auditlog_lead_id_timestamp' not in indexes:
            # Create composite index on (lead_id, timestamp)
            with Session(engine) as db_session:
                db_session.exec(text("""
                    CREATE INDEX IF NOT EXISTS ix_auditlog_lead_id_timestamp 
                    ON auditlog(lead_id, timestamp DESC)
                """))
                db_session.commit()
                print("✅ Created composite index on AuditLog (lead_id, timestamp)")
    except Exception as e:
        # Index creation failed - might already exist or table doesn't exist yet
        print(f"Note: Could not create AuditLog composite index (may already exist): {e}")
    
    # Try to add mentioned_user_ids column to comment table if it doesn't exist
    try:
        columns = [col['name'] for col in inspector.get_columns('comment')]
        if 'mentioned_user_ids' not in columns:
            print("Adding mentioned_user_ids column to comment table...")
            with Session(engine) as db_session:
                db_session.exec(text("ALTER TABLE comment ADD COLUMN mentioned_user_ids TEXT"))
                db_session.commit()
                print("✅ Added mentioned_user_ids column to comment table")
    except Exception as e:
        # Column might already exist or table doesn't exist yet
        print(f"Note: Could not check/add mentioned_user_ids column: {e}")
    
    # Try to add date_of_birth and metadata columns to lead table if they don't exist
    try:
        columns = [col['name'] for col in inspector.get_columns('lead')]
        if 'date_of_birth' not in columns:
            print("Adding date_of_birth column to lead table...")
            with Session(engine) as db_session:
                db_session.exec(text("ALTER TABLE lead ADD COLUMN date_of_birth DATE"))
                db_session.commit()
                print("✅ Added date_of_birth column to lead table")
        if 'metadata' not in columns:
            print("Adding metadata column to lead table...")
            with Session(engine) as db_session:
                db_session.exec(text("ALTER TABLE lead ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb"))
                db_session.commit()
                print("✅ Added metadata column to lead table")
    except Exception as e:
        print(f"Note: Could not check/add date_of_birth or metadata columns: {e}")

