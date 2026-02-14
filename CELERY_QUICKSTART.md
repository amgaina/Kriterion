# Celery Quick Start Guide

## 🚀 Getting Started with Celery

Celery is now integrated into Kriterion for background task processing! This guide will get you up and running.

## Prerequisites

- Docker and Docker Compose installed
- `.env` file configured (copy from `.env.example`)

## Quick Start

### 1. Start All Services

```bash
# Start everything (backend, frontend, database, Redis, Celery)
docker-compose up -d

# Check status
docker-compose ps
```

You should see:
- ✅ `kriterion-backend` - FastAPI server
- ✅ `kriterion-frontend` - Next.js app
- ✅ `kriterion-db` - PostgreSQL database  
- ✅ `kriterion-redis` - Redis message broker
- ✅ `kriterion-celery-worker` - Celery task worker
- ✅ `kriterion-celery-beat` - Celery scheduler

### 2. View Logs

```bash
# All logs
docker-compose logs -f

# Just Celery worker
make logs-celery

# Just backend
make logs-backend
```

### 3. Test Celery is Working

Send a test request to the new async endpoint:

```bash
curl -X POST "http://localhost:8000/api/v1/assignments/1/run-async" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "files": [
      {
        "name": "main.py",
        "content": "print(\"Hello from Celery!\")"
      }
    ]
  }'
```

Response:
```json
{
  "task_id": "abc123...",
  "status": "pending",
  "message": "Code execution task started..."
}
```

### 4. Check Task Status

```bash
curl "http://localhost:8000/api/v1/assignments/task/{task_id}" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## API Endpoints

### For Students/Testing

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/assignments/{id}/run-async` | POST | Run code asynchronously |
| `/api/v1/assignments/task/{task_id}` | GET | Check task status |
| `/api/v1/assignments/task/{task_id}` | DELETE | Cancel running task |

### Old Endpoint (Still Available)

The old synchronous endpoint still works:
- `/api/v1/assignments/{id}/run` - Runs code synchronously (blocks until complete)

**Recommendation**: Use `/run-async` for production as it:
- ✅ Doesn't block the API
- ✅ Has retry capability  
- ✅ Better resource management
- ✅ Can handle long-running tasks

## Monitoring

### Check Active Tasks

```bash
make celery-status
```

### Purge All Tasks (Development)

```bash
make celery-purge
```

### Restart Celery Worker

```bash
make celery-restart
```

## Architecture

```
Student submits code
       ↓
FastAPI receives request
       ↓
FastAPI creates Celery task → Redis (task queue)
       ↓                            ↓
Returns task_id              Celery worker picks up task
                                   ↓
                             Executes code in sandbox
                                   ↓
                             Stores result in Redis
                                   ↓
Student polls /task/{id} ← Returns result to student
```

## Frontend Integration

Update your frontend to use the async endpoint:

```typescript
// 1. Submit code
const response = await fetch(`/api/v1/assignments/${assignmentId}/run-async`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ files })
});

const { task_id } = await response.json();

// 2. Poll for results
const pollInterval = setInterval(async () => {
  const statusResponse = await fetch(`/api/v1/assignments/task/${task_id}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  const status = await statusResponse.json();
  
  if (status.status === 'SUCCESS') {
    // Task complete! Show results
    console.log('Results:', status.results);
    clearInterval(pollInterval);
  } else if (status.status === 'FAILURE') {
    // Task failed
    console.error('Error:', status.error);
    clearInterval(pollInterval);
  }
}, 2000); // Poll every 2 seconds
```

## Troubleshooting

### Celery worker not starting?

```bash
# Check logs
docker-compose logs celery_worker

# Restart worker
docker-compose restart celery_worker
```

### Tasks stuck in PENDING?

```bash
# Check Redis is running
docker-compose ps redis

# Check worker is processing
docker-compose exec celery_worker celery -A app.core.celery_app inspect active
```

### Redis connection refused?

```bash
# Check Redis logs
docker-compose logs redis

# Try restarting Redis
docker-compose restart redis
```

## Configuration

All Celery settings are in:
- `/backend/app/core/celery_app.py` - Task configuration
- `/backend/app/core/config.py` - Connection settings
- `docker-compose.yml` - Service definitions

### Key Settings

```python
# Task timeouts
task_time_limit=300        # 5 min hard limit
task_soft_time_limit=240   # 4 min soft limit

# Worker settings  
worker_prefetch_multiplier=1
worker_max_tasks_per_child=50

# Result expiry
result_expires=3600  # 1 hour
```

## Next Steps

1. ✅ Test the async endpoint with a real assignment
2. ✅ Update frontend to use polling mechanism
3. ✅ Monitor Celery worker logs during testing
4. ✅ Consider adding Flower for visual monitoring (see CELERY_SETUP.md)

## Learn More

- Full documentation: [CELERY_SETUP.md](./CELERY_SETUP.md)
- Celery docs: https://docs.celeryproject.org/
- Redis docs: https://redis.io/docs/

## Help

If you encounter issues:
1. Check `docker-compose logs celery_worker`
2. Verify Redis is running: `docker-compose ps redis`
3. Test Redis connection: `docker-compose exec redis redis-cli ping`
4. Restart services: `docker-compose restart`

Happy coding! 🎉
