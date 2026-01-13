-- ==========================================
-- 1. CORE IDENTITY & ACCESS SYSTEM
-- ==========================================
CREATE TABLE IF NOT EXISTS "user" (
    id SERIAL PRIMARY KEY,
    email VARCHAR NOT NULL UNIQUE,
    hashed_password VARCHAR NOT NULL,
    full_name VARCHAR NOT NULL,
    role VARCHAR NOT NULL DEFAULT 'team_member', -- Roles: 'team_lead', 'team_member', 'coach', 'observer'
    is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS "center" (
    id SERIAL PRIMARY KEY,
    display_name VARCHAR NOT NULL,
    meta_tag_name VARCHAR NOT NULL UNIQUE,
    city VARCHAR NOT NULL,
    location VARCHAR NOT NULL
);

-- Many-to-Many: Staff access to Centers
CREATE TABLE IF NOT EXISTS "usercenterlink" (
    user_id INTEGER NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    center_id INTEGER NOT NULL REFERENCES "center"(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, center_id)
);

-- ==========================================
-- 2. RESOURCE MANAGEMENT (BATCHES)
-- ==========================================
CREATE TABLE IF NOT EXISTS "batch" (
    id SERIAL PRIMARY KEY,
    name VARCHAR NOT NULL,
    center_id INTEGER NOT NULL REFERENCES "center"(id) ON DELETE CASCADE,
    age_category VARCHAR NOT NULL, 
    max_capacity INTEGER DEFAULT 20,
    is_active BOOLEAN DEFAULT TRUE,
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    
    -- Seven-Boolean Schedule
    is_mon BOOLEAN DEFAULT FALSE, is_tue BOOLEAN DEFAULT FALSE, is_wed BOOLEAN DEFAULT FALSE,
    is_thu BOOLEAN DEFAULT FALSE, is_fri BOOLEAN DEFAULT FALSE, is_sat BOOLEAN DEFAULT FALSE,
    is_sun BOOLEAN DEFAULT FALSE,
    
    start_time TIME,
    end_time TIME
);

-- Many-to-Many: Coaches assigned to training Batches
CREATE TABLE IF NOT EXISTS "batchcoachlink" (
    user_id INTEGER NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    batch_id INTEGER NOT NULL REFERENCES "batch"(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, batch_id)
);

-- ==========================================
-- 3. SALES PIPELINE (LEADS)
-- ==========================================
CREATE TABLE IF NOT EXISTS "lead" (
    id SERIAL PRIMARY KEY,
    created_time TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT (now() at time zone 'utc'),
    last_updated TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT (now() at time zone 'utc'),
    public_token UUID UNIQUE DEFAULT gen_random_uuid(),
    
    -- Player Info
    player_name VARCHAR NOT NULL,
    player_age_category VARCHAR NOT NULL,
    date_of_birth DATE NULL,
    
    -- Contact (Masked for Coaches)
    phone VARCHAR NOT NULL,
    email VARCHAR,
    address VARCHAR,
    
    -- Pipeline Logic
    status VARCHAR NOT NULL DEFAULT 'New',
    next_followup_date TIMESTAMP WITHOUT TIME ZONE,
    score INTEGER DEFAULT 0,
    nudge_count INTEGER NOT NULL DEFAULT 0,
    do_not_contact BOOLEAN DEFAULT FALSE,
    
    -- Parent Preferences (Self-Service)
    preferred_batch_id INTEGER REFERENCES "batch"(id) ON DELETE SET NULL,
    preferred_call_time VARCHAR,
    preferred_timing_notes TEXT,
    
    -- Outcomes & Quality
    loss_reason VARCHAR,
    loss_reason_notes TEXT,
    reschedule_count INTEGER DEFAULT 0,
    call_confirmation_note TEXT,
    
    -- Location/Trial Data
    center_id INTEGER REFERENCES "center"(id) ON DELETE SET NULL,
    trial_batch_id INTEGER REFERENCES "batch"(id) ON DELETE SET NULL,
    
    -- JSONB for Skills/Extensible data
    extra_data JSONB DEFAULT '{}'
);

-- ==========================================
-- 4. ACTIVE MEMBERSHIP (STUDENTS)
-- ==========================================
CREATE TABLE IF NOT EXISTS "student" (
    id SERIAL PRIMARY KEY,
    lead_id INTEGER NOT NULL UNIQUE REFERENCES lead(id) ON DELETE CASCADE,
    center_id INTEGER NOT NULL REFERENCES center(id) ON DELETE RESTRICT,
    
    -- Subscription Details
    subscription_plan VARCHAR(50) NOT NULL, -- 'Monthly', 'Quarterly', etc.
    subscription_start_date DATE NOT NULL,
    subscription_end_date DATE NULL,
    
    -- Renewal & Grace Period Tracking
    renewal_intent BOOLEAN DEFAULT FALSE,
    in_grace_period BOOLEAN DEFAULT FALSE,
    grace_nudge_count INTEGER NOT NULL DEFAULT 0,
    
    -- Payment & Status
    payment_proof_url VARCHAR(500) NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Many-to-Many: Active Students to multiple training Batches
CREATE TABLE IF NOT EXISTS "studentbatchlink" (
    student_id INTEGER NOT NULL REFERENCES "student"(id) ON DELETE CASCADE,
    batch_id INTEGER NOT NULL REFERENCES "batch"(id) ON DELETE CASCADE,
    PRIMARY KEY (student_id, batch_id)
);

-- ==========================================
-- 5. OPERATIONS & GOVERNANCE
-- ==========================================
CREATE TABLE IF NOT EXISTS "attendance" (
    id SERIAL PRIMARY KEY,
    lead_id INTEGER REFERENCES "lead"(id) ON DELETE CASCADE, -- For Demo/Trials
    student_id INTEGER REFERENCES "student"(id) ON DELETE CASCADE, -- For Active Students
    batch_id INTEGER NOT NULL REFERENCES "batch"(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES "user"(id), -- Coach
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    status VARCHAR NOT NULL, -- 'Present', 'Absent'
    remarks TEXT,
    recorded_at TIMESTAMP WITHOUT TIME ZONE DEFAULT (now() at time zone 'utc')
);

CREATE TABLE IF NOT EXISTS "statuschangerequest" (
    id SERIAL PRIMARY KEY,
    lead_id INTEGER NOT NULL REFERENCES "lead"(id) ON DELETE CASCADE,
    requested_by_id INTEGER NOT NULL REFERENCES "user"(id),
    current_status VARCHAR NOT NULL,
    requested_status VARCHAR NOT NULL,
    reason TEXT,
    request_status VARCHAR DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolved_by_id INTEGER REFERENCES "user"(id)
);

CREATE TABLE IF NOT EXISTS "comment" (
    id SERIAL PRIMARY KEY,
    text TEXT NOT NULL,
    timestamp TIMESTAMP WITHOUT TIME ZONE DEFAULT (now() at time zone 'utc'),
    user_id INTEGER NOT NULL REFERENCES "user"(id),
    lead_id INTEGER NOT NULL REFERENCES "lead"(id) ON DELETE CASCADE,
    mentioned_user_ids JSONB DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS "auditlog" (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMP WITHOUT TIME ZONE DEFAULT (now() at time zone 'utc'),
    lead_id INTEGER NOT NULL REFERENCES "lead"(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES "user"(id),
    action_type VARCHAR NOT NULL,
    description TEXT,
    old_value TEXT,
    new_value TEXT
);

-- ==========================================
-- 6. ALL PERFORMANCE & CONDITIONAL INDEXES
-- ==========================================

-- Standard Lookup Indexes
CREATE INDEX IF NOT EXISTS idx_lead_status ON "lead"(status);
CREATE INDEX IF NOT EXISTS idx_lead_phone ON "lead"(phone);
CREATE INDEX IF NOT EXISTS idx_lead_token ON "lead"(public_token);
CREATE INDEX IF NOT EXISTS idx_student_lead_id ON "student"(lead_id);
CREATE INDEX IF NOT EXISTS idx_student_center_id ON "student"(center_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON "attendance"(date);
CREATE INDEX IF NOT EXISTS idx_attendance_student_id ON "attendance"(student_id);
CREATE INDEX IF NOT EXISTS idx_audit_lead_id ON "auditlog"(lead_id);
CREATE INDEX IF NOT EXISTS idx_batch_schedule ON "batch"(is_mon, is_tue, is_wed, is_thu, is_fri, is_sat, is_sun);

-- High-Intelligence Conditional Indexes
CREATE INDEX IF NOT EXISTS idx_student_renewal_intent 
ON "student"(renewal_intent) WHERE renewal_intent = TRUE;

CREATE INDEX IF NOT EXISTS idx_student_grace_period 
ON "student"(in_grace_period) WHERE in_grace_period = TRUE;

CREATE INDEX IF NOT EXISTS idx_student_is_active 
ON "student"(is_active) WHERE is_active = TRUE;

-- Composite Index for faster activity feeds
CREATE INDEX IF NOT EXISTS idx_audit_lead_timestamp 
ON "auditlog"(lead_id, timestamp DESC);