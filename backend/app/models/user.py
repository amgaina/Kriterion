"""
User Model - Comprehensive user management for Admin, Faculty, and Students
"""
from datetime import datetime
from enum import Enum as PyEnum
from sqlalchemy import Column, Integer, String, DateTime, Boolean, Enum
from sqlalchemy.orm import relationship
from app.core.database import Base


class UserRole(str, PyEnum):
    STUDENT = "STUDENT"
    FACULTY = "FACULTY"
    ASSISTANT = "ASSISTANT"
    ADMIN = "ADMIN"


class User(Base):
    """
    Main user model supporting Admin, Faculty, and Student roles.
    Each role has specific relationships and capabilities.
    """
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    role = Column(Enum(UserRole), nullable=False, default=UserRole.STUDENT)
    
    # Status
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)
    
    # Student specific
    student_id = Column(String(50), unique=True, nullable=True, index=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_login = Column(DateTime, nullable=True)
    password_changed_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships - Course & Enrollment
    enrollments = relationship("Enrollment", back_populates="student", cascade="all, delete-orphan",
                              foreign_keys="Enrollment.student_id")
    taught_courses = relationship("Course", back_populates="instructor", foreign_keys="Course.instructor_id")
    assistant_courses = relationship("CourseAssistant", back_populates="assistant", cascade="all, delete-orphan",
                                     foreign_keys="CourseAssistant.assistant_id")
    
    # Relationships - Submissions
    submissions = relationship("Submission", back_populates="student", foreign_keys="Submission.student_id",
                              cascade="all, delete-orphan")
    graded_submissions = relationship("Submission", back_populates="grader", foreign_keys="Submission.graded_by")
    
    # Relationships - Groups
    group_memberships = relationship("GroupMembership", back_populates="user", cascade="all, delete-orphan")
    
    # Relationships - Gamification (Student)
    progress = relationship("StudentProgress", back_populates="student", uselist=False, cascade="all, delete-orphan")
    achievements = relationship("StudentAchievement", back_populates="student", cascade="all, delete-orphan")
    skills = relationship("StudentSkill", back_populates="student", cascade="all, delete-orphan")
    
    # Relationships - Settings
    notification_settings = relationship("NotificationSettings", back_populates="user", uselist=False,
                                        cascade="all, delete-orphan")
    preferences = relationship("UserPreferences", back_populates="user", uselist=False, cascade="all, delete-orphan")
    
    # Relationships - Faculty Language Permissions
    language_permissions = relationship("FacultyLanguagePermission", back_populates="faculty",
                                        foreign_keys="FacultyLanguagePermission.faculty_id",
                                        cascade="all, delete-orphan")
    
    # Relationships - Audit
    audit_logs = relationship("AuditLog", back_populates="user", cascade="all, delete-orphan")
    
    # Relationships - Announcements
    announcements = relationship("Announcement", back_populates="author", foreign_keys="Announcement.author_id")
    
    def __repr__(self):
        return f"<User {self.email} ({self.role})>"
