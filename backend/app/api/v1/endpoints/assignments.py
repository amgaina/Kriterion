from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session, joinedload, subqueryload
from sqlalchemy import and_, or_
from pydantic import BaseModel, Field
import tempfile
import os
import shutil
from pathlib import Path
import asyncio

from app.api.deps import get_db, get_current_user, require_role
from app.models import (
    User, UserRole, Assignment, Course, CourseAssistant, Enrollment, EnrollmentStatus,
    Rubric, RubricCategory, RubricItem, TestCase, AuditLog, Language
)
from app.schemas.assignment import (
    AssignmentCreate,
    AssignmentUpdate,
    Assignment as AssignmentSchema,
    AssignmentDetail,
    RubricCreate,
    RubricUpdate,
    TestCaseCreate,
    TestCase as TestCaseSchema,
)

from app.core.logging import logger
from app.services.autograding import autograding_service
from app.services.sandbox import sandbox_executor
from app.tasks.code_execution import run_code_task, compile_check_task
from app.services.s3_storage import s3_service

router = APIRouter()


# ============== Request/Response Models ==============

class CodeFile(BaseModel):
    """File for code execution"""
    name: str = Field(..., description="File name")
    content: str = Field(..., description="File content")

class RunCodeRequest(BaseModel):
    """Request to run code without submission"""
    files: List[CodeFile] = Field(..., min_items=1, description="Code files to run")
    test_case_ids: Optional[List[int]] = Field(None, description="Specific test case IDs to run; omit or empty to run code only (terminal mode)")
    stdin: Optional[str] = Field(None, description="Standard input for terminal mode (when no test cases); e.g. '10\\n20\\n30' for Scanner/input()")

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
    compilation_status: Optional[str] = None
    stdout: Optional[str] = None
    stderr: Optional[str] = None


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
        
        # Filter by enrolled courses - query enrollments directly
        enrolled_courses_query = db.query(Enrollment.course_id).filter(
            Enrollment.student_id == current_user.id,
            Enrollment.status == EnrollmentStatus.ACTIVE
        ).all()
        enrolled_course_ids = [cid[0] for cid in enrolled_courses_query]
        query = query.filter(Assignment.course_id.in_(enrolled_course_ids))
    elif current_user.role == UserRole.FACULTY:
        # Faculty only see assignments from their courses
        taught_course_ids = [c.id for c in db.query(Course).filter(Course.instructor_id == current_user.id).all()]
        if taught_course_ids:
            query = query.filter(Assignment.course_id.in_(taught_course_ids))
        else:
            query = query.filter(Assignment.course_id == -1)
    elif current_user.role == UserRole.ASSISTANT:
        # Assistants only see assignments from courses they're assigned to
        ca_list = db.query(CourseAssistant).filter(CourseAssistant.assistant_id == current_user.id).all()
        assisted_course_ids = [ca.course_id for ca in ca_list]
        if assisted_course_ids:
            query = query.filter(Assignment.course_id.in_(assisted_course_ids))
        else:
            query = query.filter(Assignment.course_id == -1)

    if course_id and current_user.role in (UserRole.FACULTY, UserRole.ASSISTANT):
        course = db.query(Course).filter(Course.id == course_id).first()
        if course:
            if current_user.role == UserRole.FACULTY and course.instructor_id != current_user.id:
                raise HTTPException(status_code=403, detail="Not authorized for this course")
            if current_user.role == UserRole.ASSISTANT:
                ca = db.query(CourseAssistant).filter(
                    CourseAssistant.course_id == course_id,
                    CourseAssistant.assistant_id == current_user.id
                ).first()
                if not ca:
                    raise HTTPException(status_code=403, detail="Not authorized for this course")
    
    assignments = query.all()
    
    return assignments


