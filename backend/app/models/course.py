"""
Course Models - Course, Enrollment, Groups, and Announcements
"""
from datetime import datetime
from enum import Enum as PyEnum
from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey, Text, Enum, Float
from sqlalchemy.orm import relationship
from app.core.database import Base


class CourseStatus(str, PyEnum):
    DRAFT = "draft"
    ACTIVE = "active"
    ARCHIVED = "archived"


class EnrollmentStatus(str, PyEnum):
    ACTIVE = "active"
    DROPPED = "dropped"
    COMPLETED = "completed"


class Course(Base):
    """
    Course model - represents a class taught by faculty with enrolled students.
    """
    __tablename__ = "courses"
    
    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(20), index=True, nullable=False)  # e.g., CS101
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    section = Column(String(10), nullable=True)  # e.g., "A", "B"
    semester = Column(String(20), nullable=False)  # e.g., "Spring", "Fall"
    year = Column(Integer, nullable=False)
    
    # Instructor
    instructor_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # Status
    status = Column(Enum(CourseStatus), default=CourseStatus.ACTIVE)
    is_active = Column(Boolean, default=True)
    
    # Schedule
    start_date = Column(DateTime, nullable=True)
    end_date = Column(DateTime, nullable=True)
    
    # Appearance
    color = Column(String(20), nullable=True)  # For UI card color
    
    # Settings
    allow_late_submissions = Column(Boolean, default=True)
    default_late_penalty = Column(Float, default=10.0)  # Percentage per day
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    instructor = relationship("User", back_populates="taught_courses", foreign_keys=[instructor_id])
    assistants = relationship("CourseAssistant", back_populates="course", cascade="all, delete-orphan")
    enrollments = relationship("Enrollment", back_populates="course", cascade="all, delete-orphan")
    assignments = relationship("Assignment", back_populates="course", cascade="all, delete-orphan")
    groups = relationship("Group", back_populates="course", cascade="all, delete-orphan")
    announcements = relationship("Announcement", back_populates="course", cascade="all, delete-orphan")
    
    # Unique constraint on code + semester + year + section
    __table_args__ = (
        # UniqueConstraint('code', 'semester', 'year', 'section', name='unique_course_offering'),
    )
    
    def __repr__(self):
        return f"<Course {self.code} - {self.name}>"


class Enrollment(Base):
    """
    Enrollment - Student enrollment in a course.
    Tracks progress and status.
    """
    __tablename__ = "enrollments"
    
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=False)
    
    # Status
    status = Column(Enum(EnrollmentStatus), default=EnrollmentStatus.ACTIVE)
    
    # Progress tracking
    progress_percentage = Column(Float, default=0.0)  # 0-100
    current_grade = Column(Float, nullable=True)  # Current calculated grade
    
    # Timestamps
    enrolled_at = Column(DateTime, default=datetime.utcnow)
    dropped_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    
    # Relationships
    student = relationship("User", back_populates="enrollments", foreign_keys=[student_id])
    course = relationship("Course", back_populates="enrollments")
    
    def __repr__(self):
        return f"<Enrollment student={self.student_id} course={self.course_id}>"


class CourseAssistant(Base):
    """
    CourseAssistant - Links assistants (grading TAs) to courses they help with.
    """
    __tablename__ = "course_assistants"

    id = Column(Integer, primary_key=True, index=True)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=False)
    assistant_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    assigned_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    course = relationship("Course", back_populates="assistants")
    assistant = relationship("User", back_populates="assistant_courses", foreign_keys=[assistant_id])

    def __repr__(self):
        return f"<CourseAssistant course={self.course_id} assistant={self.assistant_id}>"


class Group(Base):
    """
    Group - For group assignments/projects.
    """
    __tablename__ = "groups"
    
    id = Column(Integer, primary_key=True, index=True)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=False)
    name = Column(String(100), nullable=False)
    max_members = Column(Integer, default=4)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    course = relationship("Course", back_populates="groups")
    memberships = relationship("GroupMembership", back_populates="group", cascade="all, delete-orphan")
    submissions = relationship("Submission", back_populates="group")
    
    def __repr__(self):
        return f"<Group {self.name}>"


class GroupMembership(Base):
    """
    GroupMembership - Tracks which students are in which groups.
    """
    __tablename__ = "group_memberships"
    
    id = Column(Integer, primary_key=True, index=True)
    group_id = Column(Integer, ForeignKey("groups.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    is_leader = Column(Boolean, default=False)
    
    joined_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    group = relationship("Group", back_populates="memberships")
    user = relationship("User", back_populates="group_memberships")
    
    def __repr__(self):
        return f"<GroupMembership group={self.group_id} user={self.user_id}>"


class Announcement(Base):
    """
    Announcement - Course announcements from faculty.
    """
    __tablename__ = "announcements"
    
    id = Column(Integer, primary_key=True, index=True)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=False)
    author_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    title = Column(String(255), nullable=False)
    content = Column(Text, nullable=False)
    is_pinned = Column(Boolean, default=False)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    course = relationship("Course", back_populates="announcements")
    author = relationship("User", back_populates="announcements", foreign_keys=[author_id])
    
    def __repr__(self):
        return f"<Announcement {self.title}>"
