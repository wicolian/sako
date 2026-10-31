#!/usr/bin/env bash
# Run Supabase migrations (067 + 068) against remote or local database.
#
# Option A - Linked project:
#   supabase login   # one-time
#   supabase link    # one-time: project ref + db password
#   bun run db:migrate
#
# Option B - Direct database URL:
#   Add DATABASE_URL to .env.local (from Supabase Dashboard → Database → Connection string)
#   bun run db:migrate
#
# Get DATABASE_URL from: Supabase Dashboard → Project Settings → Database → Connection string (URI)

set -e

cd "$(dirname "$0")/.."

# Load .env.local if present (for DATABASE_URL)
if [ -f .env.local ]; then
  set -a
  source .env.local 2>/dev/null || true
  set +a
fi

if [ -n "$DATABASE_URL" ]; then
  echo "Pushing migrations via DATABASE_URL..."
  supabase db push --db-url "$DATABASE_URL"
else
  echo "Pushing migrations to linked project (run 'supabase link' if not yet linked)..."
  if supabase db push; then
    echo "Migrations applied successfully."
  else
    echo ""
    echo "Either:"
    echo "  1. Run: supabase login && supabase link"
    echo "     Then: bun run db:migrate"
    echo ""
    echo "  2. Add DATABASE_URL to .env.local and run: bun run db:migrate"
    echo "     Get it from: Supabase Dashboard → Project Settings → Database → Connection string (URI)"
    exit 1
  fi
fi
