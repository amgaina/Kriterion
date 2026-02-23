# Kriterion - Automated Grading System

A production-grade automated grading system for programming assignments, built with modern technologies and best practices.

## Overview

Kriterion is a comprehensive web application that automates the grading process for programming assignments. It supports multiple programming languages, provides detailed feedback, and includes features for students, faculty, and administrators.

## Features

### For Students

- Submit code assignments with automatic validation
- Run public tests before final submission
- View detailed rubric scores and feedback
- Join groups for collaborative assignments
- Download comprehensive grade reports
- Track assignment progress and deadlines

### For Faculty

- Create and manage programming assignments
- Upload starter code and test suites
- Configure weighted rubrics (default template included)
- Manage public and private test cases
- Run automated grading with sandbox execution
- Review and override scores with justification
- View analytics dashboards and grade distributions
- Export grades in Canvas-compatible format

### For Administrators

- Manage system-wide settings
- Add/configure programming languages
- Monitor audit logs and security events
- Control database and system maintenance
- Manage user accounts and roles

## Architecture

### Tech Stack

**Frontend:**

- Next.js 14 (App Router) with TypeScript
- Tailwind CSS + shadcn/ui components
- TanStack Query for data fetching
- React Hook Form + Zod for validation
- Responsive, mobile-first design

**Backend:**

- FastAPI with Pydantic validation
- SQLAlchemy 2.0 ORM
- Alembic for database migrations
- JWT authentication (access + refresh tokens)
- Role-based access control (RBAC)

**Database:**

- PostgreSQL 16

**Infrastructure:**

- Docker + Docker Compose
- Isolated sandbox containers for code execution
- NGINX for production deployment
- GitHub Actions for CI/CD

**Security:**

- Bcrypt password hashing
- Rate limiting on sensitive endpoints
- Audit logging for all critical actions
- Sandboxed code execution (Docker isolation)
- CSRF protection
- Request ID tracking

## Prerequisites

- Docker and Docker Compose
- Make (optional, but recommended)
- Git

## Quick Start

### 1. Clone the Repository

```bash
git clone <repository-url>
cd Kriterion
```

### 2. Environment Setup

```bash
# Copy environment template
cp .env.example .env

# Edit .env with your configuration
# IMPORTANT: Change SECRET_KEY, passwords, and other sensitive values
nano .env
```

### 3. Build and Start Services

```bash
# Using Make (recommended)
make build
make up

# Or using Docker Compose directly
docker-compose build
docker-compose up -d
```

### 4. Initialize Database

```bash
# Run migrations
make migrate

# Seed initial data (creates admin user)
make seed

# Or combined
make init-db
```

### 5. Build Sandbox Container

```bash
make sandbox-build
```

### 6. Access the Application

- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:8000
- **API Documentation:** http://localhost:8000/api/docs

**Default Admin Credentials:**

- Email: admin@kriterion.edu
- Password: Admin@123456

⚠️ **Change these immediately in production!**

## 📁 Project Structure

```
Kriterion/
├── backend/                 # FastAPI backend
│   ├── alembic/            # Database migrations
│   ├── app/
│   │   ├── api/            # API endpoints
│   │   ├── core/           # Core functionality (config, security, logging)
│   │   ├── models/         # SQLAlchemy models
│   │   ├── schemas/        # Pydantic schemas
│   │   ├── services/       # Business logic
│   │   └── main.py         # Application entry point
│   ├── tests/              # Backend tests
│   └── requirements.txt    # Python dependencies
├── frontend/               # Next.js frontend
│   ├── app/                # Next.js app directory
│   ├── components/         # React components
│   ├── lib/                # Utilities and API clients
│   └── package.json        # Node dependencies
├── sandbox/                # Code execution sandbox
│   └── Dockerfile          # Sandbox container definition
├── .github/                # GitHub Actions workflows
├── docker-compose.yml      # Docker composition
├── Makefile               # Development commands
└── README.md              # This file
```

## 🔧 Development

### Running Services Locally (without Docker)

**Backend:**

```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

**Frontend:**

```bash
cd frontend
npm install
npm run dev
```

**Database:**

```bash
# Using Docker for PostgreSQL only
docker run -d \
  --name kriterion-db \
  -e POSTGRES_USER=kriterion \
  -e POSTGRES_PASSWORD=kriterion_dev_password \
  -e POSTGRES_DB=kriterion \
  -p 5432:5432 \
  postgres:16-alpine
