from typing import List, Optional
import os
import tempfile
import secrets
import string
import re
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, text
from datetime import datetime, timedelta

from app.api.deps import get_db, get_current_user, require_role
from app.models import User, UserRole, AuditLog, Course, Assignment
from app.schemas.user import User as UserSchema, UserUpdate, UserCreate
from app.schemas.audit_log import AuditLog as AuditLogSchema
from app.core.security import get_password_hash
from app.core.logging import logger
from app.core.config import settings
from app.core.celery_app import celery_app
from app.services.s3_storage import s3_service
from pydantic import BaseModel, EmailStr

router = APIRouter()


class BulkStudentImportItem(BaseModel):
    email: EmailStr
    full_name: Optional[str] = None
    student_id: str


class BulkStudentImportRequest(BaseModel):
    students: List[BulkStudentImportItem]


def _generate_temp_password(length: int = 12) -> str:
    """Generate a password that satisfies strength requirements."""
    if length < 8:
        length = 8

    lower = string.ascii_lowercase
    upper = string.ascii_uppercase
    digits = string.digits
    symbols = "!@#$%^&*()_+-=[]{}|;:,.<>?"
    all_chars = lower + upper + digits + symbols

    required = [
        secrets.choice(lower),
        secrets.choice(upper),
        secrets.choice(digits),
        secrets.choice(symbols),
    ]
    remaining = [secrets.choice(all_chars) for _ in range(length - len(required))]
    password_chars = required + remaining
    secrets.SystemRandom().shuffle(password_chars)
    return "".join(password_chars)


def _derive_name_from_email(email: str) -> str:
    local_part = email.split("@", 1)[0]
    tokens = [t for t in re.split(r"[._\-\s]+", local_part) if t]
    if not tokens:
        return "Student"
    return " ".join(token.capitalize() for token in tokens)


@router.get("/users", response_model=List[UserSchema])
def list_users(
    role: str = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.ADMIN]))
):
    """List all users (admin only)"""
    query = db.query(User)
    
    if role:
        try:
            role_enum = UserRole(role.upper())
            query = query.filter(User.role == role_enum)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid role")
    
    users = query.offset(skip).limit(limit).all()
    return users


@router.post("/users", response_model=UserSchema, status_code=status.HTTP_201_CREATED)
def create_user(
    user_in: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.ADMIN]))
):
    """Create a new user (admin only)"""
    # Check if user already exists
    existing_user = db.query(User).filter(User.email == user_in.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Check student_id uniqueness if provided
    if user_in.student_id:
        existing_student = db.query(User).filter(User.student_id == user_in.student_id).first()
        if existing_student:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Student ID already registered"
            )
    
    # Create user
    user = User(
        email=user_in.email,
        hashed_password=get_password_hash(user_in.password),
        full_name=user_in.full_name,
        role=user_in.role,
        student_id=user_in.student_id,
        is_active=user_in.is_active if getattr(user_in, 'is_active', None) is not None else True,
        is_verified=True
    )
    
    db.add(user)
    db.commit()
    db.refresh(user)
    
    # Audit log
    audit = AuditLog(
        user_id=current_user.id,
        event_type="user_created",
        description=f"User {user.email} created with role {user.role.value} by admin"
    )
    db.add(audit)
    db.commit()

    # If a welcome email is requested, record it and log. Integrate actual email sending
    # with your async task queue or mailer later.
    if getattr(user_in, 'send_welcome_email', False):
        welcome_audit = AuditLog(
            user_id=current_user.id,
            event_type="welcome_email_requested",
            description=f"Welcome email requested for {user.email}"
        )
        db.add(welcome_audit)
        db.commit()
        logger.info(f"Welcome email requested for user {user.email} by admin {current_user.id}")

    return user


@router.get("/users/{user_id}", response_model=UserSchema)
def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.ADMIN]))
):
    """Get user details (admin only)"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.put("/users/{user_id}", response_model=UserSchema)
def update_user(
    user_id: int,
    user_update: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.ADMIN]))
):
    """Update user (admin only)"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    old_role = user.role
    
    # Update fields
    for field, value in user_update.model_dump(exclude_unset=True).items():
        setattr(user, field, value)
    
    user.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(user)
    
    # Audit log
    if old_role != user.role:
        audit = AuditLog(
            user_id=current_user.id,
            event_type="role_changed",
            description=f"User role changed from {old_role} to {user.role}"
        )
        db.add(audit)
        db.commit()
    
    logger.info(f"User {user_id} updated by admin {current_user.id}")
    return user


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.ADMIN]))
):
    """Delete user (admin only)"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    
    # Audit log before deletion
    audit = AuditLog(
        user_id=current_user.id,
        event_type="user_deleted",
        description=f"User {user.email} deleted by admin"
    )
    db.add(audit)
    
    db.delete(user)
    db.commit()
    
    logger.info(f"User {user_id} deleted by admin {current_user.id}")
    return None


@router.post("/users/{user_id}/activate")
def activate_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.ADMIN]))
):
    """Activate user account (admin only)"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user.is_active = True
    user.updated_at = datetime.utcnow()
    db.commit()
    
    # Audit log
    audit = AuditLog(
        user_id=current_user.id,
        event_type="user_activated",
        description=f"User {user.email} activated"
    )
    db.add(audit)
    db.commit()
    
    return {"message": "User activated successfully"}


