"""
Migration script to add last_updated column to lead table.
Run this once to update existing database schema.
"""
import os
from sqlalchemy import text
from backend.core.db import engine, get_session_sync
from dotenv import load_dotenv

load_dotenv()


def add_last_updated_column():
    """Add last_updated column to lead table if it doesn't exist."""
    try:
        with engine.connect() as conn:
            # Check if column exists (PostgreSQL specific)
            result = conn.execute(text("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name='lead' AND column_name='last_updated'
            """))
            
            if result.fetchone() is None:
                print("Adding last_updated column to lead table...")
                conn.execute(text("""
                    ALTER TABLE lead 
                    ADD COLUMN last_updated TIMESTAMP
                """))
                conn.commit()
                print("✅ Successfully added last_updated column")
            else:
                print("✅ Column last_updated already exists")
    except Exception as e:
        print(f"❌ Error adding column: {e}")
        raise


def add_audit_log_table():
    """Create audit_log table if it doesn't exist."""
    from backend.models import AuditLog, SQLModel
    
    try:
        # Create the audit_log table
        AuditLog.metadata.create_all(engine)
        print("✅ Audit log table created/verified")
    except Exception as e:
        print(f"❌ Error creating audit_log table: {e}")
        raise


if __name__ == "__main__":
    print("Running database migrations...")
    add_last_updated_column()
    add_audit_log_table()
    print("✅ All migrations completed!")

