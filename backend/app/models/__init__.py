"""
Database Models Package
Exports all models for easy importing throughout the application.
"""

# User Model
from app.models.user import User, UserRole

# Course Models
from app.models.course import (
    Course, CourseStatus,
    CourseAssistant,
    Enrollment, EnrollmentStatus,
    Group, GroupMembership,
    Announcement
)

# Assignment Models
from app.models.assignment import (
    Assignment, AssignmentStatus, DifficultyLevel,
    TestCase,
    Rubric, RubricCategory, RubricItem
)

# Submission Models
from app.models.submission import (
    Submission, SubmissionStatus,
    SubmissionFile,
    TestResult,
    RubricScore,
    PlagiarismMatch
)

# Language Model
from app.models.language import (
    Language, FacultyLanguagePermission,
    DEFAULT_LANGUAGES
)

# Gamification Models
from app.models.gamification import (
    StudentProgress,
    Achievement, StudentAchievement,
    Skill, StudentSkill,
    DEFAULT_ACHIEVEMENTS, DEFAULT_SKILLS
)

# Settings Models
from app.models.settings import (
    NotificationSettings,
    UserPreferences,
)

# Audit & Security Models
from app.models.audit_log import (
    AuditLog
)

# Notification Model
from app.models.notification import (
    Notification, NotificationType
)


# All models for Alembic migrations
__all__ = [
    # User
    "User", "UserRole",
    
    # Course
    "Course", "CourseStatus",
    "CourseAssistant",
    "Enrollment", "EnrollmentStatus",
    "Group", "GroupMembership",
    "Announcement",
    
    # Assignment
    "Assignment", "AssignmentStatus", "DifficultyLevel",
    "TestCase",
    "Rubric", "RubricCategory", "RubricItem",
    
    # Submission
    "Submission", "SubmissionStatus",
    "SubmissionFile",
    "TestResult",
    "RubricScore",
    "PlagiarismMatch",
    
    # Language
    "Language", "FacultyLanguagePermission",
    "DEFAULT_LANGUAGES",
    
    # Gamification
    "StudentProgress",
    "Achievement", "StudentAchievement",
    "Skill", "StudentSkill",
    "DEFAULT_ACHIEVEMENTS", "DEFAULT_SKILLS",
    
    # Settings
    "NotificationSettings",
    "UserPreferences",
    
    # Audit
    "AuditLog",
    
    # Notification
    "Notification", "NotificationType",
]
