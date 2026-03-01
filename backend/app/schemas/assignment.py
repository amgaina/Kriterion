from typing import List, Optional, Any
from datetime import datetime
from pydantic import BaseModel

# --- Test Case Schemas ---

class TestCaseBase(BaseModel):
    name: str
    description: Optional[str] = None
    input_data: Optional[str] = None
    expected_output: Optional[str] = None
    test_code: Optional[str] = None
    setup_code: Optional[str] = None
    teardown_code: Optional[str] = None
    points: float = 10.0
    is_hidden: bool = False
    is_sample: bool = False
    ignore_whitespace: bool = True
    ignore_case: bool = False
    use_regex: bool = False
    time_limit_seconds: Optional[int] = None
    memory_limit_mb: Optional[int] = None
    order: int = 0

class TestCaseCreate(TestCaseBase):
    pass

class TestCase(TestCaseBase):
    id: int
    assignment_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

# --- Rubric Schemas ---

class RubricItemBase(BaseModel):
    name: str
    description: Optional[str] = None
    max_points: float
    order: int

class RubricItemCreate(RubricItemBase):
    pass

class RubricItem(RubricItemBase):
    id: int
    category_id: int
    
    class Config:
        from_attributes = True

class RubricCategoryBase(BaseModel):
    name: str
    description: Optional[str] = None
    weight: float  # Percentage (0-100) - category's share of total rubric points
    order: int

class RubricCategoryCreate(RubricCategoryBase):
    items: List[RubricItemCreate]

class RubricCategory(RubricCategoryBase):
    id: int
    rubric_id: int
    items: List[RubricItem] = []
    
    class Config:
        from_attributes = True

class RubricBase(BaseModel):
    total_points: Optional[float] = None  # Computed as max_score * rubric_weight/100 if omitted

class RubricCreate(RubricBase):
    categories: List[RubricCategoryCreate]

class RubricUpdate(BaseModel):
    total_points: Optional[float] = None
    categories: Optional[List[RubricCategoryCreate]] = None

class Rubric(RubricBase):
    id: int
    assignment_id: int
    categories: List[RubricCategory] = []
    
    class Config:
        from_attributes = True

# --- Assignment Schemas ---

class AssignmentBase(BaseModel):
    title: str
    description: str
    instructions: Optional[str] = None
    due_date: datetime
    
    # Scoring
    max_score: float = 100.0
    passing_score: float = 60.0
    difficulty: str = "medium"
    test_weight: float = 70.0
    rubric_weight: float = 30.0
    
    # Submission settings
    allow_late: bool = True
    late_penalty_per_day: float = 10.0
    max_late_days: int = 7
    max_attempts: int = 0
    max_file_size_mb: int = 10
    allowed_file_extensions: Optional[List[str]] = None
    required_files: Optional[List[str]] = None
    
    # Group settings
    allow_groups: bool = False
    max_group_size: int = 4
    
    # Integrity
    enable_plagiarism_check: bool = True
    plagiarism_threshold: float = 30.0
    enable_ai_detection: bool = True
    ai_detection_threshold: float = 50.0
    
    # Code (starter_code also stores S3 attachment refs as JSON when files are uploaded)
    starter_code: Optional[str] = None
    solution_code: Optional[str] = None
    
    is_published: bool = False

class AssignmentCreate(AssignmentBase):
    course_id: int
    language_id: int
    rubric: Optional[RubricCreate] = None
    test_cases: Optional[List[TestCaseCreate]] = None
    test_suites: Optional[List[Any]] = None

class AssignmentUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    instructions: Optional[str] = None
    due_date: Optional[datetime] = None
    language_id: Optional[int] = None
    
    max_score: Optional[float] = None
    passing_score: Optional[float] = None
    difficulty: Optional[str] = None
    test_weight: Optional[float] = None
    rubric_weight: Optional[float] = None
    
    allow_late: Optional[bool] = None
    late_penalty_per_day: Optional[float] = None
    max_late_days: Optional[int] = None
    max_attempts: Optional[int] = None
    max_file_size_mb: Optional[int] = None
    allowed_file_extensions: Optional[List[str]] = None
    required_files: Optional[List[str]] = None
    
    allow_groups: Optional[bool] = None
    max_group_size: Optional[int] = None
    
    enable_plagiarism_check: Optional[bool] = None
    plagiarism_threshold: Optional[float] = None
    enable_ai_detection: Optional[bool] = None
    ai_detection_threshold: Optional[float] = None
    
    starter_code: Optional[str] = None
    solution_code: Optional[str] = None
    
    is_published: Optional[bool] = None
    rubric: Optional[RubricUpdate] = None

class CourseForAssignment(BaseModel):
    id: int
    code: str
    name: str
    section: Optional[str] = None

    class Config:
        from_attributes = True

class Assignment(AssignmentBase):
    id: int
    course_id: int
    language_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    course: Optional[CourseForAssignment] = None
    
    class Config:
        from_attributes = True

class AssignmentDetail(Assignment):
    rubric: Optional[Rubric] = None
    test_cases: List[TestCase] = []
    test_suites: List[Any] = []