@router.post("/users/{user_id}/deactivate")
def deactivate_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.ADMIN]))
):
    """Deactivate user account (admin only)"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot deactivate yourself")
    
    user.is_active = False
    user.updated_at = datetime.utcnow()
    db.commit()
    
    # Audit log
    audit = AuditLog(
        user_id=current_user.id,
        event_type="user_deactivated",
        description=f"User {user.email} deactivated"
    )
    db.add(audit)
    db.commit()
    
    return {"message": "User deactivated successfully"}


@router.post("/users/{user_id}/reset-password")
def admin_reset_password(
    user_id: int,
    new_password: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.ADMIN]))
):
    """Reset user password (admin only)"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user.hashed_password = get_password_hash(new_password)
    user.password_changed_at = datetime.utcnow()
    user.updated_at = datetime.utcnow()
    db.commit()
    
    # Audit log
    audit = AuditLog(
        user_id=current_user.id,
        event_type="password_reset",
        description=f"Password reset for user {user.email} by admin"
    )
    db.add(audit)
    db.commit()
    
    logger.info(f"Password reset for user {user_id} by admin {current_user.id}")
    return {"message": "Password reset successfully"}


@router.get("/audit-logs", response_model=List[AuditLogSchema])
def get_audit_logs(
    user_id: int = None,
    event_type: str = None,
    days: int = 30,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.ADMIN]))
):
    """Get audit logs (admin only)"""
    query = db.query(AuditLog)
    
    # Filter by user
    if user_id:
        query = query.filter(AuditLog.user_id == user_id)
    
    # Filter by event type
    if event_type:
        query = query.filter(AuditLog.event_type == event_type)
    
    # Filter by date range
    since = datetime.utcnow() - timedelta(days=days)
    query = query.filter(AuditLog.created_at >= since)
    
    # Order by most recent
    query = query.order_by(AuditLog.created_at.desc())
    
    logs = query.offset(skip).limit(limit).all()
    return logs


@router.get("/system-stats")
def get_system_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.ADMIN]))
):
    """Get system-wide statistics (admin only)"""
    # User statistics
    total_users = db.query(func.count(User.id)).scalar()
    active_users = db.query(func.count(User.id)).filter(User.is_active == True).scalar()
    students = db.query(func.count(User.id)).filter(User.role == UserRole.STUDENT).scalar()
    faculty = db.query(func.count(User.id)).filter(User.role == UserRole.FACULTY).scalar()
    admins = db.query(func.count(User.id)).filter(User.role == UserRole.ADMIN).scalar()
    
    # Course statistics
    total_courses = db.query(func.count(Course.id)).scalar()
    active_courses = db.query(func.count(Course.id)).filter(Course.is_active == True).scalar()
    
    # Assignment statistics
    total_assignments = db.query(func.count(Assignment.id)).scalar()
    published_assignments = db.query(func.count(Assignment.id)).filter(
        Assignment.is_published == True
    ).scalar()
    
    # Recent activity (last 24 hours)
    since_24h = datetime.utcnow() - timedelta(hours=24)
    recent_logins = db.query(func.count(AuditLog.id)).filter(
        and_(
            AuditLog.event_type == "user_login",
            AuditLog.created_at >= since_24h
        )
    ).scalar()
    
    recent_submissions = db.query(func.count(AuditLog.id)).filter(
        and_(
            AuditLog.event_type == "submission_created",
            AuditLog.created_at >= since_24h
        )
    ).scalar()
    
    return {
        "users": {
            "total": total_users,
            "active": active_users,
            "students": students,
            "faculty": faculty,
            "admins": admins
        },
        "courses": {
            "total": total_courses,
            "active": active_courses
        },
        "assignments": {
            "total": total_assignments,
            "published": published_assignments
        },
        "recent_activity": {
            "logins_24h": recent_logins,
            "submissions_24h": recent_submissions
        }
    }


