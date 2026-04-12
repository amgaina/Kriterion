"""
Assignment Model - Comprehensive assignment management with test cases and grading
"""
from datetime import datetime
from enum import Enum as PyEnum
from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey, Text, Float, JSON
from sqlalchemy.orm import relationship
from app.core.database import Base


class AssignmentStatus(str, PyEnum):
    DRAFT = "draft"
    PUBLISHED = "published"
    CLOSED = "closed"


class Assignment(Base):
    """
    Assignment - Programming assignment with test cases, grading rubric,
    plagiarism checking, and AI detection.
    """
    __tablename__ = "assignments"
    
    id = Column(Integer, primary_key=True, index=True)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=False, index=True)
    
    # Basic info
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    instructions = Column(Text, nullable=True)  # Markdown supported
    
    # Programming settings
    language_id = Column(Integer, ForeignKey("languages.id"), nullable=False)
    # Utility files stored as list of {"filename": str, "s3_key": str, "size": int, ...}
    utility_files_json = Column(JSON, nullable=True)
    
    # Scoring
    max_score = Column(Float, default=100.0)
    passing_score = Column(Float, default=60.0)
    
    # Due date & late policy
    start_date = Column(DateTime, nullable=True)
    due_date = Column(DateTime, nullable=False)
    allow_late = Column(Boolean, default=True)
    late_penalty_per_day = Column(Float, default=10.0)  # Percentage
    max_late_days = Column(Integer, default=7)
    
    # Submission settings
    max_attempts = Column(Integer, default=0)  # 0 = unlimited
    max_file_size_mb = Column(Integer, default=10)
    allowed_file_extensions = Column(JSON, nullable=True)  # [".py", ".java"]
    
    # Group settings
    allow_groups = Column(Boolean, default=False)
    max_group_size = Column(Integer, default=4)
    
    # Plagiarism & AI Detection
    enable_plagiarism_check = Column(Boolean, default=True)
    plagiarism_threshold = Column(Float, default=30.0)  # Percentage to flag
    enable_ai_detection = Column(Boolean, default=True)
    ai_detection_threshold = Column(Float, default=50.0)  # Percentage to flag
    
    # Status and publishing
    is_published = Column(Boolean, default=False)
    grades_published = Column(Boolean, default=False)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    course = relationship("Course", back_populates="assignments")
    language = relationship("Language", back_populates="assignments")
    test_cases = relationship("TestCase", back_populates="assignment", cascade="all, delete-orphan")
    rubric_rows = relationship("Rubric", back_populates="assignment", cascade="all, delete-orphan",
                               order_by="Rubric.id")
    submissions = relationship("Submission", back_populates="assignment", cascade="all, delete-orphan")

    @property
    def rubric(self):
        """For API response: build rubric payload from rubric_rows (id, name, description, weight, points, min_points, max_points)."""
        if not self.rubric_rows:
            return None
        total = sum(getattr(row, "points", 0) or 0 for row in self.rubric_rows)
        return {
            "items": [
                {
                    "id": row.rubric_item.id,
                    "name": row.rubric_item.name,
                    "description": getattr(row.rubric_item, "description", None) or None,
                    "weight": row.weight,
                    "points": getattr(row, "points", 0) or 0,
                    "min_points": getattr(row, "min_points", 0) or 0,
                    "max_points": getattr(row, "max_points", 5) or 5,
                }
                for row in self.rubric_rows
            ],
            "total_points": total,
        }

    def __repr__(self):
        return f"<Assignment {self.title}>"


class TestCase(Base):
    """
    TestCase - Individual test case for an assignment.
    Can be public (visible to students) or hidden.
    """
    __tablename__ = "test_cases"
    
    id = Column(Integer, primary_key=True, index=True)
    assignment_id = Column(Integer, ForeignKey("assignments.id"), nullable=False)
    
    # Test info
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    
    # Input/Output: stdin or file for input; text or file for expected output
    input_data = Column(Text, nullable=True)
    input_type = Column(String(20), default="stdin", nullable=False)  # 'stdin' | 'file'
    input_file_s3_key = Column(String(512), nullable=True)
    input_filename = Column(String(255), nullable=True)  # e.g. input.txt (single file; used when input_files_json is empty)
    input_files_json = Column(JSON, nullable=True)  # list of {"filename": str, "s3_key": str} for multiple input files
    expected_output = Column(Text, nullable=True)
    expected_output_type = Column(String(20), default="text", nullable=False)  # 'text' | 'file'
    expected_output_file_s3_key = Column(String(512), nullable=True)
    expected_output_files_json = Column(JSON, nullable=True)  # list of {"filename": str, "s3_key": str} for multiple expected files

    # Scoring
    points = Column(Float, default=10.0, nullable=False)
    order = Column(Integer, default=0, nullable=False)

    # Visibility
    is_hidden = Column(Boolean, default=False)  # Hidden tests only shown after grading

    # Comparison settings
    ignore_whitespace = Column(Boolean, default=True)
    ignore_case = Column(Boolean, default=False)
    use_regex = Column(Boolean, default=False)

    # Execution limits (overrides assignment defaults if set)
    time_limit_seconds = Column(Integer, nullable=True)
    memory_limit_mb = Column(Integer, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    assignment = relationship("Assignment", back_populates="test_cases")
    results = relationship("TestResult", back_populates="test_case", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<TestCase {self.name} ({'hidden' if self.is_hidden else 'public'})>"


class Rubric(Base):
    """Rubric - Links assignment to rubric items with per-item grading scale."""
    __tablename__ = "rubrics"
    id = Column(Integer, primary_key=True, index=True)
    assignment_id = Column(Integer, ForeignKey("assignments.id"), nullable=False, index=True)
    rubric_item_id = Column(Integer, ForeignKey("rubric_items.id"), nullable=False, index=True)
    
    # Per-item grading scale (min and max points for this criterion)
    min_points = Column(Float, default=0.0)
    max_points = Column(Float, default=5.0)
    
    # Weight and points
    weight = Column(Float, default=0.0)  # Percentage weight for weighted rubrics
    points = Column(Float, default=0.0)  # Points allocated to this criterion

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    assignment = relationship("Assignment", back_populates="rubric_rows")
    rubric_item = relationship("RubricItem")
    
    def __repr__(self):
        return f"<Rubric assignment={self.assignment_id} item={self.rubric_item_id}>"


class RubricItem(Base):
    __tablename__ = "rubric_items"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)

    # Relationships
    scores = relationship("RubricScore", back_populates="item")
    
    def __repr__(self):
        return f"<RubricItem {self.name}>"
