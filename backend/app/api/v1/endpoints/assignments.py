from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from sqlalchemy.orm import joinedload
from pydantic import BaseModel, Field
import tempfile
import os
import shutil
from pathlib import Path
import asyncio
from celery.result import AsyncResult

from app.api.deps import get_db, get_current_user, require_role
from app.models import (
    User, UserRole, Assignment, Course, Enrollment, EnrollmentStatus,
    Rubric, RubricCategory, RubricItem, TestCase, AuditLog, Language
)
from app.schemas.assignment import (
    AssignmentCreate,
    AssignmentUpdate,
    Assignment as AssignmentSchema,
    AssignmentDetail,
    RubricCreate,
    RubricUpdate
)
from app.core.logging import logger
from app.services.autograding import autograding_service
from app.services.sandbox import sandbox_executor
from app.tasks.code_execution import run_code_task, compile_check_task

router = APIRouter()


# ============== Request/Response Models ==============

class CodeFile(BaseModel):
    """File for code execution"""
    name: str = Field(..., description="File name")
    content: str = Field(..., description="File content")

class RunCodeRequest(BaseModel):
    """Request to run code without submission"""
    files: List[CodeFile] = Field(..., min_items=1, description="Code files to run")

class TestResult(BaseModel):
    """Individual test result"""
    id: int
    name: str
    passed: bool
    score: float
    max_score: float
    output: Optional[str] = None
    error: Optional[str] = None
    expected_output: Optional[str] = None
    execution_time: Optional[float] = None

class RunCodeResponse(BaseModel):
    """Response from code execution"""
    success: bool
    results: List[TestResult]
    total_score: float
    max_score: float
    tests_passed: int
    tests_total: int
    message: Optional[str] = None


