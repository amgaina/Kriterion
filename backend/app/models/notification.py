"""
Notification Model - In-app notifications for users
"""
from datetime import datetime
from enum import Enum as PyEnum
from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey, Text, Enum
from sqlalchemy.orm import relationship
from app.core.database import Base


class NotificationType(str, PyEnum):
    ASSIGNMENT_NEW = "assignment_new"
    ASSIGNMENT_DUE = "assignment_due"
    ASSIGNMENT_GRADED = "assignment_graded"
    SUBMISSION_RECEIVED = "submission_received"


class Notification(Base):
    """
    Notification - In-app notification for users.
    """
    __tablename__ = "notifications"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # Content
    type = Column(Enum(NotificationType), nullable=False)
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    
    # Link to related resource
    link = Column(String(255), nullable=True)  # URL to navigate to
    
    # Related entities
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=True)
    assignment_id = Column(Integer, ForeignKey("assignments.id"), nullable=True)
    submission_id = Column(Integer, ForeignKey("submissions.id"), nullable=True)
    
    # Status
    is_read = Column(Boolean, default=False)
    read_at = Column(DateTime, nullable=True)
    
    # Email status
    email_sent = Column(Boolean, default=False)
    email_sent_at = Column(DateTime, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    
    def __repr__(self):
        return f"<Notification {self.type} for user {self.user_id}>"
