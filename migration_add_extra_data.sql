-- Migration: Add extra_data column to lead table
-- This column stores JSONB data for Skill Reports and other extensible data

-- Check if column exists, if not add it
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'lead' 
        AND column_name = 'extra_data'
    ) THEN
        ALTER TABLE "lead" 
        ADD COLUMN extra_data JSONB DEFAULT '{}';
        
        RAISE NOTICE 'Column extra_data added to lead table';
    ELSE
        RAISE NOTICE 'Column extra_data already exists in lead table';
    END IF;
END $$;

