from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.api.deps import get_db, get_current_user, require_role
from app.core.security import (
    verify_password,
    get_password_hash,
    create_access_token,
    create_refresh_token,
    decode_token
)
from app.models import User, AuditLog, UserRole
from app.schemas.token import Token, LoginRequest, RefreshTokenRequest
from app.schemas.user import UserCreate, User as UserSchema
from app.core.config import settings

router = APIRouter()
limiter = Limiter(key_func=get_remote_address)


@router.post("/register", response_model=UserSchema, status_code=status.HTTP_201_CREATED)
def register(
    user_in: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.ADMIN]))
):
    """Register a new user (admin only)"""
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
        student_id=user_in.student_id
    )
    
    db.add(user)
    db.commit()
    db.refresh(user)
    
    # Audit log
    audit = AuditLog(
        user_id=user.id,
        event_type="user_registration",
        description=f"User {user.email} registered"
    )
    db.add(audit)
    db.commit()
    
    return user


@router.post("/login", response_model=Token)
def login(
    login_data: LoginRequest,
    db: Session = Depends(get_db)
):
    """Login and get access token"""
    user = db.query(User).filter(User.email == login_data.email).first()
    
    if not user or not verify_password(login_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive"
        )
    
    # Update last login
    user.last_login = datetime.utcnow()
    db.commit()
    
    # Create tokens
    access_token = create_access_token(data={"sub": user.id})
    refresh_token = create_refresh_token(data={"sub": user.id})
    
    # Audit log
    audit = AuditLog(
        user_id=user.id,
        event_type="user_login",
        description=f"User {user.email} logged in"
    )
    db.add(audit)
    db.commit()
    
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer"
    }


@router.post("/refresh", response_model=Token)
def refresh_token(
    refresh_data: RefreshTokenRequest,
    db: Session = Depends(get_db)
):
    """Refresh access token"""
    payload = decode_token(refresh_data.refresh_token)
    
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token"
        )
    
    user_id: Optional[int] = payload.get("sub")
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token"
        )
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive"
        )
    
    # Create new tokens
    access_token = create_access_token(data={"sub": user.id})
    new_refresh_token = create_refresh_token(data={"sub": user.id})
    
    return {
        "access_token": access_token,
        "refresh_token": new_refresh_token,
        "token_type": "bearer"
    }


@router.get("/me", response_model=UserSchema)
def get_current_user_info(
    current_user: User = Depends(get_current_user)
):
    """Get current user information"""
    return current_user
