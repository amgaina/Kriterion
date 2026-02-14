"""
Celery-based Code Execution Endpoints
Use these instead of the synchronous run endpoint
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_
from typing import Dict, Any
from celery.result import AsyncResult
from pydantic import BaseModel, Field
from typing import List

from app.api.deps import get_db, get_current_user
from app.models import User, UserRole, Assignment, Enrollment, EnrollmentStatus
from app.core.logging import logger
from app.tasks.code_execution import run_code_task

router = APIRouter()


class CodeFile(BaseModel):
    """Code file model"""
    name: str = Field(..., description="File name")
    content: str = Field(..., description="File content")


class RunCodeRequest(BaseModel):
    """Request model for running code"""
    files: List[CodeFile] = Field(..., description="Code files to execute")


@router.post("/{assignment_id}/run-async")
async def run_code_async(
    assignment_id: int,
    request: RunCodeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Run code against test cases in background using Celery.
    Returns task ID to check status later.
    
    This is the PREFERRED method for production use as it:
    - Runs in background (non-blocking)
    - Has retry logic
    - Better resource management
    - Can handle long-running tasks
    """
    # Get assignment with language
    assignment = db.query(Assignment).options(
        joinedload(Assignment.language),
        joinedload(Assignment.course)
    ).filter(Assignment.id == assignment_id).first()
    
    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assignment not found"
        )
    
    # Check if assignment is published (students only)
    if current_user.role == UserRole.STUDENT and not assignment.is_published:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Assignment is not published yet"
        )
    
    # Verify enrollment for students
    if current_user.role == UserRole.STUDENT:
        enrollment = db.query(Enrollment).filter(
            and_(
                Enrollment.student_id == current_user.id,
                Enrollment.course_id == assignment.course_id,
                Enrollment.status == EnrollmentStatus.ACTIVE
            )
        ).first()
        
        if not enrollment:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not enrolled in this course"
            )
    
    # Verify language is configured
    if not assignment.language:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Assignment language not configured"
        )
    
    # Validate files
    if not request.files:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one file is required"
        )
    
    # Check file count limit (prevent abuse)
    MAX_FILES = 50
    if len(request.files) > MAX_FILES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Too many files. Maximum is {MAX_FILES}"
        )
    
    # Check file size limit
    MAX_FILE_SIZE = 1024 * 1024  # 1MB per file
    for file in request.files:
        if len(file.content) > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File '{file.name}' exceeds maximum size of 1MB"
            )
        
        # Validate file name (prevent path traversal)
        if ".." in file.name or "/" in file.name or "\\" in file.name:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid file name: {file.name}"
            )
    
    # Convert files to dict format for Celery
    files_data = [
        {"name": file.name, "content": file.content}
        for file in request.files
    ]
    
    # Dispatch Celery task
    task = run_code_task.apply_async(
        args=[assignment_id, current_user.id, files_data],
        queue="code_execution"
    )
    
    logger.info(f"Code execution task {task.id} dispatched for assignment {assignment_id}, user {current_user.id}")
    
    return {
        "task_id": task.id,
        "status": "pending",
        "message": "Code execution task started. Use /api/v1/assignments/task/{task_id} to check status."
    }


@router.get("/task/{task_id}")
async def get_task_status(
    task_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Get status of a Celery task.
    
    States:
    - PENDING: Task waiting to be picked up
    - STARTED: Task is running
    - SUCCESS: Task completed successfully
    - FAILURE: Task failed
    - RETRY: Task is being retried
    """
    task_result = AsyncResult(task_id)
    
    response = {
        "task_id": task_id,
        "status": task_result.state,
    }
    
    if task_result.ready():
        # Task completed
        if task_result.successful():
            result = task_result.get()
            response.update({
                "success": result.get("success", False),
                "results": result.get("results", []),
                "total_score": result.get("total_score", 0),
                "max_score": result.get("max_score", 0),
                "tests_passed": result.get("tests_passed", 0),
                "tests_total": result.get("tests_total", 0),
                "message": result.get("message", ""),
                "error": result.get("error")
            })
        else:
            # Task failed
            response.update({
                "success": False,
                "error": str(task_result.result)
            })
    elif task_result.state == "PENDING":
        response["message"] = "Task is pending..."
    elif task_result.state == "STARTED":
        response["message"] = "Task is running..."
    elif task_result.state == "RETRY":
        response["message"] = "Task is being retried..."
    
    return response


@router.delete("/task/{task_id}")
async def cancel_task(
    task_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Dict[str, str]:
    """Cancel a running Celery task"""
    task_result = AsyncResult(task_id)
    task_result.revoke(terminate=True)
    
    logger.info(f"Task {task_id} cancelled by user {current_user.id}")
    
    return {
        "task_id": task_id,
        "message": "Task cancellation requested"
    }
