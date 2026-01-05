-- Migration: Add DEFAULT constraint to created_time column in lead table
-- This ensures created_time is always set, even if not explicitly provided in code
-- Run this in your Supabase SQL Editor

-- Check if DEFAULT already exists (safe to run multiple times)
DO $$
BEGIN
    -- Add DEFAULT constraint if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'lead' 
        AND column_name = 'created_time'
        AND column_default IS NOT NULL
    ) THEN
        ALTER TABLE "lead" 
        ALTER COLUMN created_time SET DEFAULT (now() AT TIME ZONE 'utc');
        
        RAISE NOTICE 'Added DEFAULT constraint to created_time column';
    ELSE
        RAISE NOTICE 'DEFAULT constraint already exists on created_time column';
    END IF;
END $$;

-- Also ensure last_updated has DEFAULT (though it's nullable, having a default helps)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'lead' 
        AND column_name = 'last_updated'
        AND column_default IS NOT NULL
    ) THEN
        ALTER TABLE "lead" 
        ALTER COLUMN last_updated SET DEFAULT (now() AT TIME ZONE 'utc');
        
        RAISE NOTICE 'Added DEFAULT constraint to last_updated column';
    ELSE
        RAISE NOTICE 'DEFAULT constraint already exists on last_updated column';
    END IF;
END $$;

