"""
Assignment Schemas
-------------------
Clean, concise Pydantic models that mirror the SQLAlchemy
`Assignment`, `TestCase`, and related rubric structures.

These schemas are used by FastAPI endpoints for validation
and for serializing responses. The shapes below closely match
the database models defined in `app.models.assignment`.
"""

from typing import Optional, List, Dict, Any
from datetime import datetime
from pydantic import BaseModel

# Enum types come directly from the SQLAlchemy model for consistency
from app.models.assignment import AssignmentStatus, DifficultyLevel
from app.schemas.rubric import Rubric 



# -----------------------------------------------------------------------------
# Rubric creation payloads (nested objects used when creating/updating rubrics)
# -----------------------------------------------------------------------------
class RubricItemCreate(BaseModel):
    """Minimal payload for a single rubric item inside a category."""
    name: str
    max_points: float
    description: Optional[str] = None
    order: int = 0


class RubricCategoryCreate(BaseModel):
    """A rubric category with one or more items."""
    name: str
    weight: float = 1.0  # Relative weight within the rubric
    order: int = 0
    items: List[RubricItemCreate] = []


class RubricCreate(BaseModel):
    """Top-level rubric structure attached to an assignment."""
    total_points: float = 30.0
    categories: List[RubricCategoryCreate] = []


class RubricUpdate(BaseModel):
    """Partial updates allowed on rubric."""
    total_points: Optional[float] = None


# -----------------------------------------------------------------------------
# Assignment payloads
# -----------------------------------------------------------------------------
class AssignmentBase(BaseModel):
    """Fields common to create, update and read operations for assignments."""
    # Basic info
    title: str
    description: str
    instructions: Optional[str] = None  # Markdown supported

    # Programming settings
    language_id: int
    starter_code: Optional[str] = None
    solution_code: Optional[str] = None  # Faculty reference solution
    starter_file_1_s3: Optional[str] = None
    starter_file_2_s3: Optional[str] = None
    starter_file_3_s3: Optional[str] = None

    # Scoring
    max_score: float = 100.0
    passing_score: float = 60.0
    difficulty: DifficultyLevel = DifficultyLevel.MEDIUM

    # Due date & late policy
    due_date: datetime
    allow_late: bool = True
    late_penalty_per_day: float = 10.0  # Percentage
    max_late_days: int = 7

    # Submission settings
    max_attempts: int = 0  # 0 = unlimited
    max_file_size_mb: int = 10
    allowed_file_extensions: Optional[List[str]] = None  # e.g., [".py", ".java"]
    required_files: Optional[List[str]] = None  # e.g., ["main.py", "helper.py"]

    # Group settings
    allow_groups: bool = False
    max_group_size: int = 4

    # Plagiarism & AI Detection
    enable_plagiarism_check: bool = True
    plagiarism_threshold: float = 30.0
    enable_ai_detection: bool = True
    ai_detection_threshold: float = 50.0

    # Auto-grading weight distribution
    test_weight: float = 70.0   # Percentage from test cases
    rubric_weight: float = 30.0  # Percentage from manual rubric


class AssignmentCreate(AssignmentBase):
    """Payload to create a new assignment."""
    course_id: int
    status: AssignmentStatus = AssignmentStatus.DRAFT
    is_published: bool = False
    published_at: Optional[datetime] = None

    # Optional nested payloads for endpoint compatibility
    rubric: Optional[RubricCreate] = None
    test_suites: Optional[List[Dict[str, Any]]] = None


class AssignmentUpdate(BaseModel):
    """Partial update payload for assignments (all fields optional)."""
    # Basic info
    title: Optional[str] = None
    description: Optional[str] = None
    instructions: Optional[str] = None

    # Programming settings
    language_id: Optional[int] = None
    starter_code: Optional[str] = None
    solution_code: Optional[str] = None
    starter_file_1_s3: Optional[str] = None
    starter_file_2_s3: Optional[str] = None
    starter_file_3_s3: Optional[str] = None

    # Scoring
    max_score: Optional[float] = None
    passing_score: Optional[float] = None
    difficulty: Optional[DifficultyLevel] = None

    # Due date & late policy
    due_date: Optional[datetime] = None
    allow_late: Optional[bool] = None
    late_penalty_per_day: Optional[float] = None
    max_late_days: Optional[int] = None

    # Submission settings
    max_attempts: Optional[int] = None
    max_file_size_mb: Optional[int] = None
    allowed_file_extensions: Optional[List[str]] = None
    required_files: Optional[List[str]] = None

    # Group settings
    allow_groups: Optional[bool] = None
    max_group_size: Optional[int] = None

    # Plagiarism & AI Detection
    enable_plagiarism_check: Optional[bool] = None
    plagiarism_threshold: Optional[float] = None
    enable_ai_detection: Optional[bool] = None
    ai_detection_threshold: Optional[float] = None

    # Auto-grading weight distribution
    test_weight: Optional[float] = None
    rubric_weight: Optional[float] = None

    # Publication status
    status: Optional[AssignmentStatus] = None
    is_published: Optional[bool] = None
    published_at: Optional[datetime] = None


class Assignment(AssignmentBase):
    """Read model for assignments, including identifiers and timestamps."""
    id: int
    course_id: int
    status: AssignmentStatus
    is_published: bool
    published_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# -----------------------------------------------------------------------------
# Test case payloads
# -----------------------------------------------------------------------------
class TestCaseBase(BaseModel):
    """Fields common to create, update and read operations for test cases."""
    # Test info
    name: str
    description: Optional[str] = None

    # Input/Output
    input_data: Optional[str] = None
    expected_output: Optional[str] = None

    # For unit tests (code-based)
    test_code: Optional[str] = None
    setup_code: Optional[str] = None
    teardown_code: Optional[str] = None

    # Scoring
    points: float = 10.0

    # Visibility
    is_hidden: bool = False
    is_sample: bool = False

    # Comparison settings
    ignore_whitespace: bool = True
    ignore_case: bool = False
    use_regex: bool = False

    # Execution limits (per-test overrides)
    time_limit_seconds: Optional[int] = None
    memory_limit_mb: Optional[int] = None

    # Ordering
    order: int = 0


class TestCaseCreate(TestCaseBase):
    """Payload to create a new test case for an assignment."""
    assignment_id: int


class TestCase(TestCaseBase):
    """Read model for test cases with identifiers and timestamps."""
    id: int
    assignment_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class AssignmentDetail(Assignment):
    """A richer assignment shape returned by detail endpoints."""
    course: Optional[Dict[str, Any]] = None
    test_cases: List[TestCase] = []
    rubric: Optional[Rubric] = None

    class Config:
        from_attributes = True