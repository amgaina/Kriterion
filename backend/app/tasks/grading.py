"""
Grading Celery Tasks
"""
from typing import List
from celery import Task, group
from sqlalchemy.orm import Session

from app.core.celery_app import celery_app
from app.core.database import SessionLocal
from app.core.logging import logger
from app.models import Submission, Assignment
from app.services.grading import GradingService
import asyncio


class DatabaseTask(Task):
    """Base task with database session management"""
    _db = None

    @property
    def db(self) -> Session:
        if self._db is None:
            self._db = SessionLocal()
        return self._db

    def after_return(self, *args, **kwargs):
        if self._db is not None:
            self._db.close()
            self._db = None


@celery_app.task(
    bind=True,
    base=DatabaseTask,
    name="app.tasks.grading.grade_submission_task",
    max_retries=3,
    default_retry_delay=30,
)
def grade_submission_task(self, submission_id: int):
    """
    Grade a submission asynchronously
    
    Args:
        submission_id: Submission ID to grade
        
    Returns:
        Grading result
    """
    try:
        submission = self.db.query(Submission).filter(
            Submission.id == submission_id
        ).first()
        
        if not submission:
            logger.error(f"Submission {submission_id} not found")
            return {"error": "Submission not found"}
        
        # Create grading service
        grading_service = GradingService(self.db)
        
        # Run async grading in sync context (required for Celery)
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        result = loop.run_until_complete(
            grading_service.grade_submission(submission_id)
        )
        loop.close()
        
        logger.info(f"Graded submission {submission_id}: {result.get('status')}")
        
        return result
        
    except Exception as e:
        logger.error(f"Error grading submission {submission_id}: {str(e)}", exc_info=True)
        raise self.retry(exc=e, countdown=min(2 ** self.request.retries, 300))


@celery_app.task(
    bind=True,
    base=DatabaseTask,
    name="app.tasks.grading.batch_grade_submissions_task",
)
def batch_grade_submissions_task(self, submission_ids: List[int]):
    """
    Grade multiple submissions in parallel
    
    Args:
        submission_ids: List of submission IDs to grade
        
    Returns:
        Summary of grading results
    """
    try:
        # Create a group of grading tasks
        job = group(
            grade_submission_task.s(sub_id) 
            for sub_id in submission_ids
        )
        
        # Execute in parallel
        result = job.apply_async(queue="grading")
        
        # Wait for all tasks to complete (with timeout)
        results = result.get(timeout=600)  # 10 minutes
        
        # Summarize results
        summary = {
            "total": len(submission_ids),
            "successful": sum(1 for r in results if r.get("status") == "graded"),
            "failed": sum(1 for r in results if r.get("error")),
            "results": results
        }
        
        logger.info(f"Batch grading completed: {summary['successful']}/{summary['total']} successful")
        
        return summary
        
    except Exception as e:
        logger.error(f"Batch grading error: {str(e)}", exc_info=True)
        return {"error": str(e)}
