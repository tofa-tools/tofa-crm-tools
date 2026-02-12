# Database schema

**Single source of truth: `main_schema.sql`** (at repo root). There are no separate migration files.

- Run **`main_schema.sql`** in the Supabase SQL Editor or: `psql $DATABASE_URL -f main_schema.sql`
- It creates all tables (including `notification`) and runs migrations for existing DBs (adds missing columns).