@router.get("/{assignment_id}", response_model=AssignmentDetail)
def get_assignment(
    assignment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get assignment details including rubric and test cases"""
    assignment = db.query(Assignment).options(
        subqueryload(Assignment.rubric).subqueryload(Rubric.categories).subqueryload(RubricCategory.items),
        subqueryload(Assignment.test_cases),
        joinedload(Assignment.language),
        joinedload(Assignment.course)
    ).filter(Assignment.id == assignment_id).first()
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


@router.get("/{assignment_id}/supplementary-files")
def get_supplementary_files(
    assignment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get list of supplementary files with presigned download URLs (students only)"""
    assignment = db.query(Assignment).options(joinedload(Assignment.course)).filter(Assignment.id == assignment_id).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
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

    import json
    supplementary = []
    if assignment.starter_code and isinstance(assignment.starter_code, str):
        try:
            payload = json.loads(assignment.starter_code)
            supplementary = payload.get("supplementary") or []
        except (json.JSONDecodeError, TypeError):
            pass

    if not supplementary:
        return []

    result = []
    try:
        from app.core.config import settings
        if getattr(settings, 'USE_S3_STORAGE', True) and s3_service.s3_client:
            for item in supplementary:
                s3_key = item.get("s3_key")
                filename = item.get("filename", "file")
                size = item.get("size", 0)
                if s3_key:
                    url = s3_service.generate_presigned_url(s3_key, expiration=3600)
                    result.append({"filename": filename, "download_url": url, "size": size})
    except Exception as e:
        logger.warning(f"Could not generate presigned URLs: {e}")
    return result


# --- New version: Accept files and upload to S3 ---
from fastapi import Form
from fastapi import UploadFile, File as FastAPIFile
from typing import List
import io

def _upload_bytes_to_s3(
    file_content: bytes,
    filename: str,
    s3_prefix: str,
    assignment_id: int,
    user_id: int,
    content_type: str = "application/octet-stream",
) -> dict:
    """Upload bytes to S3 and return metadata dict."""
    file_stream = io.BytesIO(file_content)
    s3_key = s3_prefix + filename
    s3_service.s3_client.upload_fileobj(
        file_stream,
        s3_service.bucket_name,
        s3_key,
        ExtraArgs={
            "ContentType": content_type,
            "Metadata": {
                "assignment_id": str(assignment_id),
                "faculty_id": str(user_id),
                "original_filename": filename,
            },
        },
    )
    s3_url = f"https://{s3_service.bucket_name}.s3.{s3_service.s3_client.meta.region_name}.amazonaws.com/{s3_key}"
    return {
        "filename": filename,
        "s3_key": s3_key,
        "s3_url": s3_url,
        "size": len(file_content),
        "content_type": content_type,
    }


async def _upload_file_to_s3(upload_file: UploadFile, s3_prefix: str, assignment_id: int, user_id: int) -> tuple[dict, bytes]:
    """Upload a file to S3 and return (metadata dict, raw file bytes)."""
    file_content = await upload_file.read()
    ct = upload_file.content_type or "application/octet-stream"
    meta = _upload_bytes_to_s3(
        file_content,
        upload_file.filename,
        s3_prefix,
        assignment_id,
        user_id,
        content_type=ct,
    )
    return meta, file_content


@router.post("", response_model=AssignmentSchema, status_code=status.HTTP_201_CREATED)
async def create_assignment(
    assignment_data: str = Form(...),
    starter_file: Optional[UploadFile] = FastAPIFile(None),
    solution_file: Optional[UploadFile] = FastAPIFile(None),
    files: List[UploadFile] = FastAPIFile([]),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.FACULTY, UserRole.ADMIN]))
):
    """
    Create a new assignment (faculty only).
    - starter_file, solution_file: uploaded to assignments/{user_id}/{assignment_id}/code/
    - files (supplementary): uploaded to assignments/{user_id}/{assignment_id}/supplementary/
    """
    import json
    try:
        assignment_in = AssignmentCreate(**json.loads(assignment_data))

        course = db.query(Course).filter(Course.id == assignment_in.course_id).first()
        if not course:
            raise HTTPException(status_code=404, detail="Course not found")
        if current_user.role == UserRole.FACULTY and course.instructor_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not authorized for this course")

        language_obj = db.query(Language).filter(Language.id == assignment_in.language_id).first()
        if not language_obj:
            raise HTTPException(status_code=422, detail="Language not found")

        available_columns = {c.name for c in Assignment.__table__.columns}
        assignment_data_in = assignment_in.model_dump(exclude={"rubric", "test_cases", "test_suites"})
        assignment_data = {key: value for key, value in assignment_data_in.items() if key in available_columns}
        if 'difficulty' in assignment_data:
            assignment_data['difficulty'] = str(assignment_data['difficulty']).lower()

        assignment = Assignment(**assignment_data)
        db.add(assignment)
        db.flush()

        base_prefix = f"assignments/{current_user.id}/{assignment.id}/"
        code_prefix = base_prefix + "code/"
        supp_prefix = base_prefix + "supplementary/"

        code_files = []
        solution_files = []
        supplementary = []
        starter_code_text = (assignment.starter_code or "") if isinstance(assignment.starter_code, str) else ""

        if starter_file and starter_file.filename:
            meta, raw = await _upload_file_to_s3(
                starter_file, code_prefix + "starter_", assignment.id, current_user.id
            )
            code_files.append(meta)
            try:
                starter_code_text = raw.decode("utf-8")
            except UnicodeDecodeError:
                pass  # Binary file; keep existing or empty
        if solution_file and solution_file.filename:
            meta, _ = await _upload_file_to_s3(
                solution_file, code_prefix + "solution_", assignment.id, current_user.id
            )
            solution_files.append(meta)
        for upload_file in files:
            if upload_file.filename:
                meta, _ = await _upload_file_to_s3(
                    upload_file, supp_prefix, assignment.id, current_user.id
                )
                supplementary.append(meta)

        if code_files or solution_files or supplementary:
            payload = {"code": starter_code_text}
            if code_files:
                payload["code_files"] = code_files
            if solution_files:
                payload["solution_files"] = solution_files
            if supplementary:
                payload["supplementary"] = supplementary
            assignment.starter_code = json.dumps(payload)

        # Create test cases if provided
        if assignment_in.test_cases:
            for idx, tc_data in enumerate(assignment_in.test_cases):
                test_case = TestCase(
                    assignment_id=assignment.id,
                    name=tc_data.name,
                    description=tc_data.description,
                    input_data=tc_data.input_data,
                    expected_output=tc_data.expected_output,
                    points=tc_data.points,
                    is_hidden=tc_data.is_hidden,
                    is_sample=tc_data.is_sample,
                    ignore_whitespace=tc_data.ignore_whitespace,
                    ignore_case=tc_data.ignore_case,
                    time_limit_seconds=tc_data.time_limit_seconds,
                    order=tc_data.order if tc_data.order is not None else idx
                )
                db.add(test_case)

        # Create rubric if provided
        # total_points = max_score * (rubric_weight/100)
        # Category weights are % (0-100), must sum to 100
        # Each category gets: total_points * (weight/100); items' max_points must sum to that
        if assignment_in.rubric:
            rubric_data = assignment_in.rubric
            total_rubric_points = (
                rubric_data.total_points
                if rubric_data.total_points is not None
                else round(assignment.max_score * (assignment.rubric_weight or 30) / 100, 2)
            )
            cat_weight_sum = sum(c.weight for c in rubric_data.categories)
            if abs(cat_weight_sum - 100.0) > 0.01:
                raise HTTPException(
                    status_code=422,
                    detail=f"Rubric category weights must sum to 100% (got {cat_weight_sum})"
                )
            rubric = Rubric(assignment_id=assignment.id, total_points=total_rubric_points)
            db.add(rubric)
            db.flush()
            for cat_data in rubric_data.categories:
                cat_points = round(total_rubric_points * (cat_data.weight / 100), 2)
                item_sum = sum(i.max_points for i in cat_data.items)
                if abs(item_sum - cat_points) > 0.01:
                    raise HTTPException(
                        status_code=422,
                        detail=f"Category '{cat_data.name}': items must sum to {cat_points} pts (got {item_sum})"
                    )
                category = RubricCategory(
                    rubric_id=rubric.id,
                    name=cat_data.name,
                    description=cat_data.description,
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
    
    # Get test cases — faculty can see all; students only see visible ones
    tc_query = db.query(TestCase).filter(TestCase.assignment_id == assignment_id)

    if current_user.role == UserRole.STUDENT:
        tc_query = tc_query.filter(
            or_(TestCase.is_sample == True, TestCase.is_hidden == False)
        )

    if request.test_case_ids:
        tc_query = tc_query.filter(TestCase.id.in_(request.test_case_ids))

    test_cases = tc_query.order_by(TestCase.order).all()
    
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
                stdin_input = (request.stdin or "").replace("\r\n", "\n").replace("\r", "\n")
                execution_result = await asyncio.to_thread(
                    sandbox_executor.execute_code,
                    code_path=temp_dir,
                    language=assignment.language.name.lower(),
                    test_input=stdin_input,
                    command_args=None
                )
                
                timed_out = execution_result.get("timed_out", False)
                compiled_ok = execution_result.get("success", False) or execution_result.get("exit_code") == 0
                raw_stdout = execution_result.get("stdout", "") or ""
                raw_stderr = execution_result.get("stderr", "") or ""

                if timed_out:
                    compilation_status = "Time Exceeds"
                    message = "Execution timed out."
                elif compiled_ok:
                    compilation_status = "Compiled Successfully"
                    message = None
                else:
                    compilation_status = "Not Compiled Successfully"
                    message = raw_stderr[:2000] if raw_stderr else "Unknown error"

                audit = AuditLog(
                    user_id=current_user.id,
                    event_type="code_run_no_tests",
                    description=f"Code compilation check for assignment {assignment_id}: {compilation_status}"
                )
                db.add(audit)
                db.commit()
                
                return RunCodeResponse(
                    success=compiled_ok and not timed_out,
                    results=[],
                    total_score=0,
                    max_score=0,
                    tests_passed=0,
                    tests_total=0,
                    message=message,
                    compilation_status=compilation_status,
                    stdout=raw_stdout[:10000] if raw_stdout else None,
                    stderr=raw_stderr[:10000] if raw_stderr else None,
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
                    message=str(e),
                    compilation_status="Not Compiled Successfully",
                    stdout=None,
                    stderr=str(e)[:10000],
                )
            finally:
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
        
        compilation_status = "Compiled Successfully"
        
        for test_case in test_cases:
            max_score += test_case.points
            
            try:
                raw_input = test_case.input_data or ""
                stdin_input = raw_input.replace(",", "\n") if raw_input else ""
                
                execution_result = await asyncio.to_thread(
                    sandbox_executor.execute_code,
                    code_path=temp_dir,
                    language=assignment.language.name.lower(),
                    test_input=stdin_input,
                    command_args=None
                )
                
                timed_out = execution_result.get("timed_out", False)
                exec_success = execution_result.get("success", False) or execution_result.get("exit_code") == 0
                
                if timed_out:
                    compilation_status = "Time Exceeds"
                    all_results.append(TestResult(
                        id=test_case.id,
                        name=test_case.name,
                        passed=False,
                        score=0,
                        max_score=test_case.points,
                        output=None,
                        error="Time Exceeds",
                        expected_output=None,
                        execution_time=execution_result.get("runtime", 0)
                    ))
                    continue
                
                if not exec_success:
                    stderr = execution_result.get("stderr", "")
                    stdout = execution_result.get("stdout", "")
                    if "compile" in stderr.lower() or "error" in stderr.lower():
                        compilation_status = "Not Compiled Successfully"
                    all_results.append(TestResult(
                        id=test_case.id,
                        name=test_case.name,
                        passed=False,
                        score=0,
                        max_score=test_case.points,
                        output=stdout[:2000] if stdout else None,
                        error=stderr[:2000] if stderr else "Runtime error",
                        expected_output=None,
                        execution_time=execution_result.get("runtime", 0)
                    ))
                    continue
                
                raw_stdout = execution_result.get("stdout", "").strip()
                raw_stderr = execution_result.get("stderr", "").strip()
                actual_output = raw_stdout
                expected_output = (test_case.expected_output or "").strip()
                
                compare_actual = actual_output
                compare_expected = expected_output
                
                if test_case.ignore_whitespace:
                    compare_actual = " ".join(compare_actual.split())
                    compare_expected = " ".join(compare_expected.split())
                
                if test_case.ignore_case:
                    compare_actual = compare_actual.lower()
                    compare_expected = compare_expected.lower()
                
                passed = compare_actual == compare_expected
                
                if passed:
                    tests_passed += 1
                    total_score += test_case.points
                
                is_faculty = current_user.role in (UserRole.FACULTY, UserRole.ADMIN)
                show_details = is_faculty or test_case.is_sample or not test_case.is_hidden
                
                error_detail = None
                if not passed:
                    if raw_stderr:
                        error_detail = raw_stderr[:2000]
                    else:
                        error_detail = "Output does not match expected"
                
                test_result = TestResult(
                    id=test_case.id,
                    name=test_case.name,
                    passed=passed,
                    score=test_case.points if passed else 0,
                    max_score=test_case.points,
                    output=raw_stdout[:2000] if show_details else None,
                    error=error_detail if show_details else ("failed" if not passed else None),
                    expected_output=(test_case.expected_output or "").strip()[:2000] if (is_faculty or (show_details and not passed)) else None,
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
            success=tests_passed == tests_total and compilation_status == "Compiled Successfully",
            results=all_results,
            total_score=total_score,
            max_score=max_score,
            tests_passed=tests_passed,
            tests_total=tests_total,
            message=f"Tests completed: {tests_passed}/{tests_total} passed",
            compilation_status=compilation_status
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


# ───────────────────────────────────────────────────────────────────────────
# Test Case CRUD
# ───────────────────────────────────────────────────────────────────────────

@router.get("/{assignment_id}/test-cases", response_model=List[TestCaseSchema])
def list_test_cases(
    assignment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.FACULTY, UserRole.ADMIN])),
):
    assignment = db.query(Assignment).filter(Assignment.id == assignment_id).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    if current_user.role == UserRole.FACULTY and assignment.course.instructor_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    return db.query(TestCase).filter(TestCase.assignment_id == assignment_id).order_by(TestCase.order).all()


