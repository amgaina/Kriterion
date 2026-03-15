# Reset database and create a new one

## Option A: All from your terminal (one script)

From the **project root** in your terminal:

```bash
./scripts/reset-db-and-migrate.sh
```

Requirements:
- `DATABASE_URL` in `backend/.env` (or exported).
- `psql` in PATH (or the script will use Python + psycopg2 from `backend/.venv`).

This does: (1) drop and recreate `public` schema, (2) run migrations, (3) seed.

---

## Option B: Run steps one by one in the terminal

From the **project root**:

**Step 1 — Reset the schema** (needs `psql` and `DATABASE_URL` from `backend/.env`):

```bash
cd backend && set -a && source .env && set +a && cd ..
psql "$DATABASE_URL" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO postgres; GRANT ALL ON SCHEMA public TO public;"
```

**Step 2 — Run migrations:**

```bash
make migrate-local
```

**Step 3 — Seed:**

```bash
make seed-local
```

---

## Option C: Supabase SQL Editor + terminal

1. In [Supabase](https://supabase.com/dashboard) → your project → **SQL Editor**, run:

```sql
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;
```

2. In your terminal from project root:

```bash
make migrate-local
make seed-local
```

---

## Docker (local Postgres)

```bash
docker-compose down -v
docker-compose up -d db
# Wait ~5 seconds, then:
make migrate
make seed
```
