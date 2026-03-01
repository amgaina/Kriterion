# Kriterion - Production Deployment Guide

This guide covers deploying Kriterion with:
- **Frontend**: Vercel
- **Backend**: Render
- **Redis**: Redis Cloud
- **Object Storage**: AWS S3
- **Database**: Render PostgreSQL (or Neon / Supabase)

---

## 1. Prerequisites

- GitHub repo with Kriterion code
- AWS account (for S3)
- [Redis Cloud](https://redis.com/try-free/) account
- [Vercel](https://vercel.com) account
- [Render](https://render.com) account

---

## 2. Database (PostgreSQL)

**Option A: Render PostgreSQL**
1. Render Dashboard → New → PostgreSQL
2. Create database, note: **Internal Database URL** (for Render services) or **External Database URL** (if connecting from elsewhere)

**Option B: Neon / Supabase**
- Create a project and copy the connection string

**Format:** `postgresql://user:password@host:port/dbname`

---

## 3. Redis Cloud

1. Go to [Redis Cloud](https://app.redislabs.com/)
2. Create a database (free tier available)
3. After creation, open the database → **Connect** → copy the connection URL
4. Redis Cloud typically uses TLS: `rediss://default:password@host:port`
5. Use this URL for both `CELERY_BROKER_URL` and `CELERY_RESULT_BACKEND`

---

## 4. AWS S3

1. Create an S3 bucket (e.g. `kriterion-submissions-prod`)
2. Create an IAM user with programmatic access
3. Attach a policy with:
   - `s3:PutObject`
   - `s3:GetObject`
   - `s3:DeleteObject`
   - `s3:ListBucket`
4. Note: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`
5. Set `AWS_REGION` (e.g. `us-east-1`) and `AWS_S3_BUCKET_NAME`

---

## 5. Deploy Backend on Render

1. Push `render.yaml` to your repo
2. Render Dashboard → **New** → **Blueprint**
3. Connect your GitHub repo
4. Render will detect `render.yaml` and create:
   - `kriterion-api` (web)
   - `kriterion-celery-worker` (background worker)
   - `kriterion-celery-beat` (scheduler)

5. Add **PostgreSQL**: New → PostgreSQL (if not using external DB)

6. For each service (`kriterion-api`, `kriterion-celery-worker`, `kriterion-celery-beat`), add **Environment Variables**:

   | Variable | Value |
   |----------|-------|
   | `DATABASE_URL` | From Render PostgreSQL or your DB |
   | `SECRET_KEY` | `openssl rand -hex 32` |
   | `BACKEND_CORS_ORIGINS` | `["https://YOUR_VERCEL_APP.vercel.app"]` |
   | `CELERY_BROKER_URL` | Redis Cloud URL |
   | `CELERY_RESULT_BACKEND` | Same Redis Cloud URL |
   | `AWS_ACCESS_KEY_ID` | Your AWS key |
   | `AWS_SECRET_ACCESS_KEY` | Your AWS secret |
   | `AWS_REGION` | `us-east-1` |
   | `AWS_S3_BUCKET_NAME` | Your bucket name |
   | `USE_S3_STORAGE` | `true` |
   | `ENVIRONMENT` | `production` |
   | `DEBUG` | `false` |
   | `INITIAL_ADMIN_EMAIL` | Admin email |
   | `INITIAL_ADMIN_PASSWORD` | Strong password |

7. Deploy. Note the web service URL: `https://kriterion-api.onrender.com` (or your custom domain)

---

## 6. Deploy Frontend on Vercel

1. Vercel Dashboard → **Add New** → **Project**
2. Import your GitHub repo
3. **Root Directory**: set to `frontend` (or `vercel.json` will use it)
4. **Environment Variables**:

   | Variable | Value |
   |----------|-------|
   | `NEXT_PUBLIC_API_URL` | `https://kriterion-api.onrender.com/api/v1` |
   | `NEXT_PUBLIC_APP_NAME` | `Kriterion` |

5. Deploy

6. Copy your Vercel URL (e.g. `https://kriterion.vercel.app`) and add it to `BACKEND_CORS_ORIGINS` on Render, then redeploy the backend.

---

## 7. CORS

Ensure `BACKEND_CORS_ORIGINS` on Render includes your Vercel URLs:
```
["https://kriterion.vercel.app","https://your-custom-domain.com"]
```

---

## 8. Sandbox / Code Execution

The backend runs student code in Docker containers. Render’s Docker services typically **cannot** run Docker-in-Docker (dind). Options:

1. **Render with Docker**: Basic API and Celery will run; code execution may fail if it expects a Docker socket.
2. **Alternative**: Host the backend on a platform that supports Docker-in-Docker (e.g. a VPS, Railway with the right setup, or Fly.io with a volume for the Docker socket).

If code execution is required, consider running the backend on a VM or platform that supports Docker socket access.

---

## 9. Environment Variable Summary

### Vercel (frontend)
```
NEXT_PUBLIC_API_URL=https://kriterion-api.onrender.com/api/v1
NEXT_PUBLIC_APP_NAME=Kriterion
```

### Render (backend)
```
DATABASE_URL=postgresql://...
SECRET_KEY=<32+ chars>
BACKEND_CORS_ORIGINS=["https://your-app.vercel.app"]
CELERY_BROKER_URL=rediss://default:pass@host:port
CELERY_RESULT_BACKEND=rediss://default:pass@host:port
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1
AWS_S3_BUCKET_NAME=kriterion-submissions
USE_S3_STORAGE=true
ENVIRONMENT=production
DEBUG=false
INITIAL_ADMIN_EMAIL=admin@yourdomain.edu
INITIAL_ADMIN_PASSWORD=...
```

---

## 10. Post-Deploy

1. Open the Vercel app URL
2. Log in with `INITIAL_ADMIN_EMAIL` and `INITIAL_ADMIN_PASSWORD`
3. Change the admin password in the app
4. Create courses, assignments, and test cases
