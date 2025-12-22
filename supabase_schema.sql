-- COPY AND PASTE THIS INTO THE SUPABASE SQL EDITOR --

-- 1. Create Users Table
CREATE TABLE IF NOT EXISTS "user" (
    id SERIAL PRIMARY KEY,
    email VARCHAR NOT NULL UNIQUE,
    hashed_password VARCHAR NOT NULL,
    full_name VARCHAR NOT NULL,
    role VARCHAR NOT NULL DEFAULT 'team_member'
);

-- 2. Create Centers Table
CREATE TABLE IF NOT EXISTS "center" (
    id SERIAL PRIMARY KEY,
    display_name VARCHAR NOT NULL,
    meta_tag_name VARCHAR NOT NULL UNIQUE,
    city VARCHAR NOT NULL,
    location VARCHAR NOT NULL
);

-- 3. Create Join Table (User <-> Center)
CREATE TABLE IF NOT EXISTS "usercenterlink" (
    user_id INTEGER NOT NULL,
    center_id INTEGER NOT NULL,
    PRIMARY KEY (user_id, center_id),
    FOREIGN KEY (user_id) REFERENCES "user"(id) ON DELETE CASCADE,
    FOREIGN KEY (center_id) REFERENCES "center"(id) ON DELETE CASCADE
);

-- 4. Create Leads Table
CREATE TABLE IF NOT EXISTS "lead" (
    id SERIAL PRIMARY KEY,
    created_time TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    player_name VARCHAR NOT NULL,
    player_age_category VARCHAR NOT NULL,
    phone VARCHAR NOT NULL,
    email VARCHAR,
    address VARCHAR,
    status VARCHAR NOT NULL DEFAULT 'New',
    next_followup_date TIMESTAMP WITHOUT TIME ZONE,
    center_id INTEGER,
    FOREIGN KEY (center_id) REFERENCES "center"(id) ON DELETE SET NULL
);

-- 5. Create Comments Table
CREATE TABLE IF NOT EXISTS "comment" (
    id SERIAL PRIMARY KEY,
    text VARCHAR NOT NULL,
    timestamp TIMESTAMP WITHOUT TIME ZONE DEFAULT (now() at time zone 'utc'),
    user_id INTEGER NOT NULL,
    lead_id INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES "user"(id) ON DELETE CASCADE,
    FOREIGN KEY (lead_id) REFERENCES "lead"(id) ON DELETE CASCADE
);

-- 6. Create Indexes for Speed
CREATE INDEX IF NOT EXISTS idx_user_email ON "user" (email);
CREATE INDEX IF NOT EXISTS idx_center_meta ON "center" (meta_tag_name);