import threading
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
from collections import defaultdict
from fastapi import APIRouter, Depends, HTTPException, Query, status, UploadFile, File, Form
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, desc
import os
import shutil
import zipfile
from pathlib import Path

from app.api.deps import get_db, get_current_user, require_role
from app.models import (
    User, UserRole, Assignment, Course, CourseAssistant, Submission, SubmissionFile, TestResult, RubricScore,
    Enrollment, EnrollmentStatus, Group, GroupMembership, AuditLog, NotificationType
)
from app.models.assignment import Rubric, RubricItem, TestCase
from app.schemas.submission import (
    SubmissionCreate,
    Submission as SubmissionSchema,
    SubmissionDetail,
    SubmissionWithStudent,
    SubmissionDetailWithStudent,
    PlagiarismMatchOut,
)
from sqlalchemy.orm import joinedload
from app.core.config import settings
from app.core.logging import logger
from app.services.grading import GradingService
from app.services.notifications import create_notification, notify_users, get_assistant_ids_for_course
from app.services.s3_storage import s3_service
from app.services.notification import notify_faculty_submission_received, notify_student_grade_posted

router = APIRouter()


def _is_submission_graded(submission: Submission) -> bool:
    """Treat submission as graded if it has a score or a graded/completed status."""
    status_value = str(submission.status or "").lower()
    return (
        submission.final_score is not None
        or status_value in {"completed", "autograded", "graded"}
    )


def _can_grade_for_course(db: Session, user: User, course_id: int) -> bool:
    """Check if user can grade submissions for this course (instructor, admin, or assigned assistant)."""
    if user.role == UserRole.ADMIN:
        return True
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        return False
    if user.role == UserRole.FACULTY and course.instructor_id == user.id:
        return True
    if user.role == UserRole.ASSISTANT:
        return db.query(CourseAssistant).filter(
            CourseAssistant.course_id == course_id,
            CourseAssistant.assistant_id == user.id
        ).first() is not None
    return False


