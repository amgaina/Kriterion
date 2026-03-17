from typing import Optional, List
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from sqlalchemy import and_
from datetime import datetime
from app.core.database import get_db
from app.core.security import decode_token
from app.models import User, UserRole, Assignment
from app.core.logging import set_request_id

security = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    """Get current authenticated user"""
    now = datetime.utcnow()
    updated_rows = db.query(Assignment).filter(
        and_(
            Assignment.is_published == False,
            Assignment.publish_at.isnot(None),
            Assignment.publish_at <= now,
        )
    ).update({"is_published": True}, synchronize_session=False)
    if updated_rows:
        db.commit()

    token = credentials.credentials
    payload = decode_token(token)
    
    if not payload or payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    user_id_str = payload.get("sub")
    if user_id_str is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
        )
    
    try:
        user_id = int(user_id_str)
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
        )
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive"
        )
    
    return user


def get_current_active_user(
    current_user: User = Depends(get_current_user)
) -> User:
    """Ensure user is active"""
    return current_user


def require_role(required_roles: List[UserRole]):
    """Require one of multiple roles"""
    def role_checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in required_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. One of {required_roles} roles required."
            )
        return current_user
    return role_checker


def require_roles(*roles: UserRole):
    """Require one of multiple roles (variadic version)"""
    def role_checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. One of {list(roles)} roles required."
            )
        return current_user
    return role_checker


async def log_request(request: Request):
    """Middleware to log requests and set request ID"""
    request_id = request.headers.get("X-Request-ID")
    set_request_id(request_id)
    return request_id
