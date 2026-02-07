from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func, or_, and_
from datetime import datetime, timedelta

from app.api.deps import get_db, get_current_user, require_role
from app.models import User, UserRole, AuditLog, Course, Assignment
from app.schemas.user import User as UserSchema, UserUpdate, UserCreate
from app.schemas.audit_log import AuditLog as AuditLogSchema
from app.core.security import get_password_hash
from app.core.logging import logger

router = APIRouter()


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
        is_active=True,
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
    
    logger.info(f"User {user.id} created by admin {current_user.id}")
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