@router.post("/{assignment_id}/test-cases", response_model=TestCaseSchema, status_code=status.HTTP_201_CREATED)
def create_test_case(
    assignment_id: int,
    tc_in: TestCaseCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.FACULTY, UserRole.ADMIN])),
):
    assignment = db.query(Assignment).filter(Assignment.id == assignment_id).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    if current_user.role == UserRole.FACULTY and assignment.course.instructor_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    max_order = db.query(TestCase).filter(TestCase.assignment_id == assignment_id).count()
    tc = TestCase(
        assignment_id=assignment_id,
        name=tc_in.name,
        description=tc_in.description,
        input_data=tc_in.input_data,
        expected_output=tc_in.expected_output,
        test_code=tc_in.test_code,
        setup_code=tc_in.setup_code,
        teardown_code=tc_in.teardown_code,
        points=tc_in.points,
        is_hidden=tc_in.is_hidden,
        is_sample=tc_in.is_sample,
        ignore_whitespace=tc_in.ignore_whitespace,
        ignore_case=tc_in.ignore_case,
        use_regex=tc_in.use_regex,
        time_limit_seconds=tc_in.time_limit_seconds,
        memory_limit_mb=tc_in.memory_limit_mb,
        order=tc_in.order if tc_in.order != 0 else max_order,
    )
    db.add(tc)
    db.commit()
    db.refresh(tc)
    return tc


