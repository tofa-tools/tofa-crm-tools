-- Create SkillEvaluation Table for cumulative reports
-- NOTE: Field names must match the Python model exactly (with _score suffix)

CREATE TABLE IF NOT EXISTS "skillevaluation" (
    id SERIAL PRIMARY KEY,
    lead_id INTEGER NOT NULL REFERENCES "lead"(id) ON DELETE CASCADE,
    coach_id INTEGER NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    technical_score INTEGER NOT NULL CHECK (technical_score BETWEEN 1 AND 5),
    fitness_score INTEGER NOT NULL CHECK (fitness_score BETWEEN 1 AND 5),
    teamwork_score INTEGER NOT NULL CHECK (teamwork_score BETWEEN 1 AND 5),
    discipline_score INTEGER NOT NULL CHECK (discipline_score BETWEEN 1 AND 5),
    coach_notes TEXT,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT (now() AT TIME ZONE 'utc')
);

CREATE INDEX IF NOT EXISTS idx_skillevaluation_lead ON "skillevaluation" (lead_id);
CREATE INDEX IF NOT EXISTS idx_skillevaluation_coach ON "skillevaluation" (coach_id);

-- Create LeadStaging Table for Coach Walk-ins

CREATE TABLE IF NOT EXISTS "leadstaging" (
    id SERIAL PRIMARY KEY,
    player_name VARCHAR NOT NULL,
    date_of_birth DATE,
    phone VARCHAR NOT NULL,
    center_id INTEGER NOT NULL REFERENCES "center"(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT (now() AT TIME ZONE 'utc')
);

-- Add an index for performance
CREATE INDEX IF NOT EXISTS idx_leadstaging_center ON "leadstaging" (center_id);

