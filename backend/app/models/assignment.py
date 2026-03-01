"""
Assignment Model - Comprehensive assignment management with test cases and grading
"""
from datetime import datetime
from enum import Enum as PyEnum
from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey, Text, Float, Enum, JSON
from sqlalchemy.orm import relationship
from app.core.database import Base


class AssignmentStatus(str, PyEnum):
    DRAFT = "draft"
    PUBLISHED = "published"
    CLOSED = "closed"


class DifficultyLevel(str, PyEnum):
    EASY = "easy"
    MEDIUM = "medium"
    HARD = "hard"


class Assignment(Base):
    """
    Assignment - Programming assignment with test cases, grading rubric,
    plagiarism checking, and AI detection.
    """
    __tablename__ = "assignments"
    
    id = Column(Integer, primary_key=True, index=True)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=False)
    
    # Basic info
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    instructions = Column(Text, nullable=True)  # Markdown supported
    
    # Programming settings
    language_id = Column(Integer, ForeignKey("languages.id"), nullable=False)
    starter_code = Column(Text, nullable=True)
    solution_code = Column(Text, nullable=True)  # Faculty reference solution
    
    # Scoring
    max_score = Column(Float, default=100.0)
    passing_score = Column(Float, default=60.0)
    difficulty = Column(Enum(DifficultyLevel), default=DifficultyLevel.MEDIUM)
    
    # Due date & late policy
    due_date = Column(DateTime, nullable=False)
    allow_late = Column(Boolean, default=True)
    late_penalty_per_day = Column(Float, default=10.0)  # Percentage
    max_late_days = Column(Integer, default=7)
    
    # Submission settings
    max_attempts = Column(Integer, default=0)  # 0 = unlimited
    max_file_size_mb = Column(Integer, default=10)
    allowed_file_extensions = Column(JSON, nullable=True)  # [".py", ".java"]
    required_files = Column(JSON, nullable=True)  # ["main.py", "helper.py"]
    
    # Group settings
    allow_groups = Column(Boolean, default=False)
    max_group_size = Column(Integer, default=4)
    
    # Plagiarism & AI Detection
    enable_plagiarism_check = Column(Boolean, default=True)
    plagiarism_threshold = Column(Float, default=30.0)  # Percentage to flag
    enable_ai_detection = Column(Boolean, default=True)
    ai_detection_threshold = Column(Float, default=50.0)  # Percentage to flag
    
    # Auto-grading weight distribution
    test_weight = Column(Float, default=70.0)  # Percentage from test cases
    rubric_weight = Column(Float, default=30.0)  # Percentage from manual rubric
    
    # Status and publishing
    is_published = Column(Boolean, default=False)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    course = relationship("Course", back_populates="assignments")
    language = relationship("Language", back_populates="assignments")
    test_cases = relationship("TestCase", back_populates="assignment", cascade="all, delete-orphan",
                             order_by="TestCase.order")
    rubric = relationship("Rubric", back_populates="assignment", uselist=False, cascade="all, delete-orphan")
    submissions = relationship("Submission", back_populates="assignment", cascade="all, delete-orphan")
    
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
    
    # Input/Output
    input_data = Column(Text, nullable=True)
    expected_output = Column(Text, nullable=True)
    
    # For unit tests (code-based)
    test_code = Column(Text, nullable=True)
    setup_code = Column(Text, nullable=True)
    teardown_code = Column(Text, nullable=True)
    
    # Scoring
    points = Column(Float, default=10.0)
    
    # Visibility
    is_hidden = Column(Boolean, default=False)  # Hidden tests only shown after grading
    is_sample = Column(Boolean, default=False)  # Sample test case for students
    
    # Comparison settings
    ignore_whitespace = Column(Boolean, default=True)
    ignore_case = Column(Boolean, default=False)
    use_regex = Column(Boolean, default=False)
    
    # Execution limits (overrides assignment defaults if set)
    time_limit_seconds = Column(Integer, nullable=True)
    memory_limit_mb = Column(Integer, nullable=True)
    
    # Ordering
    order = Column(Integer, default=0)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    assignment = relationship("Assignment", back_populates="test_cases")
    results = relationship("TestResult", back_populates="test_case", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<TestCase {self.name} ({'hidden' if self.is_hidden else 'public'})>"


class Rubric(Base):
    """
    Rubric - Manual grading rubric for an assignment.
    Allows faculty to define grading criteria beyond auto-graded tests.
    """
    __tablename__ = "rubrics"
    
    id = Column(Integer, primary_key=True, index=True)
    assignment_id = Column(Integer, ForeignKey("assignments.id"), nullable=False, unique=True)
    
    # Total points from rubric (usually assignment.max_score * assignment.rubric_weight / 100)
    total_points = Column(Float, default=30.0)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    assignment = relationship("Assignment", back_populates="rubric")
    categories = relationship("RubricCategory", back_populates="rubric", cascade="all, delete-orphan",
                             order_by="RubricCategory.order")
    
    def __repr__(self):
        return f"<Rubric for assignment {self.assignment_id}>"


class RubricCategory(Base):
    """
    RubricCategory - Category in a rubric (e.g., Code Style, Documentation).
    """
    __tablename__ = "rubric_categories"
    
    id = Column(Integer, primary_key=True, index=True)
    rubric_id = Column(Integer, ForeignKey("rubrics.id"), nullable=False)
    
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    weight = Column(Float, default=100.0)  # Relative weight within rubric
    order = Column(Integer, default=0)
    
    # Relationships
    rubric = relationship("Rubric", back_populates="categories")
    items = relationship("RubricItem", back_populates="category", cascade="all, delete-orphan",
                        order_by="RubricItem.order")
    
    def __repr__(self):
        return f"<RubricCategory {self.name}>"


class RubricItem(Base):
    """
    RubricItem - Individual grading criterion within a category.
    """
    __tablename__ = "rubric_items"
    
    id = Column(Integer, primary_key=True, index=True)
    category_id = Column(Integer, ForeignKey("rubric_categories.id"), nullable=False)
    
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    max_points = Column(Float, default=5.0)
    order = Column(Integer, default=0)
    
    # Relationships
    category = relationship("RubricCategory", back_populates="items")
    scores = relationship("RubricScore", back_populates="item", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<RubricItem {self.name}>"
