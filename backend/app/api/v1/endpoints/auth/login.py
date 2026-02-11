"""
Login endpoint for user authentication.

This module handles user login by:
1. Validating email and password
2. Checking if user exists and is active
3. Returning JWT tokens and user information
"""

from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr

from app.core.database import get_db
from app.core.security import (
    verify_password,
    create_access_token,
    create_refresh_token
)
from app.models import User, AuditLog
from app.api.deps import get_current_user

router = APIRouter()


# ============== Schemas ==============

class LoginRequest(BaseModel):
    """Request body for login endpoint"""
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    """User information returned after login"""
    id: int
    email: str
    full_name: str
    role: str
    student_id: str | None = None
    is_active: bool
    is_verified: bool
    last_login: datetime | None = None
    
    class Config:
        from_attributes = True


class LoginResponse(BaseModel):
    """Response returned after successful login"""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserResponse


# ============== Endpoints ==============

@router.post("/login", response_model=LoginResponse)
def login(
    login_data: LoginRequest,
    db: Session = Depends(get_db)
):
    """
    Authenticate user and return tokens with user information.
    
    **Request Body:**
    - `email`: User's email address
    - `password`: User's password
    
    **Returns:**
    - `access_token`: JWT access token for API authentication
    - `refresh_token`: JWT refresh token for obtaining new access tokens
    - `token_type`: Always "bearer"
    - `user`: User information (id, email, full_name, role, etc.)
    
    **Errors:**
    - 401: Invalid email or password
    - 403: User account is inactive
    """
    
    # Step 1: Find user by email
    user = db.query(User).filter(User.email == login_data.email).first()
    
    # Step 2: Verify user exists and password is correct
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not verify_password(login_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Step 3: Check if user account is active
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive. Please contact an administrator."
        )
    
    # Step 4: Update last login timestamp
    user.last_login = datetime.utcnow()
    db.commit()
    
    # Step 5: Create JWT tokens
    # The 'sub' (subject) claim contains the user ID as a string (JWT spec requires sub to be a string)
    access_token = create_access_token(data={"sub": str(user.id)})
    refresh_token = create_refresh_token(data={"sub": str(user.id)})
    
    # Step 6: Log the login event for auditing
    audit = AuditLog(
        user_id=user.id,
        event_type="user_login",
        description=f"User {user.email} logged in successfully"
    )
    db.add(audit)
    db.commit()
    
    # Step 7: Return tokens and user information
    return LoginResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        user=UserResponse(
            id=user.id,
            email=user.email,
            full_name=user.full_name,
            role=user.role.value,  # Convert enum to string
            student_id=user.student_id,
            is_active=user.is_active,
            is_verified=user.is_verified,
            last_login=user.last_login
        )
    )


@router.get("/me", response_model=UserResponse)
def get_current_user_info(
    current_user: User = Depends(get_current_user)
):
    """
    Get current authenticated user's information.
    
    **Returns:**
    - User information (id, email, full_name, role, etc.)
    
    **Errors:**
    - 401: Not authenticated or invalid token
    """
    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        full_name=current_user.full_name,
        role=current_user.role.value,
        student_id=current_user.student_id,
        is_active=current_user.is_active,
        is_verified=current_user.is_verified,
        last_login=current_user.last_login
    )
