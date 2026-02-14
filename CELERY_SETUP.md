# Celery Setup and Usage Guide

## Overview

This Kriterion deployment uses **Celery** for distributed task processing, specifically for:
- **Code Execution**: Running student code against test cases
- **Automated Grading**: Processing submissions asynchronously
- **Background Jobs**: Long-running tasks that shouldn't block the API

## Architecture

```
┌─────────────┐       ┌──────────────┐       ┌────────────┐
│   Client    │──────>│   FastAPI    │──────>│   Redis    │
│  (Frontend) │       │   Backend    │       │  (Broker)  │
└─────────────┘       └──────────────┘       └────────────┘
                              │                      │
                              │                      │
                              ▼                      ▼
                      ┌──────────────┐       ┌────────────┐
                      │  PostgreSQL  │       │   Celery   │
                      │  (Database)  │<──────│   Worker   │
                      └──────────────┘       └────────────┘
```

## Components

### 1. Redis
- **Purpose**: Message broker and result backend
- **Port**: 6379
- **Container**: `kriterion-redis`

### 2. Celery Worker
- **Purpose**: Executes background tasks
- **Queues**: 
  - `default`: General tasks
  - `code_execution`: Code running tasks
  - `grading`: Submission grading tasks
- **Concurrency**: 4 workers
- **Container**: `kriterion-celery-worker`

### 3. Celery Beat
- **Purpose**: Periodic task scheduler (cron-like)
- **Container**: `kriterion-celery-beat`

## API Endpoints

### Run Code (Async with Celery)
**POST** `/api/v1/assignments/{assignment_id}/run-async`

```json
{
  "files": [
    {
      "name": "main.py",
      "content": "print('Hello World')"
    }
  ]
}
```

**Response:**
```json
{
  "task_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "status": "pending",
  "message": "Code execution task started..."
}
```

### Check Task Status
**GET** `/api/v1/assignments/task/{task_id}`

**Response (Pending):**
```json
{
  "task_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "status": "PENDING",
  "message": "Task is pending..."
}
```

**Response (Complete):**
```json
{
  "task_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "status": "SUCCESS",
  "success": true,
  "results": [
    {
      "id": 1,
      "name": "Test 1",
      "passed": true,
      "score": 10,
      "max_score": 10,
      "output": "Hello World",
      "execution_time": 0.05
    }
  ],
  "total_score": 10,
  "max_score": 10,
  "tests_passed": 1,
  "tests_total": 1,
  "message": "Tests completed: 1/1 passed"
}
```

### Cancel Task
**DELETE** `/api/v1/assignments/task/{task_id}`

## Task States

| State | Description |
|-------|-------------|
| `PENDING` | Task waiting to be picked up by a worker |
| `STARTED` | Task is currently running |
| `SUCCESS` | Task completed successfully |
| `FAILURE` | Task encountered an error |
| `RETRY` | Task failed and is being retried |

## Configuration

### Environment Variables

```bash
# Celery Broker (Redis)
CELERY_BROKER_URL=redis://redis:6379/0

# Result Backend (Redis)
CELERY_RESULT_BACKEND=redis://redis:6379/0
```

### Celery Settings

Located in `/backend/app/core/celery_app.py`:

```python
celery_app.conf.update(
    task_time_limit=300,        # 5 minutes hard limit
    task_soft_time_limit=240,   # 4 minutes soft limit
    worker_prefetch_multiplier=1,
    worker_max_tasks_per_child=50,
    task_acks_late=True,
    result_expires=3600,        # Results expire after 1 hour
)
```

## Docker Commands

### Start All Services
```bash
docker-compose up -d
```

### View Celery Worker Logs
```bash
docker-compose logs -f celery_worker
```

### View Celery Beat Logs
```bash
docker-compose logs -f celery_beat
```

### Restart Celery Worker
```bash
docker-compose restart celery_worker
```

### Monitor Redis
```bash
docker-compose exec redis redis-cli
> KEYS *
> GET celery-task-meta-<task_id>
```

