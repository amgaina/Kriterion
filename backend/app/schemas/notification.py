"""
Notification schemas - Input/output models for notification endpoints
"""
from datetime import datetime
from enum import Enum as PyEnum
from pydantic import BaseModel
from typing import Optional


class NotificationType(str, PyEnum):
    # Assignment notifications
    ASSIGNMENT_NEW = "assignment_new"
    ASSIGNMENT_DUE = "assignment_due"
    ASSIGNMENT_GRADED = "assignment_graded"
    # Submission notifications
    SUBMISSION_RECEIVED = "submission_received"
    # Grade notifications
    GRADE_POSTED = "grade_posted"
    # Course enrollment
    STUDENT_ENROLLED = "student_enrolled"
    # Admin/System
    NEW_USER_REGISTERED = "new_user_registered"
    COURSE_APPROVAL_REQUIRED = "course_approval_required"
    SYSTEM_ALERT = "system_alert"


class NotificationCreateSchema(BaseModel):
    type: NotificationType
    title: str
    message: str
    link: Optional[str] = None
    course_id: Optional[int] = None
    assignment_id: Optional[int] = None
    submission_id: Optional[int] = None


class NotificationUpdateSchema(BaseModel):
    is_read: Optional[bool] = None


class NotificationSchema(BaseModel):
    id: int
    user_id: int
    type: NotificationType
    title: str
    message: str
    link: Optional[str] = None
    course_id: Optional[int] = None
    assignment_id: Optional[int] = None
    submission_id: Optional[int] = None
    is_read: bool
    read_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True
        json_encoders = {
            datetime: lambda v: v.isoformat() if v else None
        }
