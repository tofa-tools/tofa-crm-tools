-- ==========================================
-- 1. CORE USER & ACCESS SYSTEM
-- ==========================================
CREATE TABLE IF NOT EXISTS "user" (
    id SERIAL PRIMARY KEY,
    email VARCHAR NOT NULL UNIQUE,
    hashed_password VARCHAR NOT NULL,
    full_name VARCHAR NOT NULL,
    role VARCHAR NOT NULL DEFAULT 'regular_user', -- 'team_lead', 'regular_user', 'coach'
    is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS "center" (
    id SERIAL PRIMARY KEY,
    display_name VARCHAR NOT NULL,
    meta_tag_name VARCHAR NOT NULL UNIQUE,
    city VARCHAR NOT NULL,
    location VARCHAR NOT NULL
);

-- Join table for Users (Sales/Coaches) assigned to Centers
CREATE TABLE IF NOT EXISTS "usercenterlink" (
    user_id INTEGER NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    center_id INTEGER NOT NULL REFERENCES "center"(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, center_id)
);

-- ==========================================
-- 2. BATCH MANAGEMENT SYSTEM (The "Resource" Layer)
-- ==========================================
CREATE TABLE IF NOT EXISTS "batch" (
    id SERIAL PRIMARY KEY,
    name VARCHAR NOT NULL,
    center_id INTEGER NOT NULL REFERENCES "center"(id) ON DELETE CASCADE,
    age_category VARCHAR NOT NULL, -- e.g., 'U9', 'U11'
    max_capacity INTEGER DEFAULT 20,
    
    -- Seven-Boolean Schedule
    is_mon BOOLEAN DEFAULT FALSE,
    is_tue BOOLEAN DEFAULT FALSE,
    is_wed BOOLEAN DEFAULT FALSE,
    is_thu BOOLEAN DEFAULT FALSE,
    is_fri BOOLEAN DEFAULT FALSE,
    is_sat BOOLEAN DEFAULT FALSE,
    is_sun BOOLEAN DEFAULT FALSE,
    
    start_time TIME, -- e.g., '17:00:00'
    end_time TIME    -- e.g., '18:30:00'
);

-- Linking Coaches to specific Batches
CREATE TABLE IF NOT EXISTS "batchcoachlink" (
    user_id INTEGER NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    batch_id INTEGER NOT NULL REFERENCES "batch"(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, batch_id)
);

-- ==========================================
-- 3. ENHANCED LEAD SYSTEM (The "Sales" Layer)
-- ==========================================
CREATE TABLE IF NOT EXISTS "lead" (
    id SERIAL PRIMARY KEY,
    created_time TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT (now() at time zone 'utc'),
    last_updated TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT (now() at time zone 'utc'),
    
    -- Player Info
    player_name VARCHAR NOT NULL,
    player_age_category VARCHAR NOT NULL,
    date_of_birth DATE NULL, -- For age migration logic
    
    -- Contact Info (Sensitive - Hidden from Coaches)
    phone VARCHAR NOT NULL,
    email VARCHAR,
    address VARCHAR,
    
    -- Status & Workflow
    status VARCHAR NOT NULL DEFAULT 'New',
    next_followup_date TIMESTAMP WITHOUT TIME ZONE,
    score INTEGER DEFAULT 0, -- Auto-calculated (0-5 stars)
    extra_data JSONB DEFAULT '{}', -- For Skill Reports and extensible data (renamed from metadata to avoid SQLAlchemy conflict)
    
    -- Relationship & Batching
    center_id INTEGER REFERENCES "center"(id) ON DELETE SET NULL,
    trial_batch_id INTEGER REFERENCES "batch"(id) ON DELETE SET NULL,
    permanent_batch_id INTEGER REFERENCES "batch"(id) ON DELETE SET NULL
);

-- ==========================================
-- 4. COMMUNICATION & AUDIT (The "History" Layer)
-- ==========================================
CREATE TABLE IF NOT EXISTS "comment" (
    id SERIAL PRIMARY KEY,
    text TEXT NOT NULL,
    timestamp TIMESTAMP WITHOUT TIME ZONE DEFAULT (now() at time zone 'utc'),
    user_id INTEGER NOT NULL REFERENCES "user"(id),
    lead_id INTEGER NOT NULL REFERENCES "lead"(id) ON DELETE CASCADE,
    mentioned_user_ids JSONB DEFAULT '[]' -- Stores IDs of @mentioned users
);

CREATE TABLE IF NOT EXISTS "auditlog" (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMP WITHOUT TIME ZONE DEFAULT (now() at time zone 'utc'),
    lead_id INTEGER NOT NULL REFERENCES "lead"(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES "user"(id), -- Who made the change
    action_type VARCHAR NOT NULL, -- 'status_change', 'batch_update', 'field_update', 'duplicate_merge'
    description TEXT,
    old_value TEXT,
    new_value TEXT
);

-- ==========================================
-- 5. ATTENDANCE SYSTEM (The "Operations" Layer)
-- ==========================================
CREATE TABLE IF NOT EXISTS "attendance" (
    id SERIAL PRIMARY KEY,
    lead_id INTEGER NOT NULL REFERENCES "lead"(id) ON DELETE CASCADE,
    batch_id INTEGER NOT NULL REFERENCES "batch"(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES "user"(id), -- Coach who took attendance
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    status VARCHAR NOT NULL, -- 'Present', 'Absent', 'Excused', 'Late'
    remarks TEXT,
    recorded_at TIMESTAMP WITHOUT TIME ZONE DEFAULT (now() at time zone 'utc')
);

-- ==========================================
-- 6. PERFORMANCE INDEXES
-- ==========================================
CREATE INDEX IF NOT EXISTS idx_lead_status ON "lead" (status);
CREATE INDEX IF NOT EXISTS idx_lead_phone ON "lead" (phone);
CREATE INDEX IF NOT EXISTS idx_audit_lead_id ON "auditlog" (lead_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON "attendance" (date);
CREATE INDEX IF NOT EXISTS idx_batch_schedule ON "batch" (is_mon, is_tue, is_wed, is_thu, is_fri, is_sat, is_sun);


-- 1. Change the default for future users so they aren't 'regular_user'
ALTER TABLE "user" ALTER COLUMN "role" SET DEFAULT 'team_member';

-- 2. Update all existing 'regular_users' to 'team_member'
UPDATE "user" SET "role" = 'team_member' WHERE "role" = 'regular_user';

-- 3. Update the 'lead' table if any hardcoded defaults exist there (usually not needed but safe)
UPDATE "lead" SET status = 'New' WHERE status = 'regular_user';