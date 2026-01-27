"""
Migration script to add created_by_id column to leadstaging table.
Run this once to update existing database schema.
"""
import os
from sqlalchemy import text
from backend.core.db import engine
from dotenv import load_dotenv

load_dotenv()


def add_created_by_id_column_to_leadstaging():
    """Add created_by_id column to leadstaging table if it doesn't exist."""
    try:
        with engine.connect() as conn:
            # Check if column exists (PostgreSQL specific)
            result = conn.execute(text("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name='leadstaging' AND column_name='created_by_id'
            """))
            
            if result.fetchone() is None:
                print("Adding created_by_id column to leadstaging table...")
                conn.execute(text("""
                    ALTER TABLE leadstaging 
                    ADD COLUMN created_by_id INTEGER REFERENCES "user"(id) ON DELETE SET NULL
                """))
                conn.commit()
                print("✅ Successfully added created_by_id column to leadstaging table")
            else:
                print("✅ Column created_by_id already exists in leadstaging table")
    except Exception as e:
        print(f"❌ Error adding column: {e}")
        raise


if __name__ == "__main__":
    print("Running migration to add created_by_id column to leadstaging...")
    add_created_by_id_column_to_leadstaging()
    print("✅ Migration completed!")

