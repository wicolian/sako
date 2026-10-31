-- =============================================================================
-- Neon Database Setup Script
-- Purpose: Initialize Neon database with pgvector and required schema
-- Usage: psql [NEON_CONNECTION_STRING] -f scripts/setup-neon.sql
-- =============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;

-- Verify extensions
SELECT extname, extversion FROM pg_extension WHERE extname IN ('uuid-ossp', 'vector');

-- =============================================================================
-- Import all migrations from Supabase
-- These are the same migrations, they work on any PostgreSQL with pgvector
-- =============================================================================

-- Note: Run the migration files in order after this setup script:
-- psql [NEON_CONNECTION_STRING] -f supabase/migrations/001_initial_schema.sql
-- ... (all migrations up to 039)

-- Or use the concatenated approach:
-- cat supabase/migrations/*.sql | psql [NEON_CONNECTION_STRING]

SELECT 'Neon setup complete! Now run the migrations.' as status;
