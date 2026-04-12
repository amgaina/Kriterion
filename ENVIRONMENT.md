# Kriterion - Environment Variables Reference

Complete list of all environment variables used in the Kriterion application.

## 🔴 Required Variables (Must Set)

### Database Configuration

```bash
# PostgreSQL database URL
# Format: postgresql://username:password@host:port/database
DATABASE_URL=postgresql://kriterion:kriterion_dev_password@db:5432/kriterion

# Individual components (used by Docker Compose)
POSTGRES_USER=kriterion
POSTGRES_PASSWORD=kriterion_dev_password
POSTGRES_DB=kriterion
```

### Security

```bash
# Secret key for JWT tokens (MUST be 32+ characters)
# Generate with: openssl rand -hex 32
SECRET_KEY=your-secret-key-change-in-production-min-32-chars

# JWT algorithm (recommended: HS256)
ALGORITHM=HS256

# Token expiration times
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7
```

### CORS Configuration

```bash
# Allowed origins for CORS (JSON array format)
BACKEND_CORS_ORIGINS=["http://localhost:3000","http://localhost:8000"]
```

### Frontend

```bash
# Backend API URL (from frontend perspective)
NEXT_PUBLIC_API_URL=http://localhost:8000

# Application name
NEXT_PUBLIC_APP_NAME=Kriterion
```

## 🟡 Optional Variables (Recommended)

### Rate Limiting

```bash
# Format: number/period (minute, hour, day)
RATE_LIMIT_LOGIN=5/minute
RATE_LIMIT_SUBMIT=10/minute
RATE_LIMIT_API=100/minute
```

### File Upload

```bash
# Maximum upload size in megabytes
MAX_UPLOAD_SIZE_MB=50

# Allowed file extensions (comma-separated)
ALLOWED_EXTENSIONS=.py,.java

# Upload directory path
UPLOAD_DIR=/tmp/kriterion/uploads
```

### Sandbox Configuration

```bash
# Execution timeout in seconds
SANDBOX_TIMEOUT_SECONDS=30

# Memory limit in megabytes
SANDBOX_MEMORY_LIMIT_MB=512

# CPU limit (1.0 = 1 core)
SANDBOX_CPU_LIMIT=1.0

# Docker image for sandbox
SANDBOX_IMAGE=kriterion-sandbox:latest
```

### Email Configuration

```bash
# SMTP server settings
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@example.com
SMTP_PASSWORD=your-app-password
EMAIL_FROM=noreply@kriterion.edu
```

### Application Settings

```bash
# Environment mode
ENVIRONMENT=development  # or production, staging

# Debug mode (true/false)
DEBUG=true

# Logging level
LOG_LEVEL=INFO  # DEBUG, INFO, WARNING, ERROR, CRITICAL
```

### Initial Admin Account

```bash
# Default admin credentials (created during seed)
INITIAL_ADMIN_EMAIL=admin@kriterion.edu
INITIAL_ADMIN_PASSWORD=Admin@123456
```

## 🟢 Optional Variables (Advanced)

### Database Connection Pool

```bash
# Database pool size
DB_POOL_SIZE=10
DB_MAX_OVERFLOW=20
DB_POOL_PRE_PING=true
```

### Redis (if using for caching/sessions)

```bash
REDIS_URL=redis://localhost:6379/0
```

### Monitoring and Observability

```bash
# Sentry DSN for error tracking
SENTRY_DSN=https://your-sentry-dsn

# Application performance monitoring
APM_SERVICE_NAME=kriterion
APM_ENVIRONMENT=production
```

### Cloud Storage (if using AWS S3, Azure Blob, etc.)

```bash
# AWS S3
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_REGION=us-east-1
S3_BUCKET_NAME=kriterion-uploads

# Azure Blob Storage
AZURE_STORAGE_CONNECTION_STRING=your-connection-string
AZURE_CONTAINER_NAME=kriterion-uploads
```

### Feature Flags

```bash
# Enable/disable features
ENABLE_PLAGIARISM_DETECTION=true
ENABLE_AI_DETECTION=true
ENABLE_EMAIL_NOTIFICATIONS=true
ENABLE_GROUP_SUBMISSIONS=true
```

## 📋 Environment-Specific Configurations

### Development (.env.development)

