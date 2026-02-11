from datetime import datetime, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, desc
import os
import shutil
import zipfile
from pathlib import Path

from app.api.deps import get_db, get_current_user, require_role
from app.models import (
    User, UserRole, Assignment, Submission, SubmissionFile,
    Enrollment, EnrollmentStatus, Group, GroupMembership, AuditLog
)
from app.schemas.submission import (
    SubmissionCreate,
    Submission as SubmissionSchema,
    SubmissionDetail
)
from app.core.config import settings
from app.core.logging import logger
from app.services.grading import GradingService
from app.services.s3_storage import s3_service

router = APIRouter()


@router.get("", response_model=List[SubmissionSchema])
def list_submissions(
    assignment_id: Optional[int] = None,
    student_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List submissions - students see their own, faculty see all for their courses"""
    query = db.query(Submission)
    
    if current_user.role == UserRole.STUDENT:
        # Students only see their own submissions
        query = query.filter(Submission.student_id == current_user.id)
    elif current_user.role == UserRole.FACULTY:
        # Faculty see submissions from their courses
        if assignment_id:
            assignment = db.query(Assignment).filter(Assignment.id == assignment_id).first()
            if assignment and assignment.course.instructor_id != current_user.id:
                raise HTTPException(status_code=403, detail="Not authorized")
    
    if assignment_id:
        query = query.filter(Submission.assignment_id == assignment_id)
    
    if student_id and current_user.role != UserRole.STUDENT:
        query = query.filter(Submission.student_id == student_id)
    
    submissions = query.order_by(desc(Submission.submitted_at)).all()
    return submissions


@router.get("/{submission_id}", response_model=SubmissionDetail)
def get_submission(
    submission_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get submission details including test results"""
    submission = db.query(Submission).filter(Submission.id == submission_id).first()
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
    elif current_user.role == UserRole.FACULTY:
        if submission.assignment.course.instructor_id != current_user.id:
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
    
    # Validate required files
    if assignment.required_files:
        uploaded_filenames = [f.filename for f in files]
        for required_file in assignment.required_files:
            if required_file not in uploaded_filenames:
                raise HTTPException(
                    status_code=400,
                    detail=f"Required file missing: {required_file}"
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
    
    for upload_file in files:
        try:
            # Read file content
            file_content = await upload_file.read()
            file_size = len(file_content)
            
            # Validate file size
            if file_size > settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024:
                raise HTTPException(
                    status_code=400,
                    detail=f"File {upload_file.filename} exceeds maximum size of {settings.MAX_UPLOAD_SIZE_MB}MB"
                )
            
            if settings.USE_S3_STORAGE:
                # Upload to S3
                from io import BytesIO
                file_io = BytesIO(file_content)
                
                s3_data = s3_service.upload_submission_file(
                    file_content=file_io,
                    filename=upload_file.filename,
                    submission_id=submission.id,
                    student_id=current_user.id,
                    assignment_id=assignment_id
                )
                
                # Create file record with S3 data
                sub_file = SubmissionFile(
                    submission_id=submission.id,
                    filename=upload_file.filename,
                    original_filename=upload_file.filename,
                    file_path=s3_data['s3_url'],  # Store S3 URL
                    file_hash=s3_data['file_hash']
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
                    file_hash=file_hash
                )
                db.add(sub_file)
                
                uploaded_files_data.append({
                    'filename': upload_file.filename,
                    'file_path': str(file_path)
                })
                
                logger.info(f"File {upload_file.filename} saved locally: {file_path}")
        
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
    
    db.commit()
    db.refresh(submission)
    
    logger.info(f"Submission {submission.id} created by user {current_user.id} for assignment {assignment_id}")
    
    # Trigger autograding asynchronously (in production, use Celery/background tasks)
    # For now, we'll return and grade later
    
    return submission


@router.post("/{submission_id}/grade")
async def grade_submission(
    submission_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.FACULTY, UserRole.ADMIN]))
):
    """Trigger autograding for a submission"""
    submission = db.query(Submission).filter(Submission.id == submission_id).first()
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    
    # Check ownership
    if current_user.role == UserRole.FACULTY:
        if submission.assignment.course.instructor_id != current_user.id:
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
    current_user: User = Depends(require_role([UserRole.FACULTY, UserRole.ADMIN]))
):
    """Override submission score (faculty only)"""
    submission = db.query(Submission).filter(Submission.id == submission_id).first()
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    
    # Check ownership
    if current_user.role == UserRole.FACULTY:
        if submission.assignment.course.instructor_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not authorized")
    
    old_score = submission.final_score
    submission.final_score = new_score
    submission.score_override = True
    submission.override_reason = reason
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
    
    logger.info(f"Score overridden for submission {submission_id} by user {current_user.id}")
    
    return {"message": "Score overridden successfully", "new_score": new_score}


@router.get("/{submission_id}/download")
async def download_submission(
    submission_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Download submission files as zip"""
    submission = db.query(Submission).filter(Submission.id == submission_id).first()
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    
    # Check access
    can_access = False
    if current_user.role == UserRole.ADMIN:
        can_access = True
    elif current_user.role == UserRole.FACULTY:
        can_access = submission.assignment.course.instructor_id == current_user.id
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