## Development

### Running Celery Locally

#### Start Redis
```bash
redis-server
```

#### Start Celery Worker
```bash
cd backend
celery -A app.core.celery_app worker --loglevel=info --queues=default,code_execution,grading --concurrency=4
```

#### Start Celery Beat (for periodic tasks)
```bash
cd backend
celery -A app.core.celery_app beat --loglevel=info
```

### Monitoring

#### Flower (Celery Monitoring Tool)
Add to `docker-compose.yml`:

```yaml
flower:
  image: mher/flower:latest
  container_name: kriterion-flower
  environment:
    - CELERY_BROKER_URL=redis://redis:6379/0
    - CELERY_RESULT_BACKEND=redis://redis:6379/0
  ports:
    - "5555:5555"
  depends_on:
    - redis
    - celery_worker
  command: celery --broker=redis://redis:6379/0 flower --port=5555
```

Then visit: `http://localhost:5555`

## Creating New Tasks

### 1. Define Task

Create in `/backend/app/tasks/your_module.py`:

```python
from app.core.celery_app import celery_app
from app.core.logging import logger

@celery_app.task(
    bind=True,
    name="app.tasks.your_module.your_task",
    max_retries=3,
    default_retry_delay=10,
)
def your_task(self, param1, param2):
    """Your task description"""
    try:
        # Do work
        result = some_function(param1, param2)
        return {"success": True, "result": result}
    except Exception as e:
        logger.error(f"Task error: {str(e)}")
        raise self.retry(exc=e)
```

### 2. Call Task from API

```python
from app.tasks.your_module import your_task

@router.post("/run-task")
def run_task(data: YourModel):
    task = your_task.apply_async(
        args=[data.param1, data.param2],
        queue="your_queue"
    )
    return {"task_id": task.id}
```

### 3. Check Task Result

```python
from celery.result import AsyncResult

@router.get("/task/{task_id}")
def get_result(task_id: str):
    task = AsyncResult(task_id)
    if task.ready():
        return {"status": "complete", "result": task.get()}
    return {"status": task.state}
```

## Best Practices

1. **Task Idempotency**: Tasks should produce the same result when called multiple times
2. **Timeouts**: Always set task time limits to prevent hanging
3. **Retries**: Use exponential backoff for retries
4. **Result Expiry**: Clean up old results to save memory
5. **Queue Separation**: Use different queues for different task types
6. **Monitoring**: Always monitor task success/failure rates
7. **Error Handling**: Log errors properly for debugging

## Troubleshooting

### Task Not Running
```bash
# Check worker is running
docker-compose ps celery_worker

# Check worker logs
docker-compose logs celery_worker

# Check Redis connection
docker-compose exec redis redis-cli ping
```

### Task Stuck in PENDING
- Worker may not be running
- Task may be in a different queue
- Redis connection issue

```bash
# Restart worker
docker-compose restart celery_worker

# Purge all tasks
docker-compose exec celery_worker celery -A app.core.celery_app purge
```

### High Memory Usage
```bash
# Reduce worker concurrency
celery -A app.core.celery_app worker --concurrency=2

# Set max tasks per child
celery -A app.core.celery_app worker --max-tasks-per-child=20
```

## Production Considerations

1. **Use Separate Redis for Celery**: Don't share Redis with cache/sessions
2. **Monitor Memory**: Use tools like Flower to track worker memory
3. **Scale Workers**: Run multiple worker containers for high load
4. **Result Backend**: Consider using PostgreSQL instead of Redis for results
5. **Security**: Use Redis authentication in production
6. **Logging**: Send logs to centralized logging service
7. **Health Checks**: Monitor worker health and restart if needed

## Further Reading

- [Celery Documentation](https://docs.celeryproject.org/)
- [FastAPI Background Tasks](https://fastapi.tiangolo.com/tutorial/background-tasks/)
- [Redis Best Practices](https://redis.io/docs/manual/patterns/)
