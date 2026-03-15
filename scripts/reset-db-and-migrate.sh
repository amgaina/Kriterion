#!/usr/bin/env bash
# Drop the database (public schema), run migrations, and seed. All from the terminal.
# Run from project root:  make reset-db   or   ./scripts/reset-db-and-migrate.sh
# Requires: DATABASE_URL in backend/.env (or .env at project root). Uses psql if in PATH, else Python.

set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# Load DATABASE_URL from backend/.env or .env
if [ -f backend/.env ]; then
  set -a
  # shellcheck source=/dev/null
  source backend/.env 2>/dev/null || true
  set +a
fi
if [ -z "$DATABASE_URL" ] && [ -f .env ]; then
  set -a
  # shellcheck source=/dev/null
  source .env 2>/dev/null || true
  set +a
fi

if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: DATABASE_URL is not set. Add it to backend/.env or .env"
  exit 1
fi

echo "Step 1: Dropping database (public schema)..."
if command -v psql &>/dev/null; then
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO postgres; GRANT ALL ON SCHEMA public TO public;"
else
  echo "psql not found, using Python..."
  if [ -x backend/.venv/bin/python ]; then
    backend/.venv/bin/python -c "
import os, sys
from dotenv import load_dotenv
load_dotenv(os.path.join('backend', '.env')) or load_dotenv('.env')
url = os.environ.get('DATABASE_URL')
if not url:
    print('DATABASE_URL not set', file=sys.stderr)
    sys.exit(1)
import psycopg2
conn = psycopg2.connect(url)
conn.autocommit = True
cur = conn.cursor()
cur.execute('DROP SCHEMA public CASCADE;')
cur.execute('CREATE SCHEMA public;')
cur.execute('GRANT ALL ON SCHEMA public TO postgres;')
cur.execute('GRANT ALL ON SCHEMA public TO public;')
cur.close()
conn.close()
print('Schema reset OK')
"
  else
    echo "ERROR: Install psql (PostgreSQL client) or ensure backend/.venv exists with psycopg2."
    exit 1
  fi
fi

echo "Step 2: Running migrations..."
make migrate-local

echo "Step 3: Seeding database..."
make seed-local

echo "Done. Database reset, migrated, and seeded."