@router.get("", response_model=List[AssignmentSchema])
def list_assignments(
    course_id: Optional[int] = None,
    published_only: bool = True,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List assignments - students see published only, faculty see all their course assignments"""
    query = db.query(Assignment).options(joinedload(Assignment.course))
    
    if course_id:
        query = query.filter(Assignment.course_id == course_id)
        
        # Verify student is enrolled or faculty owns course
        if current_user.role == UserRole.STUDENT:
            enrollment = db.query(Enrollment).filter(
                and_(
                    Enrollment.student_id == current_user.id,
                    Enrollment.course_id == course_id,
                    Enrollment.status == EnrollmentStatus.ACTIVE
                )
            ).first()
            if not enrollment:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Not enrolled in this course"
                )
    
    # Students only see published assignments from enrolled courses
    if current_user.role == UserRole.STUDENT:
        if published_only:
            query = query.filter(Assignment.is_published == True)
        
        # Filter by enrolled courses
        enrolled_course_ids = [e.course_id for e in current_user.enrollments if e.status == EnrollmentStatus.ACTIVE]
        query = query.filter(Assignment.course_id.in_(enrolled_course_ids))
    
    assignments = query.all()
    
    return assignments


@router.get("/{assignment_id}", response_model=AssignmentDetail)
def get_assignment(
    assignment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get assignment details including rubric and test cases"""
    assignment = db.query(Assignment).filter(Assignment.id == assignment_id).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    
    # Check access
    if current_user.role == UserRole.STUDENT:
        enrollment = db.query(Enrollment).filter(
            and_(
                Enrollment.student_id == current_user.id,
                Enrollment.course_id == assignment.course_id,
                Enrollment.status == EnrollmentStatus.ACTIVE
            )
        ).first()
        if not enrollment or not assignment.is_published:
            raise HTTPException(status_code=403, detail="Access denied")
    
    return assignment


@router.post("", response_model=AssignmentSchema, status_code=status.HTTP_201_CREATED)
def create_assignment(
    assignment_in: AssignmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.FACULTY, UserRole.ADMIN]))
):
    """Create a new assignment (faculty only)"""
    try:
        # Verify course ownership
        course = db.query(Course).filter(Course.id == assignment_in.course_id).first()
        if not course:
            raise HTTPException(status_code=404, detail="Course not found")
        
        if current_user.role == UserRole.FACULTY and course.instructor_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not authorized for this course")
        
        # Verify language exists
        language_obj = db.query(Language).filter(Language.id == assignment_in.language_id).first()
        if not language_obj:
            raise HTTPException(status_code=422, detail="Language not found")

        # Get available columns from the model directly
        available_columns = {c.name for c in Assignment.__table__.columns}

        # Prepare assignment data from the input schema
        assignment_data_in = assignment_in.model_dump(exclude={"rubric", "test_suites"})
        
        # Filter the data to only include columns that exist in the database table
        assignment_data = {
            key: value for key, value in assignment_data_in.items() if key in available_columns
        }
        
        if 'difficulty' in assignment_data:
            assignment_data['difficulty'] = str(assignment_data['difficulty']).lower()

        # Create assignment
        assignment = Assignment(
            **assignment_data,
        )
        
        db.add(assignment)
        db.flush()  # Get assignment.id
        
        # Create default rubric if provided
        if assignment_in.rubric:
            rubric_data = assignment_in.rubric
            rubric = Rubric(
                assignment_id=assignment.id,
                total_points=rubric_data.total_points
            )
            db.add(rubric)
            db.flush()
            
            # Create categories and items
            for cat_data in rubric_data.categories:
                category = RubricCategory(
                    rubric_id=rubric.id,
                    name=cat_data.name,
                    weight=cat_data.weight,
                    order=cat_data.order
                )
                db.add(category)
                db.flush()
                
                for item_data in cat_data.items:
                    item = RubricItem(
                        category_id=category.id,
                        name=item_data.name,
                        max_points=item_data.max_points,
                        description=item_data.description,
                        order=item_data.order
                    )
                    db.add(item)
        
        # Audit log
        audit = AuditLog(
            user_id=current_user.id,
            event_type="assignment_created",
            description=f"Assignment '{assignment.title}' created",
        )
        db.add(audit)
        
        db.commit()
        db.refresh(assignment)

        # Manually attach the course object to prevent serialization errors from lazy loading
        assignment.course = course
        
        logger.info(f"Assignment {assignment.id} created by user {current_user.id}")
        return assignment
    
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error creating assignment: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500, 
            detail=f"Failed to create assignment: {str(e)}"
        )


@router.put("/{assignment_id}", response_model=AssignmentSchema)
def update_assignment(
    assignment_id: int,
    assignment_in: AssignmentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.FACULTY, UserRole.ADMIN]))
):
    """Update an assignment"""
    assignment = db.query(Assignment).filter(Assignment.id == assignment_id).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    
    # Check ownership
    if current_user.role == UserRole.FACULTY and assignment.course.instructor_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Get available columns from the model directly
    available_columns = {c.name for c in Assignment.__table__.columns}

    # Update fields
    update_data_in = assignment_in.model_dump(exclude_unset=True)
    
    # Filter to only include columns that exist in the database
    update_data = {
        key: value for key, value in update_data_in.items() if key in available_columns
    }
    
    if "difficulty" in update_data and isinstance(update_data["difficulty"], str):
        update_data["difficulty"] = update_data["difficulty"].lower()
        
    for field, value in update_data.items():
        setattr(assignment, field, value)
    
    # Audit log
    audit = AuditLog(
        user_id=current_user.id,
        event_type="assignment_updated",
        description=f"Assignment '{assignment.title}' updated",
    )
    db.add(audit)
    
    # The 'updated_at' field on assignment is handled by 'onupdate' in the model
    db.commit()
    db.refresh(assignment)
    
    return assignment


