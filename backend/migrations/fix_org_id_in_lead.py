"""
Migration script to fix org_id column in lead table.
Makes org_id nullable or sets a default value if it's required.
"""
import os
from sqlalchemy import text
from backend.core.db import engine
from dotenv import load_dotenv

load_dotenv()


def fix_org_id_column():
    """Make org_id nullable in lead table if it exists and is NOT NULL."""
    try:
        with engine.connect() as conn:
            # Check if column exists and its current state
            result = conn.execute(text("""
                SELECT column_name, is_nullable, column_default
                FROM information_schema.columns 
                WHERE table_name='lead' AND column_name='org_id'
            """))
            
            row = result.fetchone()
            if row:
                column_name, is_nullable, column_default = row
                print(f"Found org_id column: nullable={is_nullable}, default={column_default}")
                
                if is_nullable == 'NO':
                    print("Making org_id nullable...")
                    conn.execute(text("""
                        ALTER TABLE lead 
                        ALTER COLUMN org_id DROP NOT NULL
                    """))
                    conn.commit()
                    print("✅ Successfully made org_id nullable")
                else:
                    print("✅ org_id is already nullable")
            else:
                print("⚠️ org_id column does not exist in lead table")
    except Exception as e:
        print(f"❌ Error fixing column: {e}")
        raise


if __name__ == "__main__":
    print("Running migration to fix org_id column in lead table...")
    fix_org_id_column()
    print("✅ Migration completed!")

