"""
Celery Application Configuration
"""
from celery import Celery
from app.core.config import settings

# Create Celery app
celery_app = Celery(
    "kriterion",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=[
        "app.tasks.code_execution",
        "app.tasks.grading",
    ]
)

# Celery configuration
celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=300,  # 5 minutes hard limit
    task_soft_time_limit=240,  # 4 minutes soft limit
    worker_prefetch_multiplier=1,
    worker_max_tasks_per_child=50,
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    result_expires=3600,  # Results expire after 1 hour
    task_default_queue="default",
    task_routes={
        "app.tasks.code_execution.*": {"queue": "code_execution"},
        "app.tasks.grading.*": {"queue": "grading"},
    },
)

# Optional: Task result backend settings
celery_app.conf.result_backend_transport_options = {
    "master_name": "mymaster",
    "visibility_timeout": 3600,
}

if __name__ == "__main__":
    celery_app.start()
