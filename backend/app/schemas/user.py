from typing import Optional
from datetime import datetime
from pydantic import BaseModel, EmailStr, Field, validator
from app.models.user import UserRole


class UserBase(BaseModel):
    email: EmailStr
    full_name: str
    role: UserRole = UserRole.STUDENT
    student_id: Optional[str] = None


class UserCreate(UserBase):
    password: str = Field(..., min_length=8)
    
    @validator('password')
    def validate_password(cls, v):
        from app.core.security import validate_password_strength
        is_valid, message = validate_password_strength(v)
        if not is_valid:
            raise ValueError(message)
        return v


class AdminUserCreate(UserCreate):
    is_active: bool = True
    is_verified: bool = True

    @validator("student_id", always=True)
    def validate_student_id_for_role(cls, v, values):
        role = values.get("role")
        if role == UserRole.STUDENT and not v:
            raise ValueError("Student ID is required for student accounts")
        return v


class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None
    student_id: Optional[str] = None
    is_active: Optional[bool] = None


class UserPasswordChange(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=8)
    
    @validator('new_password')
    def validate_password(cls, v):
        from app.core.security import validate_password_strength
        is_valid, message = validate_password_strength(v)
        if not is_valid:
            raise ValueError(message)
        return v


class AdminPasswordReset(BaseModel):
    new_password: str = Field(..., min_length=8)

    @validator("new_password")
    def validate_password(cls, v):
        from app.core.security import validate_password_strength
        is_valid, message = validate_password_strength(v)
        if not is_valid:
            raise ValueError(message)
        return v


class User(UserBase):
    id: int
    is_active: bool
    is_verified: bool
    created_at: datetime
    last_login: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class UserInDB(User):
    hashed_password: str
