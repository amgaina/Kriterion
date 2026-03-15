"""
Drop public schema and recreate it. Loads DATABASE_URL from backend/.env or project .env.
Run from project root:  python backend/scripts/reset_schema.py
Or from backend:        python scripts/reset_schema.py
"""
import os
import sys

# Allow running from project root or backend
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)
root_dir = os.path.dirname(backend_dir)
os.chdir(root_dir)

from dotenv import load_dotenv

load_dotenv(os.path.join(backend_dir, ".env"))
load_dotenv(os.path.join(root_dir, ".env"))

url = os.environ.get("DATABASE_URL")
if not url:
    print("ERROR: DATABASE_URL not set. Add it to backend/.env or .env", file=sys.stderr)
    sys.exit(1)

import psycopg2

conn = psycopg2.connect(url)
conn.autocommit = True
cur = conn.cursor()
cur.execute("DROP SCHEMA public CASCADE;")
cur.execute("CREATE SCHEMA public;")
cur.execute("GRANT ALL ON SCHEMA public TO postgres;")
cur.execute("GRANT ALL ON SCHEMA public TO public;")
cur.close()
conn.close()
print("Schema reset OK.")
