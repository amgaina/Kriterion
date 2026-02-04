from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel
from app.models.course import CourseStatus, EnrollmentStatus


class CourseBase(BaseModel):
    code: str
    name: str
    description: Optional[str] = None
    section: Optional[str] = None
    semester: str
    year: int
    color: Optional[str] = None


class CourseCreate(CourseBase):
    pass


class CourseUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    section: Optional[str] = None
    semester: Optional[str] = None
    year: Optional[int] = None
    status: Optional[CourseStatus] = None
    is_active: Optional[bool] = None
    color: Optional[str] = None
    allow_late_submissions: Optional[bool] = None
    default_late_penalty: Optional[float] = None


class Course(CourseBase):
    id: int
    instructor_id: int
    status: CourseStatus
    is_active: bool
    allow_late_submissions: bool
    default_late_penalty: float
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class EnrollmentCreate(BaseModel):
    student_id: int
    course_id: int


class Enrollment(BaseModel):
    id: int
    student_id: int
    course_id: int
    status: EnrollmentStatus
    progress_percentage: float
    current_grade: Optional[float] = None
    enrolled_at: datetime
    dropped_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class GroupCreate(BaseModel):
    course_id: int
    name: str
    max_members: int = 4


class Group(BaseModel):
    id: int
    course_id: int
    name: str
    max_members: int
    created_at: datetime
    
    class Config:
        from_attributes = True


class GroupMembershipCreate(BaseModel):
    group_id: int
    user_id: int
    is_leader: bool = False


class GroupMembership(BaseModel):
    id: int
    group_id: int
    user_id: int
    is_leader: bool
    joined_at: datetime
    
    class Config:
        from_attributes = True


class AnnouncementCreate(BaseModel):
    course_id: int
    author_id: int
    title: str
    content: str
    is_pinned: bool = False


class Announcement(BaseModel):
    id: int
    course_id: int
    author_id: int
    title: str
    content: str
    is_pinned: bool
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