```bash
ENVIRONMENT=development
DEBUG=true
LOG_LEVEL=DEBUG
BACKEND_CORS_ORIGINS=["http://localhost:3000"]
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### Production (.env.production)

```bash
ENVIRONMENT=production
DEBUG=false
LOG_LEVEL=INFO
BACKEND_CORS_ORIGINS=["https://yourdomain.com"]
NEXT_PUBLIC_API_URL=https://api.yourdomain.com

# Use strong, generated passwords
SECRET_KEY=<generated-with-openssl-rand-hex-32>
POSTGRES_PASSWORD=<generated-with-openssl-rand-hex-16>
```

### Testing (.env.test)

```bash
ENVIRONMENT=test
DEBUG=false
DATABASE_URL=postgresql://kriterion:test_password@localhost:5432/kriterion_test
SECRET_KEY=test-secret-key-for-testing-only
```

## 🔧 How to Set Environment Variables

### Using .env File (Recommended for Docker)

```bash
# 1. Copy template
cp .env.example .env

# 2. Edit file
nano .env

# 3. Docker Compose will automatically load it
docker-compose up
```

### Using Shell Export (Local Development)

```bash
# Temporary (current session only)
export SECRET_KEY="your-secret-key"
export DATABASE_URL="postgresql://..."

# Permanent (add to ~/.bashrc or ~/.zshrc)
echo 'export SECRET_KEY="your-secret-key"' >> ~/.bashrc
source ~/.bashrc
```

### Using Docker Compose Override

```bash
# Create docker-compose.override.yml
# This file is automatically merged with docker-compose.yml

version: '3.8'
services:
  backend:
    environment:
      - SECRET_KEY=override-secret-key
      - DEBUG=true
```

### Using Secrets in Production

For production, use secret management:

**Docker Swarm:**

```bash
echo "my-secret-key" | docker secret create secret_key -
```

**Kubernetes:**

```bash
kubectl create secret generic kriterion-secrets \
  --from-literal=secret-key='my-secret-key'
```

**Cloud Providers:**

- AWS: AWS Secrets Manager or Parameter Store
- Azure: Azure Key Vault
- GCP: Secret Manager

## 🔒 Security Best Practices

1. **Never commit .env to version control**

   ```bash
   # .gitignore should include:
   .env
   .env.local
   .env.*.local
   ```

2. **Generate secure random values**

   ```bash
   openssl rand -hex 32  # For SECRET_KEY
   openssl rand -hex 16  # For passwords
   ```

3. **Use different credentials per environment**
   - Development: Simple passwords OK
   - Staging: Similar to production
   - Production: Strong, unique, rotated regularly

4. **Restrict access to .env files**

   ```bash
   chmod 600 .env
   ```

5. **Use environment-specific files**

   ```bash
   .env.development
   .env.staging
   .env.production
   ```

6. **Validate required variables on startup**
   The application checks for required variables and fails fast if missing.

## 🧪 Testing Environment Variables

```bash
# Check if variable is set
echo $SECRET_KEY

# List all environment variables
printenv | grep KRITERION

# Test database connection
docker-compose exec backend python -c "from app.core.config import settings; print(settings.DATABASE_URL)"

# Validate .env file
docker-compose config
```

## 🆘 Troubleshooting

### Variable not being loaded

1. **Check .env file location** (must be in project root)
2. **Restart services** after changing .env
   ```bash
   docker-compose restart
   ```
3. **Check for syntax errors** (no spaces around =)

   ```bash
   # Correct
   SECRET_KEY=value

   # Wrong
   SECRET_KEY = value
   ```

### Value contains special characters

```bash
# Use quotes for special characters
SECRET_KEY="key-with-special-!@#$%"
DATABASE_URL='postgresql://user:p@ss!word@host/db'
```

### Variable not accessible in container

```bash
# Check if variable is in container
docker-compose exec backend env | grep SECRET_KEY

# Force rebuild with new variables
docker-compose up -d --force-recreate
```

## 📝 Complete .env Template

See `.env.example` file for a complete, production-ready template with all variables documented.

---

For more information, see:

- [README.md](./README.md) - Full documentation
- [DEPLOYMENT.md](./DEPLOYMENT.md) - Deployment guide
- [COMMANDS.md](./COMMANDS.md) - Terminal commands