@router.get("", response_model=List[SubmissionSchema])
def list_submissions(
    assignment_id: Optional[int] = None,
    student_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List submissions - students see their own, faculty/assistant see submissions from their courses"""
    query = db.query(Submission)
    
    if current_user.role == UserRole.STUDENT:
        # Students only see their own submissions
        query = query.filter(Submission.student_id == current_user.id)
    elif current_user.role == UserRole.FACULTY:
        # Faculty see submissions from their courses
        course_ids = [c.id for c in db.query(Course).filter(Course.instructor_id == current_user.id).all()]
        if course_ids:
            assignment_ids = [a.id for a in db.query(Assignment).filter(Assignment.course_id.in_(course_ids)).all()]
            if assignment_ids:
                query = query.filter(Submission.assignment_id.in_(assignment_ids))
            else:
                query = query.filter(Submission.assignment_id == -1)  # No assignments
        else:
            query = query.filter(Submission.assignment_id == -1)
    elif current_user.role == UserRole.ASSISTANT:
        # Assistants see submissions from courses they're assigned to
        ca_list = db.query(CourseAssistant).filter(CourseAssistant.assistant_id == current_user.id).all()
        course_ids = [ca.course_id for ca in ca_list]
        if course_ids:
            assignment_ids = [a.id for a in db.query(Assignment).filter(Assignment.course_id.in_(course_ids)).all()]
            if assignment_ids:
                query = query.filter(Submission.assignment_id.in_(assignment_ids))
            else:
                query = query.filter(Submission.assignment_id == -1)
        else:
            query = query.filter(Submission.assignment_id == -1)
    
    if assignment_id:
        query = query.filter(Submission.assignment_id == assignment_id)
        if current_user.role in (UserRole.FACULTY, UserRole.ASSISTANT):
            assignment = db.query(Assignment).options(joinedload(Assignment.course)).filter(Assignment.id == assignment_id).first()
            if assignment and not _can_grade_for_course(db, current_user, assignment.course_id):
                raise HTTPException(status_code=403, detail="Not authorized")
    
    if student_id and current_user.role != UserRole.STUDENT:
        query = query.filter(Submission.student_id == student_id)
    
    submissions = query.order_by(desc(Submission.submitted_at)).all()
    return submissions


@router.get("/assignment/{assignment_id}/all", response_model=List[SubmissionWithStudent])
def list_assignment_submissions(
    assignment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.FACULTY, UserRole.ADMIN, UserRole.ASSISTANT]))
):
    """Faculty/Admin/Assistant: list all submissions for an assignment with student info"""
    assignment = db.query(Assignment).options(joinedload(Assignment.course)).filter(Assignment.id == assignment_id).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")

    if not _can_grade_for_course(db, current_user, assignment.course_id):
        raise HTTPException(status_code=403, detail="Not authorized")

    submissions = (
        db.query(Submission)
        .options(joinedload(Submission.student))
        .filter(Submission.assignment_id == assignment_id)
        .order_by(desc(Submission.submitted_at))
        .all()
    )
    return submissions


def _get_assignment_ids_for_grader(db: Session, user: User) -> List[int]:
    """Get assignment IDs the user can grade (for faculty/assistant)."""
    if user.role == UserRole.ADMIN:
        return [a.id for a in db.query(Assignment).all()]
    if user.role == UserRole.FACULTY:
        course_ids = [c.id for c in db.query(Course).filter(Course.instructor_id == user.id).all()]
    elif user.role == UserRole.ASSISTANT:
        ca_list = db.query(CourseAssistant).filter(CourseAssistant.assistant_id == user.id).all()
        course_ids = [ca.course_id for ca in ca_list]
    else:
        return []
    if not course_ids:
        return []
    return [a.id for a in db.query(Assignment).filter(Assignment.course_id.in_(course_ids)).all()]


@router.get("/grading-stats")
def get_grading_stats(
    course_id: Optional[int] = Query(None, description="Filter by course (optional)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.FACULTY, UserRole.ADMIN, UserRole.ASSISTANT]))
):
    """
    Return grading stats counting unique students (latest submission per student per assignment).
    - pending_count: students whose latest submission is not completed
    - graded_count: students whose latest submission is completed
    """
    assignment_ids = _get_assignment_ids_for_grader(db, current_user)
    if course_id:
        if current_user.role == UserRole.ADMIN:
            pass  # admin sees all
        elif current_user.role == UserRole.FACULTY:
            if not db.query(Course).filter(Course.id == course_id, Course.instructor_id == current_user.id).first():
                raise HTTPException(status_code=403, detail="Not authorized for this course")
        elif current_user.role == UserRole.ASSISTANT:
            if not db.query(CourseAssistant).filter(
                CourseAssistant.course_id == course_id,
                CourseAssistant.assistant_id == current_user.id
            ).first():
                raise HTTPException(status_code=403, detail="Not authorized for this course")
        assignment_ids = [a.id for a in db.query(Assignment).filter(Assignment.course_id == course_id).all() if a.id in assignment_ids]

    if not assignment_ids:
        return {"total_pending": 0, "total_graded": 0, "assignments": []}

    submissions = (
        db.query(Submission)
        .filter(Submission.assignment_id.in_(assignment_ids))
        .all()
    )

    # Group by (assignment_id, student_id) and select latest deterministically
    # using submitted_at, then attempt_number, then id.
    latest_by_student: Dict[Tuple[int, int], Tuple[Tuple[datetime, int, int], Submission]] = {}
    for s in submissions:
        key = (s.assignment_id, s.student_id)
        rank = (
            s.submitted_at or datetime.min,
            int(s.attempt_number or 0),
            int(s.id or 0),
        )
        existing = latest_by_student.get(key)
        if existing is None or rank > existing[0]:
            latest_by_student[key] = (rank, s)

    # Per-assignment counts
    by_assignment: Dict[int, Dict[str, int]] = defaultdict(lambda: {"pending": 0, "graded": 0})
    total_pending = 0
    total_graded = 0
    for (aid, _), (_, sub) in latest_by_student.items():
        if _is_submission_graded(sub):
            by_assignment[aid]["graded"] += 1
            total_graded += 1
        else:
            by_assignment[aid]["pending"] += 1
            total_pending += 1

    assignments_out = [
        {"assignment_id": aid, "pending_count": by_assignment[aid]["pending"], "graded_count": by_assignment[aid]["graded"]}
        for aid in sorted(by_assignment.keys())
    ]
    return {"total_pending": total_pending, "total_graded": total_graded, "assignments": assignments_out}


@router.get("/{submission_id}", response_model=SubmissionDetailWithStudent)
def get_submission(
    submission_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get submission details including test results"""
    submission = (
        db.query(Submission)
        .options(
            joinedload(Submission.student),
            joinedload(Submission.files),
            joinedload(Submission.test_results),
            joinedload(Submission.plagiarism_matches),
            joinedload(Submission.assignment).joinedload(Assignment.course),
        )
        .filter(Submission.id == submission_id)
        .first()
    )
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    
    # Check access
    if current_user.role == UserRole.STUDENT:
        if submission.student_id != current_user.id:
            # Check if part of group
            if submission.group_id:
                group_member = db.query(GroupMembership).filter(
                    and_(
                        GroupMembership.group_id == submission.group_id,
                        GroupMembership.user_id == current_user.id
                    )
                ).first()
                if not group_member:
                    raise HTTPException(status_code=403, detail="Access denied")
            else:
                raise HTTPException(status_code=403, detail="Access denied")
    elif current_user.role in (UserRole.FACULTY, UserRole.ASSISTANT):
        if not _can_grade_for_course(db, current_user, submission.assignment.course_id):
            raise HTTPException(status_code=403, detail="Access denied")
    
    return submission


@router.post("", response_model=SubmissionSchema, status_code=status.HTTP_201_CREATED)
async def create_submission(
    assignment_id: int = Form(...),
    group_id: Optional[int] = Form(None),
    files: List[UploadFile] = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Submit code for an assignment"""
    # Verify assignment exists and is published
    assignment = db.query(Assignment).filter(Assignment.id == assignment_id).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    
    if not assignment.is_published:
        raise HTTPException(status_code=403, detail="Assignment not published")
    
    # Verify enrollment
    enrollment = db.query(Enrollment).filter(
        and_(
            Enrollment.student_id == current_user.id,
            Enrollment.course_id == assignment.course_id,
            Enrollment.status == EnrollmentStatus.ACTIVE
        )
    ).first()
    if not enrollment:
        raise HTTPException(status_code=403, detail="Not enrolled in this course")
    
    # Check max attempts
    if assignment.max_attempts > 0:
        attempt_count = db.query(Submission).filter(
            and_(
                Submission.assignment_id == assignment_id,
                Submission.student_id == current_user.id
            )
        ).count()
        if attempt_count >= assignment.max_attempts:
            raise HTTPException(
                status_code=403,
                detail=f"Maximum attempts ({assignment.max_attempts}) reached"
            )
    
    # Verify group if provided
    if group_id:
        if not assignment.allow_groups:
            raise HTTPException(status_code=400, detail="Groups not allowed for this assignment")
        
        group_member = db.query(GroupMembership).filter(
            and_(
                GroupMembership.group_id == group_id,
                GroupMembership.user_id == current_user.id
            )
        ).first()
        if not group_member:
            raise HTTPException(status_code=403, detail="Not a member of this group")
    
    # Validate allowed file extensions
    allowed_extensions = assignment.allowed_file_extensions
    if allowed_extensions:
        allowed_set = {ext.lower() if ext.startswith('.') else f'.{ext.lower()}' for ext in allowed_extensions}
        for upload_file in files:
            fn = upload_file.filename or ''
            ext = '.' + fn.split('.')[-1].lower() if '.' in fn else ''
            if ext and ext not in allowed_set:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"File '{fn}' has disallowed extension. Allowed: {', '.join(sorted(allowed_set))}"
                )
    
    # Calculate late penalty
    now = datetime.utcnow()
    is_late = now > assignment.due_date
    late_penalty = 0.0
    
    if is_late:
        if not assignment.allow_late:
            raise HTTPException(status_code=403, detail="Late submissions not allowed")
        days_late = (now - assignment.due_date).days + 1
        if days_late > assignment.max_late_days:
            raise HTTPException(
                status_code=403,
                detail=f"Submission is {days_late} days late (max {assignment.max_late_days} allowed)"
            )
        late_penalty = min(days_late * assignment.late_penalty_per_day, 100.0)
    
    # Get attempt number
    attempt_number = db.query(Submission).filter(
        and_(
            Submission.assignment_id == assignment_id,
            Submission.student_id == current_user.id
        )
    ).count() + 1
    
    # Create submission
    submission = Submission(
        assignment_id=assignment_id,
        student_id=current_user.id,
        group_id=group_id,
        attempt_number=attempt_number,
        submitted_at=now,
        is_late=is_late,
        late_penalty_applied=late_penalty,
        max_score=assignment.max_score,
        tests_total=0  # Will be updated after grading
    )
    
    db.add(submission)
    db.flush()  # Get submission.id
    
    # Save files to S3 or local storage
    uploaded_files_data = []
    total_size = 0
    
    MAX_TOTAL_SIZE = 100 * 1024 * 1024  # 100MB total per submission
    
    for upload_file in files:
        try:
            # Read file content
            file_content = await upload_file.read()
            file_size = len(file_content)
            total_size += file_size
            
            # Validate individual file size
            MAX_FILE_SIZE = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024 if hasattr(settings, 'MAX_UPLOAD_SIZE_MB') else 10 * 1024 * 1024
            if file_size > MAX_FILE_SIZE:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"File {upload_file.filename} exceeds maximum size of {MAX_FILE_SIZE / 1024 / 1024}MB"
                )
            
            # Validate total size
            if total_size > MAX_TOTAL_SIZE:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Total file size exceeds maximum of {MAX_TOTAL_SIZE / 1024 / 1024}MB"
                )
            
            # Validate file is not empty
            if file_size == 0:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"File {upload_file.filename} is empty"
                )
            
            use_s3 = getattr(settings, 'USE_S3_STORAGE', False)
            if use_s3:
                from io import BytesIO
                file_io = BytesIO(file_content)
                try:
                    s3_data = s3_service.upload_submission_file(
                        file_content=file_io,
                        filename=upload_file.filename,
                        submission_id=submission.id,
                        student_id=current_user.id,
                        assignment_id=assignment_id
                    )
                except Exception as s3_err:
                    logger.error(f"S3 upload failed for {upload_file.filename}: {s3_err}")
                    db.rollback()
                    raise HTTPException(
                        status_code=502,
                        detail=f"S3 storage failed: {str(s3_err)}. Check AWS credentials, bucket '{getattr(settings, 'AWS_S3_BUCKET_NAME', '')}' exists in region '{getattr(settings, 'AWS_REGION', '')}', and IAM has s3:PutObject."
                    ) from s3_err
                sub_file = SubmissionFile(
                    submission_id=submission.id,
                    filename=upload_file.filename,
                    original_filename=upload_file.filename,
                    file_path=s3_data['s3_url'],
                    file_hash=s3_data['file_hash'],
                    file_size_bytes=file_size
                )
                db.add(sub_file)
                uploaded_files_data.append({
                    'filename': upload_file.filename,
                    's3_url': s3_data['s3_url'],
                    's3_key': s3_data['s3_key']
                })
                logger.info(f"File {upload_file.filename} uploaded to S3: {s3_data['s3_url']}")
            else:
                # Save to local storage
                submission_dir = Path(settings.SUBMISSIONS_DIR) / str(submission.id)
                submission_dir.mkdir(parents=True, exist_ok=True)
                
                file_path = submission_dir / upload_file.filename
                
                with open(file_path, "wb") as f:
                    f.write(file_content)
                
                # Calculate file hash
                import hashlib
                file_hash = hashlib.sha256(file_content).hexdigest()
                
                # Create file record
                sub_file = SubmissionFile(
                    submission_id=submission.id,
                    filename=upload_file.filename,
                    original_filename=upload_file.filename,
                    file_path=str(file_path),
                    file_hash=file_hash,
                    file_size_bytes=file_size
                )
                db.add(sub_file)
                
                uploaded_files_data.append({
                    'filename': upload_file.filename,
                    'file_path': str(file_path)
                })
                
                logger.info(f"File {upload_file.filename} saved locally: {file_path}")
        
        except HTTPException:
            db.rollback()
            raise
        except Exception as e:
            logger.error(f"Error uploading file {upload_file.filename}: {str(e)}")
            # Clean up partial submission
            db.rollback()
            raise HTTPException(
                status_code=500,
                detail=f"Failed to upload file {upload_file.filename}: {str(e)}"
            )
    
    # Create audit log
    audit_log = AuditLog(
        user_id=current_user.id,
        event_type="SUBMISSION_CREATE",
        description=f"Submission created for assignment {assignment_id} - Attempt {attempt_number} - {len(files)} file(s) - Storage: {'S3' if settings.USE_S3_STORAGE else 'local'}",
        status="success"
    )
    db.add(audit_log)

    grader_user_ids = set([assignment.course.instructor_id] + get_assistant_ids_for_course(db, assignment.course_id))
    notify_users(
        db,
        user_ids=grader_user_ids,
        notification_type=NotificationType.SUBMISSION_RECEIVED,
        title=f"New submission: {assignment.title}",
        message=f"{current_user.full_name or current_user.email} submitted attempt {attempt_number}.",
        course_id=assignment.course_id,
        assignment_id=assignment.id,
    )
    
    db.commit()
    db.refresh(submission)
    
    # Send submission received notification to faculty/assistants
    try:
        notify_faculty_submission_received(
            db=db,
            course_id=assignment.course_id,
            assignment_id=assignment.id,
            student_name=current_user.full_name or "A student",
            course_code=assignment.course.code,
            faculty_id=assignment.course.instructor_id,
        )
        
        # Also notify assigned assistants
        assistants = db.query(CourseAssistant).filter(
            CourseAssistant.course_id == assignment.course_id
        ).all()
        for assistant in assistants:
            notify_faculty_submission_received(
                db=db,
                course_id=assignment.course_id,
                assignment_id=assignment.id,
                student_name=current_user.full_name or "A student",
                course_code=assignment.course.code,
                faculty_id=assistant.assistant_id,
            )
        
        db.commit()
    except Exception as notif_err:
        logger.warning(f"Failed to send submission notifications: {str(notif_err)}")
    
    logger.info(f"Submission {submission.id} created by user {current_user.id} for assignment {assignment_id}")

    # Dispatch Celery tasks in background so HTTP response returns immediately
    # (avoids blocking on slow/unreachable Redis connection)
    sub_id = submission.id

    def _trigger_grading():
        try:
            from app.tasks.grading import grade_submission_task, check_plagiarism_task
            from celery import chain as celery_chain
            chain = celery_chain(
                grade_submission_task.si(sub_id),
                check_plagiarism_task.si(sub_id),
            )
            chain.apply_async(queue="grading")
            logger.info(f"Triggered Celery grading + plagiarism for submission {sub_id}")
        except Exception as e:
            logger.warning(f"Could not trigger Celery for submission {sub_id}: {e}")

    threading.Thread(target=_trigger_grading, daemon=True).start()

    return submission


@router.post("/{submission_id}/grade")
async def grade_submission(
    submission_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.FACULTY, UserRole.ADMIN, UserRole.ASSISTANT]))
):
    """Trigger autograding for a submission"""
    submission = db.query(Submission).options(joinedload(Submission.assignment).joinedload(Assignment.course)).filter(Submission.id == submission_id).first()
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    
    if not _can_grade_for_course(db, current_user, submission.assignment.course_id):
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Run grading
    grading_service = GradingService(db)
    try:
        result = await grading_service.grade_submission(submission.id)
        
        # Audit log
        audit = AuditLog(
            user_id=current_user.id,
            event_type="submission_graded",
            description=f"Submission graded: {result.get('status')}"
        )
        db.add(audit)

        db.refresh(submission)
        create_notification(
            db,
            user_id=submission.student_id,
            notification_type=NotificationType.ASSIGNMENT_GRADED,
            title=f"Assignment graded: {submission.assignment.title}",
            message=f"Your submission has been graded. Latest score: {submission.final_score if submission.final_score is not None else 'available in gradebook'}.",
            course_id=submission.assignment.course_id,
            assignment_id=submission.assignment_id,
            submission_id=submission.id,
        )

        db.commit()
        
        return result
    except Exception as e:
        logger.error(f"Error grading submission {submission_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Grading failed: {str(e)}")


@router.put("/{submission_id}/override-score")
def override_score(
    submission_id: int,
    new_score: float = Form(...),
    reason: str = Form(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.FACULTY, UserRole.ADMIN, UserRole.ASSISTANT]))
):
    """Override submission score"""
    submission = db.query(Submission).options(joinedload(Submission.assignment).joinedload(Assignment.course)).filter(Submission.id == submission_id).first()
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    
    if not _can_grade_for_course(db, current_user, submission.assignment.course_id):
        raise HTTPException(status_code=403, detail="Not authorized")
    
    old_score = submission.final_score
    submission.final_score = new_score
    submission.override_score = new_score
    submission.updated_at = datetime.utcnow()
    
    db.commit()
    
    # Audit log
    audit = AuditLog(
        user_id=current_user.id,
        event_type="score_overridden",
        description=f"Score overridden from {old_score} to {new_score}. Reason: {reason}"
    )
    db.add(audit)
    db.commit()
    
    # Send grade posted notification to student
    try:
        notify_student_grade_posted(
            db=db,
            student_id=submission.student_id,
            course_code=submission.assignment.course.code,
            assignment_title=submission.assignment.title,
            score=new_score,
            max_score=submission.assignment.max_score,
            course_id=submission.assignment.course_id,
            assignment_id=submission.assignment_id,
        )
        db.commit()
    except Exception as notif_err:
        logger.warning(f"Failed to send grade notification: {str(notif_err)}")
    
    logger.info(f"Score overridden for submission {submission_id} by user {current_user.id}")
    
    return {"message": "Score overridden successfully", "new_score": new_score}


@router.get("/{submission_id}/download")
async def download_submission(
    submission_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Download submission files as zip"""
    submission = db.query(Submission).options(joinedload(Submission.assignment), joinedload(Submission.files)).filter(Submission.id == submission_id).first()
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    
    # Check access
    can_access = False
    if current_user.role == UserRole.ADMIN:
        can_access = True
    elif current_user.role in (UserRole.FACULTY, UserRole.ASSISTANT):
        can_access = _can_grade_for_course(db, current_user, submission.assignment.course_id)
    elif current_user.role == UserRole.STUDENT:
        can_access = submission.student_id == current_user.id
        if submission.group_id:
            group_member = db.query(GroupMembership).filter(
                and_(
                    GroupMembership.group_id == submission.group_id,
                    GroupMembership.user_id == current_user.id
                )
            ).first()
            can_access = can_access or bool(group_member)
    
    if not can_access:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Create zip file
    submission_dir = Path(settings.SUBMISSIONS_DIR) / str(submission.id)
    if not submission_dir.exists():
        raise HTTPException(status_code=404, detail="Submission files not found")
    
    zip_path = Path(settings.TEMP_DIR) / f"submission_{submission.id}.zip"
    zip_path.parent.mkdir(parents=True, exist_ok=True)
    
    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for file_record in submission.files:
            file_path = Path(file_record.file_path)
            if file_path.exists():
                zipf.write(file_path, file_path.name)
    
    from fastapi.responses import FileResponse
    return FileResponse(
        path=zip_path,
        filename=f"submission_{submission.id}.zip",
        media_type="application/zip"
    )


@router.get("/{submission_id}/files/{file_id}/content")
def get_file_content(
    submission_id: int,
    file_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Read the content of a submitted file"""
    submission = db.query(Submission).options(joinedload(Submission.assignment)).filter(Submission.id == submission_id).first()
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")

    can_access = False
    if current_user.role == UserRole.ADMIN:
        can_access = True
    elif current_user.role in (UserRole.FACULTY, UserRole.ASSISTANT):
        can_access = _can_grade_for_course(db, current_user, submission.assignment.course_id)
    elif current_user.role == UserRole.STUDENT:
        can_access = submission.student_id == current_user.id

    if not can_access:
        raise HTTPException(status_code=403, detail="Access denied")

    file_record = db.query(SubmissionFile).filter(
        and_(SubmissionFile.id == file_id, SubmissionFile.submission_id == submission_id)
    ).first()
    if not file_record:
        raise HTTPException(status_code=404, detail="File not found")

    content = ""
    if settings.USE_S3_STORAGE and file_record.file_path.startswith("http"):
        try:
            from urllib.parse import unquote
            raw = file_record.file_path.split(".amazonaws.com/")[-1] if ".amazonaws.com/" in file_record.file_path else file_record.file_path
            s3_key = unquote(raw.split("?")[0])
            import tempfile as tmpf
            with tmpf.NamedTemporaryFile(delete=False, suffix=file_record.filename) as tmp:
                s3_service.download_submission_file(s3_key, tmp.name)
                with open(tmp.name, 'r', encoding='utf-8', errors='replace') as f:
                    content = f.read()
                os.unlink(tmp.name)
        except Exception as e:
            logger.error(f"Error reading S3 file: {e}")
            content = f"[Error reading file from S3: {str(e)}]"
    else:
        file_path = Path(file_record.file_path)
        if file_path.exists():
            try:
                with open(file_path, 'r', encoding='utf-8', errors='replace') as f:
                    content = f.read()
            except Exception as e:
                content = f"[Error reading file: {str(e)}]"
        else:
            content = "[File not found on disk]"

    return {
        "id": file_record.id,
        "filename": file_record.filename,
        "content": content,
    }


@router.put("/{submission_id}/manual-grade")
def save_manual_grade(
    submission_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.FACULTY, UserRole.ADMIN, UserRole.ASSISTANT])),
    final_score: Optional[float] = Form(None),
    feedback: Optional[str] = Form(None),
    rubric_scores_json: Optional[str] = Form(None),
    test_overrides_json: Optional[str] = Form(None),
):
    """Save manual grading: feedback, rubric scores, test overrides, final score"""
    import json as json_lib
    submission = db.query(Submission).options(joinedload(Submission.assignment)).filter(Submission.id == submission_id).first()
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")

    if not _can_grade_for_course(db, current_user, submission.assignment.course_id):
        raise HTTPException(status_code=403, detail="Not authorized")

    if feedback is not None:
        submission.feedback = feedback

    if test_overrides_json:
        try:
            overrides = json_lib.loads(test_overrides_json)
            for ov in overrides:
                tr = db.query(TestResult).filter(
                    and_(TestResult.id == ov["id"], TestResult.submission_id == submission_id)
                ).first()
                if tr:
                    tr.points_awarded = float(ov.get("points_awarded", tr.points_awarded))
                    if "passed" in ov:
                        tr.passed = bool(ov["passed"])
        except Exception as e:
            logger.warning(f"Error processing test overrides: {e}")

    if rubric_scores_json:
        try:
            rubric_data = json_lib.loads(rubric_scores_json)
            for item in rubric_data:
                existing = db.query(RubricScore).filter(
                    and_(
                        RubricScore.submission_id == submission_id,
                        RubricScore.rubric_item_id == item["rubric_item_id"]
                    )
                ).first()
                if existing:
                    existing.score = float(item["score"])
                    existing.comment = item.get("comment", existing.comment)
                    existing.graded_by = current_user.id
                    existing.graded_at = datetime.utcnow()
                else:
                    db.add(RubricScore(
                        submission_id=submission_id,
                        rubric_item_id=item["rubric_item_id"],
                        score=float(item["score"]),
                        max_score=float(item.get("max_score", 0)),
                        comment=item.get("comment"),
                        graded_by=current_user.id,
                        graded_at=datetime.utcnow(),
                    ))
        except Exception as e:
            logger.warning(f"Error processing rubric scores: {e}")

    if final_score is not None:
        submission.final_score = final_score
        submission.override_score = final_score

    submission.graded_by = current_user.id
    submission.graded_at = datetime.utcnow()
    submission.status = "completed"
    submission.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(submission)

    audit = AuditLog(
        user_id=current_user.id,
        event_type="manual_grade",
        description=f"Manual grade saved for submission {submission_id}: score={final_score}"
    )
    db.add(audit)

    create_notification(
        db,
        user_id=submission.student_id,
        notification_type=NotificationType.ASSIGNMENT_GRADED,
        title=f"Assignment graded: {submission.assignment.title}",
        message=f"Your submission has been graded. Latest score: {submission.final_score if submission.final_score is not None else 'available in gradebook'}.",
        course_id=submission.assignment.course_id,
        assignment_id=submission.assignment_id,
        submission_id=submission.id,
    )

    db.commit()

    return {"message": "Grade saved successfully", "submission_id": submission_id}


# ---------------------------------------------------------------------------
# Plagiarism endpoints
# ---------------------------------------------------------------------------

@router.post("/{submission_id}/check-plagiarism")
def check_plagiarism(
    submission_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.FACULTY, UserRole.ADMIN, UserRole.ASSISTANT]))
):
    """Trigger plagiarism check for a single submission"""
    submission = (
        db.query(Submission)
        .options(joinedload(Submission.assignment).joinedload(Assignment.course))
        .filter(Submission.id == submission_id)
        .first()
    )
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")

    if not _can_grade_for_course(db, current_user, submission.assignment.course_id):
        raise HTTPException(status_code=403, detail="Not authorized")

    from app.services.plagiarism import PlagiarismService
    service = PlagiarismService(db)
    try:
        result = service.check_submission(submission_id, force=True)
        audit = AuditLog(
            user_id=current_user.id,
            event_type="plagiarism_check",
            description=f"Plagiarism check on submission {submission_id}: score={result.get('plagiarism_score')}",
            status="success",
        )
        db.add(audit)
        db.commit()
        return result
    except Exception as e:
        logger.error(f"Plagiarism check failed for submission {submission_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Plagiarism check failed: {str(e)}")


@router.post("/assignment/{assignment_id}/check-plagiarism-all")
def check_plagiarism_all(
    assignment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.FACULTY, UserRole.ADMIN, UserRole.ASSISTANT]))
):
    """Run plagiarism check on ALL submissions for an assignment"""
    assignment = (
        db.query(Assignment)
        .options(joinedload(Assignment.course))
        .filter(Assignment.id == assignment_id)
        .first()
    )
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    if not _can_grade_for_course(db, current_user, assignment.course_id):
        raise HTTPException(status_code=403, detail="Not authorized")

    from app.services.plagiarism import PlagiarismService
    service = PlagiarismService(db)
    try:
        result = service.check_all_for_assignment(assignment_id)
        audit = AuditLog(
            user_id=current_user.id,
            event_type="plagiarism_batch_check",
            description=f"Batch plagiarism check for assignment {assignment_id}: {result['total_checked']} submissions",
            status="success",
        )
        db.add(audit)
        db.commit()
        return result
    except Exception as e:
        logger.error(f"Batch plagiarism check failed: {e}")
        raise HTTPException(status_code=500, detail=f"Batch plagiarism check failed: {str(e)}")


@router.get("/{submission_id}/plagiarism-matches", response_model=List[PlagiarismMatchOut])
def get_plagiarism_matches(
    submission_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.FACULTY, UserRole.ADMIN]))
):
    """Get plagiarism match details for a submission"""
    submission = (
        db.query(Submission)
        .options(joinedload(Submission.assignment).joinedload(Assignment.course))
        .filter(Submission.id == submission_id)
        .first()
    )
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    if current_user.role == UserRole.FACULTY:
        if submission.assignment.course.instructor_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not authorized")

    from app.services.plagiarism import PlagiarismService
    service = PlagiarismService(db)
    return service.get_matches(submission_id)


@router.put("/plagiarism-matches/{match_id}/review")
def review_plagiarism_match(
    match_id: int,
    is_confirmed: bool = Form(...),
    reviewer_notes: str = Form(""),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.FACULTY, UserRole.ADMIN]))
):
    """Faculty reviews a plagiarism match (confirm/dismiss)"""
    from app.models.submission import PlagiarismMatch as PMModel
    match = db.query(PMModel).filter(PMModel.id == match_id).first()
    if not match:
        raise HTTPException(status_code=404, detail="Plagiarism match not found")

    from app.services.plagiarism import PlagiarismService
    service = PlagiarismService(db)
    try:
        updated = service.review_match(match_id, is_confirmed, reviewer_notes, current_user.id)
        return {
            "message": "Review saved",
            "match_id": updated.id,
            "is_confirmed": updated.is_confirmed,
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