```

### Make Commands

```bash
make help              # Show all available commands
make install           # Install all dependencies
make build             # Build Docker images
make up                # Start all services
make down              # Stop all services
make restart           # Restart services
make logs              # View all logs
make logs-backend      # View backend logs only
make logs-frontend     # View frontend logs only
make migrate           # Run database migrations
make migrate-create    # Create new migration
make seed              # Seed database
make test-backend      # Run backend tests
make shell-backend     # Open backend container shell
make shell-db          # Open PostgreSQL shell
make clean             # Clean up everything
```

## 🌐 Environment Variables

### Required Variables

```bash
# Database
DATABASE_URL=postgresql://user:password@host:port/dbname

# Security
SECRET_KEY=your-secret-key-minimum-32-characters-long
ALGORITHM=HS256

# CORS
BACKEND_CORS_ORIGINS=["http://localhost:3000"]

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### Optional Variables

```bash
# Rate Limiting
RATE_LIMIT_LOGIN=5/minute
RATE_LIMIT_SUBMIT=10/minute

# File Upload
MAX_UPLOAD_SIZE_MB=50

# Sandbox
SANDBOX_TIMEOUT_SECONDS=30
SANDBOX_MEMORY_LIMIT_MB=512

# Email (for password reset)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@example.com
SMTP_PASSWORD=your-app-password
```

See `.env.example` for complete list.

## 🧪 Testing

### Backend Tests

```bash
cd backend
pytest                          # Run all tests
pytest --cov=app               # With coverage
pytest tests/test_auth.py      # Specific test file
```

### Frontend Tests

```bash
cd frontend
npm test                        # Run tests
npm run type-check             # TypeScript type checking
npm run lint                   # ESLint
```

## 🔐 Security Features

1. **Authentication:**
   - JWT tokens (access + refresh)
   - Secure password hashing (bcrypt)
   - Password strength validation
   - Token expiration and refresh

2. **Authorization:**
   - Role-based access control (RBAC)
   - Endpoint-level permissions
   - Resource ownership checks

3. **Code Execution:**
   - Isolated Docker sandbox
   - No network access for student code
   - Resource limits (CPU, memory, time)
   - Non-root execution

4. **Audit Trail:**
   - All critical actions logged
   - User activity tracking
   - Request ID correlation
   - IP address and user agent logging

5. **Rate Limiting:**
   - Login attempts limited
   - Submission throttling
   - API request limits

## 📊 Default Rubric Template

The system includes a configurable rubric template (customizable per assignment):

**I. Correctness (60 points)**

- Correct Output (30%)
- Output Quality (10%)
- Specification (10%)
- Testing (0% - optional)
- Efficiency (10%)

**II. Style (25 points)**

- Code Style (10%)
- Program Design/Modularity (10%)
- Parameter Usage (5%)

**III. Documentation (15 points)**

- Neatness/Clarity (5%)
- General Documentation (5%)
- Module-level (5%)

**IV. Design Documents (0 points - optional)**

**Total: 100 points**

## 🎓 Supported Programming Languages

- Python 3.11+
- Java 17
- C++ (g++)
- C (gcc)
- JavaScript (Node.js)
- TypeScript

Additional languages can be added by extending the sandbox container.

## 📦 Database Schema

Key entities:

- **Users:** Students, Faculty, Admins
- **Courses:** With sections and semesters
- **Assignments:** Language, due dates, requirements
- **Rubrics:** Customizable per assignment
- **Test Suites:** Public and private tests
- **Submissions:** Student code with attempts
- **Grades:** Automated + manual scores
- **Audit Logs:** Security and activity tracking

## 🚢 Deployment

### Production Deployment

1. **Update environment variables:**

```bash
# Set strong passwords and secrets
SECRET_KEY=$(openssl rand -hex 32)
POSTGRES_PASSWORD=$(openssl rand -hex 16)
```

2. **Build for production:**

```bash
docker-compose -f docker-compose.yml -f docker-compose.prod.yml build
```

3. **Deploy:**

```bash
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

4. **Setup HTTPS with Let's Encrypt** (recommended)

### Cloud Deployment

The application can be deployed to:

- AWS (ECS, RDS, S3)
- Azure (Container Instances, PostgreSQL)
- Google Cloud (Cloud Run, Cloud SQL)
- DigitalOcean (App Platform)

## 🐛 Troubleshooting

### Database Connection Issues

```bash
# Check database is running
docker-compose ps db

# View database logs
docker-compose logs db

# Restart database
docker-compose restart db
```

### Migration Issues

```bash
# Reset migrations (⚠️ destroys data)
docker-compose down -v
docker-compose up -d db
make migrate
```

### Frontend Build Errors

```bash
cd frontend
rm -rf .next node_modules
npm install
npm run build
```

## 📝 API Documentation

Interactive API documentation available at:

- Swagger UI: http://localhost:8000/api/docs
- ReDoc: http://localhost:8000/api/redoc
- OpenAPI JSON: http://localhost:8000/api/openapi.json

---

Built with ❤️ for educators and students
