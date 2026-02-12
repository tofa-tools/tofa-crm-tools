-- ==========================================
-- TOFA MAIN SCHEMA (single SQL schema file)
-- Single source of truth for database structure.
-- Matches backend/models.py.
-- Run in Supabase SQL Editor or: psql $DATABASE_URL -f main_schema.sql
-- Sections: 1) CREATE TABLEs, 2) Indexes, 3) Migrations (add missing columns), 4) Fixes
-- ==========================================

-- ==========================================
-- 1. CORE IDENTITY & ACCESS
-- ==========================================
CREATE TABLE IF NOT EXISTS "user" (
    id SERIAL PRIMARY KEY,
    email VARCHAR NOT NULL UNIQUE,
    hashed_password VARCHAR NOT NULL,
    full_name VARCHAR NOT NULL,
    phone VARCHAR,
    role VARCHAR NOT NULL DEFAULT 'team_member',
    is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS "center" (
    id SERIAL PRIMARY KEY,
    display_name VARCHAR NOT NULL,
    meta_tag_name VARCHAR NOT NULL UNIQUE,
    city VARCHAR NOT NULL,
    location VARCHAR NOT NULL,
    map_link VARCHAR,
    group_email VARCHAR
);

CREATE TABLE IF NOT EXISTS "usercenterlink" (
    user_id INTEGER NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    center_id INTEGER NOT NULL REFERENCES "center"(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, center_id)
);

-- ==========================================
-- 2. BATCH MANAGEMENT
-- ==========================================
CREATE TABLE IF NOT EXISTS "batch" (
    id SERIAL PRIMARY KEY,
    name VARCHAR NOT NULL,
    center_id INTEGER NOT NULL REFERENCES "center"(id) ON DELETE CASCADE,
    min_age INTEGER NOT NULL DEFAULT 0,
    max_age INTEGER NOT NULL DEFAULT 99,
    max_capacity INTEGER DEFAULT 20,
    is_active BOOLEAN DEFAULT TRUE,
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    is_mon BOOLEAN DEFAULT FALSE,
    is_tue BOOLEAN DEFAULT FALSE,
    is_wed BOOLEAN DEFAULT FALSE,
    is_thu BOOLEAN DEFAULT FALSE,
    is_fri BOOLEAN DEFAULT FALSE,
    is_sat BOOLEAN DEFAULT FALSE,
    is_sun BOOLEAN DEFAULT FALSE,
    start_time TIME,
    end_time TIME
);

CREATE TABLE IF NOT EXISTS "batchcoachlink" (
    user_id INTEGER NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    batch_id INTEGER NOT NULL REFERENCES "batch"(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, batch_id)
);

-- ==========================================
-- 3. LEADS (SALES PIPELINE)
-- ==========================================
CREATE TABLE IF NOT EXISTS "lead" (
    id SERIAL PRIMARY KEY,
    created_time TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT (now() AT TIME ZONE 'utc'),
    last_updated TIMESTAMP WITHOUT TIME ZONE DEFAULT (now() AT TIME ZONE 'utc'),
    public_token UUID UNIQUE DEFAULT gen_random_uuid(),
    preferences_submitted BOOLEAN DEFAULT FALSE,
    player_name VARCHAR NOT NULL,
    date_of_birth DATE,
    phone VARCHAR NOT NULL,
    email VARCHAR,
    address VARCHAR,
    status VARCHAR NOT NULL DEFAULT 'New',
    next_followup_date TIMESTAMP WITHOUT TIME ZONE,
    extra_data JSONB DEFAULT '{}',
    do_not_contact BOOLEAN DEFAULT FALSE,
    center_id INTEGER REFERENCES "center"(id) ON DELETE SET NULL,
    trial_batch_id INTEGER REFERENCES "batch"(id) ON DELETE SET NULL,
    permanent_batch_id INTEGER REFERENCES "batch"(id) ON DELETE SET NULL,
    preferred_batch_id INTEGER REFERENCES "batch"(id) ON DELETE SET NULL,
    preferred_call_time VARCHAR,
    preferred_timing_notes TEXT,
    loss_reason VARCHAR,
    loss_reason_notes TEXT,
    status_at_loss VARCHAR,
    reschedule_count INTEGER DEFAULT 0,
    nudge_count INTEGER NOT NULL DEFAULT 0,
    needs_escalation BOOLEAN DEFAULT FALSE,
    call_confirmation_note TEXT
);

-- ==========================================
-- 4. STUDENTS (ACTIVE MEMBERS)
-- ==========================================
CREATE TABLE IF NOT EXISTS "student" (
    id SERIAL PRIMARY KEY,
    lead_id INTEGER NOT NULL UNIQUE REFERENCES "lead"(id) ON DELETE CASCADE,
    center_id INTEGER NOT NULL REFERENCES "center"(id) ON DELETE RESTRICT,
    subscription_plan VARCHAR(50) NOT NULL,
    subscription_start_date DATE NOT NULL,
    subscription_end_date DATE,
    payment_proof_url VARCHAR(500),
    utr_number VARCHAR,
    is_payment_verified BOOLEAN NOT NULL DEFAULT FALSE,
    kit_size VARCHAR,
    medical_info TEXT,
    secondary_contact VARCHAR,
    renewal_intent BOOLEAN DEFAULT FALSE,
    in_grace_period BOOLEAN DEFAULT FALSE,
    grace_nudge_count INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT (now() AT TIME ZONE 'utc')
);

CREATE TABLE IF NOT EXISTS "studentbatchlink" (
    student_id INTEGER NOT NULL REFERENCES "student"(id) ON DELETE CASCADE,
    batch_id INTEGER NOT NULL REFERENCES "batch"(id) ON DELETE CASCADE,
    PRIMARY KEY (student_id, batch_id)
);

-- ==========================================
-- 5. COMMUNICATION & AUDIT
-- ==========================================
CREATE TABLE IF NOT EXISTS "comment" (
    id SERIAL PRIMARY KEY,
    text TEXT NOT NULL,
    timestamp TIMESTAMP WITHOUT TIME ZONE DEFAULT (now() AT TIME ZONE 'utc'),
    user_id INTEGER NOT NULL REFERENCES "user"(id),
    lead_id INTEGER NOT NULL REFERENCES "lead"(id) ON DELETE CASCADE,
    mentioned_user_ids JSONB DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS "auditlog" (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMP WITHOUT TIME ZONE DEFAULT (now() AT TIME ZONE 'utc'),
    lead_id INTEGER NOT NULL REFERENCES "lead"(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES "user"(id),
    action_type VARCHAR NOT NULL,
    description TEXT,
    old_value TEXT,
    new_value TEXT
);

-- ==========================================
-- 6. UNIVERSAL APPROVAL REQUESTS
-- ==========================================
CREATE TABLE IF NOT EXISTS "approvalrequest" (
    id SERIAL PRIMARY KEY,
    requested_by_id INTEGER NOT NULL REFERENCES "user"(id),
    lead_id INTEGER REFERENCES "lead"(id) ON DELETE CASCADE,
    student_id INTEGER REFERENCES "student"(id) ON DELETE CASCADE,
    request_type VARCHAR NOT NULL,
    current_value VARCHAR DEFAULT '',
    requested_value VARCHAR DEFAULT '',
    reason TEXT DEFAULT '',
    status VARCHAR DEFAULT 'pending',
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT (now() AT TIME ZONE 'utc'),
    resolved_at TIMESTAMP WITHOUT TIME ZONE,
    resolved_by_id INTEGER REFERENCES "user"(id)
);
CREATE INDEX IF NOT EXISTS idx_approvalrequest_status ON "approvalrequest"(status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_approvalrequest_type ON "approvalrequest"(request_type);

-- ==========================================
-- 6b. NOTIFICATIONS (in-app bell, center-scoped, high/low priority)
-- ==========================================
CREATE TABLE IF NOT EXISTS "notification" (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    type VARCHAR NOT NULL,
    title VARCHAR(255) NOT NULL,
    message VARCHAR(2000) NOT NULL,
    link VARCHAR(500),
    target_url VARCHAR(500),
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT (now() AT TIME ZONE 'utc'),
    center_id INTEGER REFERENCES "center"(id) ON DELETE SET NULL,
    priority VARCHAR(10) NOT NULL DEFAULT 'low'
);
CREATE INDEX IF NOT EXISTS ix_notification_user_id ON "notification"(user_id);
CREATE INDEX IF NOT EXISTS ix_notification_type ON "notification"(type);
CREATE INDEX IF NOT EXISTS ix_notification_created_at ON "notification"(created_at);
CREATE INDEX IF NOT EXISTS ix_notification_center_id ON "notification"(center_id);
CREATE INDEX IF NOT EXISTS ix_notification_priority ON "notification"(priority);

-- Migration: Drop old tables if they exist (run manually if migrating from very old schema)
-- DROP TABLE IF EXISTS "statuschangerequest" CASCADE;
-- DROP TABLE IF EXISTS "agecategorychangerequest" CASCADE;
-- DROP TABLE IF EXISTS "centertransferrequest" CASCADE;
-- DROP TABLE IF EXISTS "deactivatestudentrequest" CASCADE;

-- ==========================================
-- 7. ATTENDANCE
-- ==========================================
CREATE TABLE IF NOT EXISTS "attendance" (
    id SERIAL PRIMARY KEY,
    lead_id INTEGER REFERENCES "lead"(id) ON DELETE CASCADE,
    student_id INTEGER REFERENCES "student"(id) ON DELETE CASCADE,
    batch_id INTEGER NOT NULL REFERENCES "batch"(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES "user"(id),
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    status VARCHAR NOT NULL,
    remarks TEXT,
    recorded_at TIMESTAMP WITHOUT TIME ZONE DEFAULT (now() AT TIME ZONE 'utc')
);

-- ==========================================
-- 8. SKILL EVALUATIONS
-- ==========================================
CREATE TABLE IF NOT EXISTS "skillevaluation" (
    id SERIAL PRIMARY KEY,
    lead_id INTEGER NOT NULL REFERENCES "lead"(id) ON DELETE CASCADE,
    coach_id INTEGER NOT NULL REFERENCES "user"(id),
    technical_score INTEGER NOT NULL CHECK (technical_score >= 1 AND technical_score <= 5),
    fitness_score INTEGER NOT NULL CHECK (fitness_score >= 1 AND fitness_score <= 5),
    teamwork_score INTEGER NOT NULL CHECK (teamwork_score >= 1 AND teamwork_score <= 5),
    discipline_score INTEGER NOT NULL CHECK (discipline_score >= 1 AND discipline_score <= 5),
    coach_notes TEXT,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT (now() AT TIME ZONE 'utc')
);

-- ==========================================
-- 9. LEAD STAGING (FIELD CAPTURES)
-- ==========================================
CREATE TABLE IF NOT EXISTS "leadstaging" (
    id SERIAL PRIMARY KEY,
    player_name VARCHAR NOT NULL,
    phone VARCHAR NOT NULL,
    email VARCHAR,
    age INTEGER,
    date_of_birth DATE,
    center_id INTEGER NOT NULL REFERENCES "center"(id) ON DELETE CASCADE,
    created_by_id INTEGER REFERENCES "user"(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT (now() AT TIME ZONE 'utc')
);

-- ==========================================
-- 10. INDEXES
-- ==========================================
CREATE INDEX IF NOT EXISTS idx_lead_status ON "lead"(status);
CREATE INDEX IF NOT EXISTS idx_lead_phone ON "lead"(phone);
CREATE INDEX IF NOT EXISTS idx_lead_token ON "lead"(public_token);
CREATE INDEX IF NOT EXISTS idx_lead_center_id ON "lead"(center_id);
CREATE INDEX IF NOT EXISTS idx_lead_next_followup ON "lead"(next_followup_date) WHERE next_followup_date IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_student_lead_id ON "student"(lead_id);
CREATE INDEX IF NOT EXISTS idx_student_center_id ON "student"(center_id);
CREATE INDEX IF NOT EXISTS idx_student_is_active ON "student"(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_student_renewal_intent ON "student"(renewal_intent) WHERE renewal_intent = TRUE;
CREATE INDEX IF NOT EXISTS idx_student_grace_period ON "student"(in_grace_period) WHERE in_grace_period = TRUE;

CREATE INDEX IF NOT EXISTS idx_attendance_date ON "attendance"(date);
CREATE INDEX IF NOT EXISTS idx_attendance_student_id ON "attendance"(student_id);
CREATE INDEX IF NOT EXISTS idx_attendance_batch_id ON "attendance"(batch_id);
CREATE INDEX IF NOT EXISTS idx_attendance_lead_id ON "attendance"(lead_id) WHERE lead_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_auditlog_lead_id ON "auditlog"(lead_id);
CREATE INDEX IF NOT EXISTS idx_auditlog_lead_timestamp ON "auditlog"(lead_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_auditlog_timestamp ON "auditlog"(timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_batch_schedule ON "batch"(is_mon, is_tue, is_wed, is_thu, is_fri, is_sat, is_sun);
CREATE INDEX IF NOT EXISTS idx_batch_center_id ON "batch"(center_id);
CREATE INDEX IF NOT EXISTS idx_batch_is_active ON "batch"(is_active) WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_leadstaging_center ON "leadstaging"(center_id);
CREATE INDEX IF NOT EXISTS idx_leadstaging_name_phone ON "leadstaging"(player_name, phone);

-- (notification indexes are created with the table above)

-- ==========================================
-- MIGRATIONS (for existing databases - add missing columns)
-- ==========================================
DO $$
BEGIN
  -- User: phone (staff contact for Center Head)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='user') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='user' AND column_name='phone') THEN
      ALTER TABLE "user" ADD COLUMN phone VARCHAR;
    END IF;
  END IF;

  -- Center: map_link (Google Maps URL for parent-facing pages); group_email (Center Head email for internal notifications)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='center') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='center' AND column_name='map_link') THEN
      ALTER TABLE "center" ADD COLUMN map_link VARCHAR;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='center' AND column_name='group_email') THEN
      ALTER TABLE "center" ADD COLUMN group_email VARCHAR;
    END IF;
  END IF;

  -- Batch: min_age, max_age; drop old age_category
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='batch') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='batch' AND column_name='min_age') THEN
      ALTER TABLE "batch" ADD COLUMN min_age INTEGER NOT NULL DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='batch' AND column_name='max_age') THEN
      ALTER TABLE "batch" ADD COLUMN max_age INTEGER NOT NULL DEFAULT 99;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='batch' AND column_name='age_category') THEN
      ALTER TABLE "batch" DROP COLUMN age_category;
    END IF;
  END IF;

  -- Lead: preferences_submitted (submit-once); drop old player_age_category; needs_escalation (nudge failures)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='lead') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='lead' AND column_name='preferences_submitted') THEN
      ALTER TABLE "lead" ADD COLUMN preferences_submitted BOOLEAN DEFAULT FALSE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='lead' AND column_name='needs_escalation') THEN
      ALTER TABLE "lead" ADD COLUMN needs_escalation BOOLEAN DEFAULT FALSE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='lead' AND column_name='status_at_loss') THEN
      ALTER TABLE "lead" ADD COLUMN status_at_loss VARCHAR;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='lead' AND column_name='player_age_category') THEN
      ALTER TABLE "lead" DROP COLUMN player_age_category;
    END IF;
    -- Enrollment pipeline
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='lead' AND column_name='enrollment_link_sent_at') THEN
      ALTER TABLE "lead" ADD COLUMN enrollment_link_sent_at TIMESTAMP WITHOUT TIME ZONE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='lead' AND column_name='link_expires_at') THEN
      ALTER TABLE "lead" ADD COLUMN link_expires_at TIMESTAMP WITHOUT TIME ZONE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='lead' AND column_name='pending_subscription_data') THEN
      ALTER TABLE "lead" ADD COLUMN pending_subscription_data JSONB;
    END IF;
  END IF;

  -- LeadStaging: age; date_of_birth; drop old player_age_category
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='leadstaging') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='leadstaging' AND column_name='age') THEN
      ALTER TABLE "leadstaging" ADD COLUMN age INTEGER;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='leadstaging' AND column_name='date_of_birth') THEN
      ALTER TABLE "leadstaging" ADD COLUMN date_of_birth DATE;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='leadstaging' AND column_name='player_age_category') THEN
      ALTER TABLE "leadstaging" DROP COLUMN player_age_category;
    END IF;
  END IF;

  -- ApprovalRequest: current_value, requested_value; migrate AGE_CATEGORY -> AGE_GROUP
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='approvalrequest') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='approvalrequest' AND column_name='current_value') THEN
      ALTER TABLE approvalrequest ADD COLUMN current_value VARCHAR DEFAULT '';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='approvalrequest' AND column_name='requested_value') THEN
      ALTER TABLE approvalrequest ADD COLUMN requested_value VARCHAR DEFAULT '';
    END IF;
    UPDATE approvalrequest SET request_type = 'AGE_GROUP' WHERE request_type = 'AGE_CATEGORY';
  END IF;

  -- Notification: center_id (role-based filter), priority (high/low)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='notification') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='notification' AND column_name='center_id') THEN
      ALTER TABLE "notification" ADD COLUMN center_id INTEGER REFERENCES "center"(id) ON DELETE SET NULL;
      CREATE INDEX IF NOT EXISTS ix_notification_center_id ON "notification"(center_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='notification' AND column_name='priority') THEN
      ALTER TABLE "notification" ADD COLUMN priority VARCHAR(10) NOT NULL DEFAULT 'low';
      CREATE INDEX IF NOT EXISTS ix_notification_priority ON "notification"(priority);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='notification' AND column_name='target_url') THEN
      ALTER TABLE "notification" ADD COLUMN target_url VARCHAR(500);
    END IF;
  END IF;

  -- Student: parent-reported payment and enrollment fields
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='student') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='student' AND column_name='utr_number') THEN
      ALTER TABLE "student" ADD COLUMN utr_number VARCHAR;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='student' AND column_name='is_payment_verified') THEN
      ALTER TABLE "student" ADD COLUMN is_payment_verified BOOLEAN NOT NULL DEFAULT FALSE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='student' AND column_name='kit_size') THEN
      ALTER TABLE "student" ADD COLUMN kit_size VARCHAR;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='student' AND column_name='medical_info') THEN
      ALTER TABLE "student" ADD COLUMN medical_info TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='student' AND column_name='secondary_contact') THEN
      ALTER TABLE "student" ADD COLUMN secondary_contact VARCHAR;
    END IF;
  END IF;
END $$;

-- ==========================================
-- FIX: org_id (Supabase adds it; our app does not use it)
-- ==========================================
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (SELECT table_name FROM information_schema.columns WHERE table_schema='public' AND column_name='org_id')
  LOOP
    BEGIN
      EXECUTE format('ALTER TABLE %I ALTER COLUMN org_id DROP NOT NULL', r.table_name);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END LOOP;
END $$;
