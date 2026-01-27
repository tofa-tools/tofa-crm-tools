"""
Migration script to add email column to leadstaging table.
Run this once to update existing database schema.
"""
import os
from sqlalchemy import text
from backend.core.db import engine
from dotenv import load_dotenv

load_dotenv()


def add_email_column_to_leadstaging():
    """Add email column to leadstaging table if it doesn't exist."""
    try:
        with engine.connect() as conn:
            # Check if column exists (PostgreSQL specific)
            result = conn.execute(text("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name='leadstaging' AND column_name='email'
            """))
            
            if result.fetchone() is None:
                print("Adding email column to leadstaging table...")
                conn.execute(text("""
                    ALTER TABLE leadstaging 
                    ADD COLUMN email VARCHAR
                """))
                conn.commit()
                print("✅ Successfully added email column to leadstaging table")
            else:
                print("✅ Column email already exists in leadstaging table")
    except Exception as e:
        print(f"❌ Error adding column: {e}")
        raise


if __name__ == "__main__":
    print("Running migration to add email column to leadstaging...")
    add_email_column_to_leadstaging()
    print("✅ Migration completed!")

