"""
Notification schemas - Input/output models for notification endpoints
"""
from datetime import datetime
from enum import Enum as PyEnum
from pydantic import BaseModel
from typing import Optional


class NotificationType(str, PyEnum):
    ASSIGNMENT_NEW = "assignment_new"
    ASSIGNMENT_DUE = "assignment_due"
    ASSIGNMENT_GRADED = "assignment_graded"
    SUBMISSION_RECEIVED = "submission_received"
    HOMEWORK_POSTED = "HOMEWORK_POSTED"
    HOMEWORK_DUE = "HOMEWORK_DUE"
    GRADE_POSTED = "GRADE_POSTED"
    NEW_SUBMISSION_RECEIVED = "NEW_SUBMISSION_RECEIVED"
    GRADING_PENDING = "GRADING_PENDING"
    NEW_USER_REGISTERED = "NEW_USER_REGISTERED"
    COURSE_APPROVAL_REQUIRED = "COURSE_APPROVAL_REQUIRED"
    SYSTEM_ALERT = "SYSTEM_ALERT"
    COURSE_ASSIGNED = "course_assigned"


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