@router.post("/students/bulk-import")
def bulk_import_students(
    request: BulkStudentImportRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.ADMIN]))
):
    """Bulk create student accounts from a parsed file payload (admin only)."""
    if not request.students:
        raise HTTPException(status_code=400, detail="No students provided")

    created = 0
    existing_emails: List[str] = []
    duplicate_emails_in_file: List[str] = []
    duplicate_student_ids_in_file: List[str] = []
    existing_student_ids: List[str] = []

    input_emails = [s.email.strip().lower() for s in request.students if s.email]
    input_student_ids = [s.student_id.strip() for s in request.students if s.student_id.strip()]

    existing_email_set = set(
        email for (email,) in db.query(User.email).filter(User.email.in_(input_emails)).all()
    )
    existing_student_id_set = set()
    if input_student_ids:
        existing_student_id_set = set(
            sid for (sid,) in db.query(User.student_id).filter(User.student_id.in_(input_student_ids)).all()
        )

    seen_emails = set()
    seen_student_ids = set()

    for row in request.students:
        email = row.email.strip().lower()
        student_id = row.student_id.strip()

        if email in seen_emails:
            duplicate_emails_in_file.append(email)
            continue
        seen_emails.add(email)

        if email in existing_email_set:
            existing_emails.append(email)
            continue

        if student_id in seen_student_ids:
            duplicate_student_ids_in_file.append(student_id)
            continue
        seen_student_ids.add(student_id)

        if student_id in existing_student_id_set:
            existing_student_ids.append(student_id)
            continue

        full_name = (row.full_name or "").strip() or _derive_name_from_email(email)

        user = User(
            email=email,
            hashed_password=get_password_hash(_generate_temp_password()),
            full_name=full_name,
            role=UserRole.STUDENT,
            student_id=student_id,
            is_active=True,
            is_verified=True,
        )
        db.add(user)
        created += 1

    db.commit()

    audit = AuditLog(
        user_id=current_user.id,
        event_type="bulk_student_import",
        description=f"Bulk imported {created} student account(s)"
    )
    db.add(audit)
    db.commit()

    return {
        "created": created,
        "skipped": len(existing_emails) + len(duplicate_emails_in_file) + len(duplicate_student_ids_in_file) + len(existing_student_ids),
        "existing_emails": sorted(list(set(existing_emails))),
        "duplicate_emails_in_file": sorted(list(set(duplicate_emails_in_file))),
        "existing_student_ids": sorted(list(set(existing_student_ids))),
        "duplicate_student_ids_in_file": sorted(list(set(duplicate_student_ids_in_file))),
    }


@router.get("/system-health")
def get_system_health(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.ADMIN]))
):
    """Get health status for core services (admin only)."""
    services = [
        {"name": "API Server", "status": "online"},
        {"name": "Database", "status": "offline"},
        {"name": "File Storage", "status": "offline"},
        {"name": "Grading Engine", "status": "offline"},
    ]

    # Database: verify query execution through current DB session.
    try:
        db.execute(text("SELECT 1"))
        services[1]["status"] = "online"
    except Exception as e:
        logger.warning(f"Database health check failed: {str(e)}")

    # File storage: check S3 bucket access when enabled; otherwise local directory writability.
    try:
        if settings.USE_S3_STORAGE:
            s3_service.s3_client.head_bucket(Bucket=s3_service.bucket_name)
        else:
            target_dir = settings.SUBMISSIONS_DIR
            os.makedirs(target_dir, exist_ok=True)
            with tempfile.NamedTemporaryFile(dir=target_dir, delete=True) as temp_file:
                temp_file.write(b"ok")
                temp_file.flush()
        services[2]["status"] = "online"
    except Exception as e:
        logger.warning(f"File storage health check failed: {str(e)}")

    # Grading engine: check Celery worker availability.
    try:
        inspector = celery_app.control.inspect(timeout=1)
        ping = inspector.ping() if inspector else None
        if ping:
            services[3]["status"] = "online"
    except Exception as e:
        logger.warning(f"Grading engine health check failed: {str(e)}")

    overall_status = "online" if all(s["status"] == "online" for s in services) else "degraded"

    return {
        "overall_status": overall_status,
        "services": services,
        "checked_at": datetime.utcnow().isoformat() + "Z",
    }


@router.post("/languages/add")
def add_programming_language(
    language_name: str,
    file_extension: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.ADMIN]))
):
    """Add a new programming language (admin only)"""
    # This would typically update a system configuration table
    # For now, we'll just log it
    
    audit = AuditLog(
        user_id=current_user.id,
        event_type="language_added",
        description=f"Programming language added: {language_name} (.{file_extension})"
    )
    db.add(audit)
    db.commit()
    
    logger.info(f"Programming language {language_name} added by admin {current_user.id}")
    return {"message": f"Language {language_name} added successfully"}