@router.put("/{assignment_id}/test-cases/{test_case_id}", response_model=TestCaseSchema)
def update_test_case(
    assignment_id: int,
    test_case_id: int,
    tc_in: TestCaseCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.FACULTY, UserRole.ADMIN])),
):
    assignment = db.query(Assignment).filter(Assignment.id == assignment_id).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    if current_user.role == UserRole.FACULTY and assignment.course.instructor_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    tc = db.query(TestCase).filter(
        and_(TestCase.id == test_case_id, TestCase.assignment_id == assignment_id)
    ).first()
    if not tc:
        raise HTTPException(status_code=404, detail="Test case not found")

    for field in [
        "name", "description", "input_data", "expected_output", "test_code",
        "setup_code", "teardown_code", "points", "is_hidden", "is_sample",
        "ignore_whitespace", "ignore_case", "use_regex", "time_limit_seconds",
        "memory_limit_mb", "order",
    ]:
        setattr(tc, field, getattr(tc_in, field))

    tc.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(tc)
    return tc


@router.delete("/{assignment_id}/test-cases/{test_case_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_test_case(
    assignment_id: int,
    test_case_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.FACULTY, UserRole.ADMIN])),
):
    assignment = db.query(Assignment).filter(Assignment.id == assignment_id).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    if current_user.role == UserRole.FACULTY and assignment.course.instructor_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    tc = db.query(TestCase).filter(
        and_(TestCase.id == test_case_id, TestCase.assignment_id == assignment_id)
    ).first()
    if not tc:
        raise HTTPException(status_code=404, detail="Test case not found")

    db.delete(tc)
    db.commit()
    return None