@router.delete("/{assignment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_assignment(
    assignment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.FACULTY, UserRole.ADMIN]))
):
    """Delete an assignment"""
    assignment = db.query(Assignment).filter(Assignment.id == assignment_id).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    
    # Check ownership
    if current_user.role == UserRole.FACULTY and assignment.course.instructor_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Audit log before deletion
    audit = AuditLog(
        user_id=current_user.id,
        event_type="assignment_deleted",
        description=f"Assignment '{assignment.title}' deleted"
    )
    db.add(audit)
    
    db.delete(assignment)
    db.commit()
    
    return None


@router.post("/{assignment_id}/publish")
def publish_assignment(
    assignment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.FACULTY, UserRole.ADMIN]))
):
    """Publish an assignment to make it visible to students"""
    assignment = db.query(Assignment).filter(Assignment.id == assignment_id).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    
    # Check ownership
    if current_user.role == UserRole.FACULTY and assignment.course.instructor_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    assignment.is_published = True
    
    # Audit log
    audit = AuditLog(
        user_id=current_user.id,
        event_type="assignment_published",
        description=f"Assignment '{assignment.title}' published"
    )
    db.add(audit)
    db.commit()
    
    return {"message": "Assignment published successfully"}


@router.post("/{assignment_id}/run", response_model=RunCodeResponse)
async def run_assignment_code(
    assignment_id: int,
    request: RunCodeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Run student code against test cases without creating a submission.
    This allows students to test their code before submitting.
    
    Edge cases handled:
    - Assignment not found
    - Assignment not published (students can't access)
    - User not enrolled in course
    - No test cases available
    - Invalid file formats
    - Execution errors
    - Timeout handling
    - Memory limits
    """
    # Validate assignment exists
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
    
    # Get test cases (only public/sample tests for practice runs)
    test_cases = db.query(TestCase).filter(
        and_(
            TestCase.assignment_id == assignment_id,
            or_(
                TestCase.is_sample == True,
                TestCase.is_hidden == False
            )
        )
    ).order_by(TestCase.order).all()
    
    # Create temporary directory for code files
    temp_dir = None
    try:
        temp_dir = tempfile.mkdtemp(prefix="assignment_run_")
        
        # Write files to temp directory
        for file in request.files:
            file_path = os.path.join(temp_dir, file.name)
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(file.content)
        
        # If no test cases, just compile and run the code to verify it works
        if not test_cases:
            logger.info(f"No test cases for assignment {assignment_id}, attempting compilation/run for user {current_user.id}")
            
            try:
                # Try to compile/run the code
                execution_result = await asyncio.to_thread(
                    sandbox_executor.execute_code,
                    code_path=temp_dir,
                    language=assignment.language.name.lower(),
                    test_input="",  # No input
                    command_args=None
                )
                
                # Check if compilation/execution succeeded
                if execution_result.get("success", False) or execution_result.get("exit_code") == 0:
                    message = "✓ Your code compiled and ran successfully!"
                    if execution_result.get("stdout"):
                        message += f"\n\nOutput:\n{execution_result.get('stdout', '')[:500]}"
                else:
                    # Compilation or runtime error
                    error_msg = execution_result.get("stderr", "Unknown error")
                    message = f"⚠ Compilation/Runtime Error:\n{error_msg[:500]}"
                    
                # Audit log
                audit = AuditLog(
                    user_id=current_user.id,
                    event_type="code_run_no_tests",
                    description=f"Code compilation check for assignment {assignment_id}: {'success' if execution_result.get('success') else 'failed'}"
                )
                db.add(audit)
                db.commit()
                
                return RunCodeResponse(
                    success=execution_result.get("success", False) or execution_result.get("exit_code") == 0,
                    results=[],
                    total_score=0,
                    max_score=0,
                    tests_passed=0,
                    tests_total=0,
                    message=message
                )
                
            except Exception as e:
                logger.error(f"Compilation check error: {str(e)}", exc_info=True)
                return RunCodeResponse(
                    success=False,
                    results=[],
                    total_score=0,
                    max_score=0,
                    tests_passed=0,
                    tests_total=0,
                    message=f"Error during compilation: {str(e)}"
                )
            finally:
                # Clean up
                if temp_dir and os.path.exists(temp_dir):
                    try:
                        shutil.rmtree(temp_dir)
                    except Exception as e:
                        logger.warning(f"Failed to clean up temp directory: {str(e)}")
        
        logger.info(f"Running code for assignment {assignment_id}, user {current_user.id}")
        
        # Run test cases
        all_results = []
        total_score = 0
        max_score = 0
        tests_passed = 0
        tests_total = len(test_cases)
        
        for test_case in test_cases:
            max_score += test_case.points
            
            try:
                # Execute code with test input
                execution_result = await asyncio.to_thread(
                    sandbox_executor.execute_code,
                    code_path=temp_dir,
                    language=assignment.language.name.lower(),
                    test_input=test_case.input_data,
                    command_args=None
                )
                
                # Compare output
                actual_output = execution_result.get("stdout", "").strip()
                expected_output = (test_case.expected_output or "").strip()
                
                # Apply comparison settings
                if test_case.ignore_whitespace:
                    actual_output = " ".join(actual_output.split())
                    expected_output = " ".join(expected_output.split())
                
                if test_case.ignore_case:
                    actual_output = actual_output.lower()
                    expected_output = expected_output.lower()
                
                passed = (
                    execution_result.get("success", False) and 
                    actual_output == expected_output
                )
                
                if passed:
                    tests_passed += 1
                    total_score += test_case.points
                
                # Build test result
                test_result = TestResult(
                    id=test_case.id,
                    name=test_case.name,
                    passed=passed,
                    score=test_case.points if passed else 0,
                    max_score=test_case.points,
                    output=execution_result.get("stdout", "")[:1000],  # Limit output
                    error=execution_result.get("stderr", "")[:1000] if not execution_result.get("success") else None,
                    expected_output=expected_output if not passed else None,
                    execution_time=execution_result.get("runtime", 0)
                )
                
                all_results.append(test_result)
                
            except Exception as e:
                logger.error(f"Test execution error: {str(e)}", exc_info=True)
                all_results.append(TestResult(
                    id=test_case.id,
                    name=test_case.name,
                    passed=False,
                    score=0,
                    max_score=test_case.points,
                    output=None,
                    error=f"Execution error: {str(e)}",
                    expected_output=None,
                    execution_time=0
                ))
        
        # Audit log
        audit = AuditLog(
            user_id=current_user.id,
            event_type="code_run",
            description=f"Code run for assignment {assignment_id}: {tests_passed}/{tests_total} tests passed"
        )
        db.add(audit)
        db.commit()
        
        return RunCodeResponse(
            success=True,
            results=all_results,
            total_score=total_score,
            max_score=max_score,
            tests_passed=tests_passed,
            tests_total=tests_total,
            message=f"Tests completed: {tests_passed}/{tests_total} passed"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Code execution error: {str(e)}", exc_info=True)
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to execute code: {str(e)}"
        )
    finally:
        # Clean up temporary directory
        if temp_dir and os.path.exists(temp_dir):
            try:
                shutil.rmtree(temp_dir)
            except Exception as e:
                logger.warning(f"Failed to clean up temp directory: {str(e)}")


@router.post("/{assignment_id}/unpublish")
def unpublish_assignment(
    assignment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.FACULTY, UserRole.ADMIN]))
):
    """Unpublish an assignment"""
    assignment = db.query(Assignment).filter(Assignment.id == assignment_id).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    
    # Check ownership
    if current_user.role == UserRole.FACULTY and assignment.course.instructor_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    assignment.is_published = False
    
    # Audit log
    audit = AuditLog(
        user_id=current_user.id,
        event_type="assignment_unpublished",
        description=f"Assignment '{assignment.title}' unpublished"
    )
    db.add(audit)
    db.commit()
    
    return {"message": "Assignment unpublished successfully"}
