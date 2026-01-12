-- ==========================================
-- Combined Database Migrations
-- Date: 2026-01-08
-- Description: All database schema changes for Lead/Student separation and Re-engagement Engine
-- Run this in your Supabase SQL Editor
-- ==========================================

-- ==========================================
-- 1. CREATE STUDENT TABLE
-- ==========================================
-- Creates a separate Student table for active members
CREATE TABLE IF NOT EXISTS student (
    id SERIAL PRIMARY KEY,
    lead_id INTEGER NOT NULL UNIQUE REFERENCES lead(id) ON DELETE CASCADE,
    center_id INTEGER NOT NULL REFERENCES center(id) ON DELETE RESTRICT,
    subscription_plan VARCHAR(50) NOT NULL,
    subscription_start_date DATE NOT NULL,
    subscription_end_date DATE NULL,
    payment_proof_url VARCHAR(500) NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_student_lead_id ON student(lead_id);
CREATE INDEX IF NOT EXISTS idx_student_center_id ON student(center_id);
CREATE INDEX IF NOT EXISTS idx_student_is_active ON student(is_active);

COMMENT ON TABLE student IS 'Active members who have graduated from Lead status';
COMMENT ON COLUMN student.lead_id IS 'One-to-one relationship with Lead (unique foreign key)';
COMMENT ON COLUMN student.subscription_plan IS 'Subscription plan type (Monthly, Quarterly, 6 Months, Yearly)';
COMMENT ON COLUMN student.is_active IS 'Whether the student is currently active';

-- ==========================================
-- 2. UPDATE STUDENTBATCHLINK TABLE
-- ==========================================
-- Update to use student_id instead of lead_id for multi-batch assignment
ALTER TABLE studentbatchlink
DROP COLUMN IF EXISTS lead_id;

ALTER TABLE studentbatchlink
ADD COLUMN IF NOT EXISTS student_id INTEGER NULL REFERENCES student(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_studentbatchlink_student_id ON studentbatchlink(student_id);

-- Update primary key to use student_id
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'studentbatchlink_pkey'
    ) THEN
        ALTER TABLE studentbatchlink DROP CONSTRAINT studentbatchlink_pkey;
    END IF;
    
    ALTER TABLE studentbatchlink
    ADD CONSTRAINT studentbatchlink_pkey PRIMARY KEY (student_id, batch_id);
END $$;

COMMENT ON TABLE studentbatchlink IS 'Join table linking Students to Batches for multi-batch assignment';
COMMENT ON COLUMN studentbatchlink.student_id IS 'Foreign key to student (replaces lead_id)';

-- ==========================================
-- 3. Add student_id to attendance table
-- ==========================================
-- Adds student_id column to attendance table to support both leads (trials) and students (active members)
ALTER TABLE attendance
ADD COLUMN IF NOT EXISTS student_id INTEGER NULL REFERENCES student(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_attendance_student_id ON attendance(student_id);

COMMENT ON COLUMN attendance.student_id IS 'Foreign key to student (for active students, use this instead of lead_id for regular attendance)';

-- ==========================================
-- 4. Add renewal fields to student table
-- ==========================================
-- Adds renewal intent tracking and grace period management for student subscriptions
ALTER TABLE student
ADD COLUMN IF NOT EXISTS renewal_intent BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS in_grace_period BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_student_renewal_intent ON student(renewal_intent) WHERE renewal_intent = TRUE;
CREATE INDEX IF NOT EXISTS idx_student_grace_period ON student(in_grace_period) WHERE in_grace_period = TRUE;

COMMENT ON COLUMN student.renewal_intent IS 'Parent has indicated intent to renew subscription';
COMMENT ON COLUMN student.in_grace_period IS 'Subscription expired but within 4-day grace period';

-- ==========================================
-- 5. Add nudge_count to lead table
-- ==========================================
-- Adds nudge_count field to track re-engagement nudges for Nurture leads (3-strike rule)
ALTER TABLE lead
ADD COLUMN IF NOT EXISTS nudge_count INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN lead.nudge_count IS 'Count of re-engagement nudges sent to Nurture leads (3-strike rule)';

-- ==========================================
-- 6. Add grace_nudge_count to student table
-- ==========================================
-- Adds grace_nudge_count field to track grace period nudges sent to students
ALTER TABLE student
ADD COLUMN IF NOT EXISTS grace_nudge_count INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN student.grace_nudge_count IS 'Count of grace period nudges sent (0 = none, 1 = first nudge, 2 = final nudge)';

-- ==========================================
-- 7. Additional Lead Table Fields (if not already present)
-- ==========================================
-- Add call_confirmation_note if not exists
ALTER TABLE lead 
ADD COLUMN IF NOT EXISTS call_confirmation_note TEXT NULL;

-- Add extra_data (JSONB) if not exists
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
    END IF;
END $$;

COMMENT ON COLUMN lead.call_confirmation_note IS 'Summary/notes from the confirmation call with the parent';
COMMENT ON COLUMN lead.extra_data IS 'Extensible JSONB field for additional data (skill reports, etc.)';

-- ==========================================
-- Migration Complete
-- ==========================================
-- All migrations have been applied successfully.
-- The database now supports:
-- - Lead/Student separation
-- - Multi-batch student assignments
-- - Renewal intent tracking
-- - Grace period management
-- - Re-engagement nudge tracking (Nurture leads)
-- - Grace period nudge tracking (Students)
-- - Additional lead fields (call_confirmation_note, extra_data)

