from typing import List, Optional, Any
from datetime import datetime
from pydantic import BaseModel, model_validator

from app.schemas.language import Language as LanguageSchema

# --- Test Case Schemas ---

class TestCaseBase(BaseModel):
    name: str
    description: Optional[str] = None
    input_data: Optional[str] = None
    expected_output: Optional[str] = None
    input_type: Optional[str] = "stdin"  # 'stdin' | 'file'
    input_filename: Optional[str] = None  # e.g. input.txt (when input_type=file)
    expected_output_type: Optional[str] = "text"  # 'text' | 'file'
    expected_output_files_json: Optional[List[dict]] = None  # list of {"filename": str, "s3_key": str}
    points: float = 10.0
    is_hidden: bool = False
    ignore_whitespace: bool = True
    ignore_case: bool = False
    use_regex: bool = False
    time_limit_seconds: Optional[int] = None
    memory_limit_mb: Optional[int] = None
    order: int = 0


class TestCaseCreate(TestCaseBase):
    """Create test case. Optional base64 file content for input/expected file. For multiple input/expected files use input_files/expected_output_files."""
    input_file_base64: Optional[str] = None  # base64-encoded content when input_type=file (single file)
    input_files: Optional[List[dict]] = None  # list of {"filename": str, "content_base64": str} or {"filename": str, "s3_key": str}
    expected_output_file_base64: Optional[str] = None  # base64 when expected_output_type=file (single file)
    expected_output_files: Optional[List[dict]] = None  # list of {"filename": str, "content_base64": str} or {"filename": str, "s3_key": str}


class TestCase(TestCaseBase):
    id: int
    assignment_id: int
    input_file_s3_key: Optional[str] = None
    input_files_json: Optional[List[dict]] = None  # list of {"filename": str, "s3_key": str}
    expected_output_file_s3_key: Optional[str] = None
    expected_output_files_json: Optional[List[dict]] = None  # list of {"filename": str, "s3_key": str}
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

# --- Rubric Schemas ---

class RubricItemBase(BaseModel):
    name: str
    description: Optional[str] = None
    # Percentage weight (0–100) of this criterion in the final score
    weight: float = 0.0
    # Points allocated to this criterion
    points: float = 0.0


class RubricItemCreate(RubricItemBase):
    pass


class RubricItem(RubricItemBase):
    id: int

    class Config:
        from_attributes = True


class RubricCreate(BaseModel):
    items: List[RubricItemCreate]


class Rubric(BaseModel):
    items: List[RubricItem]
    # For compatibility; frontends should rely on Assignment.max_score instead.
    total_points: float = 0

    class Config:
        from_attributes = True


class RubricUpdate(BaseModel):
    """Partial update for rubric on an assignment."""
    items: Optional[List[RubricItemCreate]] = None

# --- Assignment Schemas ---

class AssignmentBase(BaseModel):
    title: str
    description: str
    instructions: Optional[str] = None
    start_date: Optional[datetime] = None
    due_date: datetime
    
    # Scoring
    max_score: float = 100.0
    passing_score: float = 60.0
    
    # Submission settings
    allow_late: bool = True
    late_penalty_per_day: float = 10.0
    max_late_days: int = 7
    max_attempts: int = 0
    max_file_size_mb: int = 10
    allowed_file_extensions: Optional[List[str]] = None
    
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

    @model_validator(mode='after')
    def validate_date_range(self):
        if self.start_date and self.due_date and self.start_date > self.due_date:
            raise ValueError('Start date must be on or before due date')
        return self

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
    start_date: Optional[datetime] = None
    due_date: Optional[datetime] = None
    language_id: Optional[int] = None
    
    max_score: Optional[float] = None
    passing_score: Optional[float] = None
    
    allow_late: Optional[bool] = None
    late_penalty_per_day: Optional[float] = None
    max_late_days: Optional[int] = None
    max_attempts: Optional[int] = None
    max_file_size_mb: Optional[int] = None
    allowed_file_extensions: Optional[List[str]] = None
    
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

    @model_validator(mode='after')
    def validate_date_range(self):
        if self.start_date and self.due_date and self.start_date > self.due_date:
            raise ValueError('Start date must be on or before due date')
        return self

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
    language: Optional[LanguageSchema] = None
    
    class Config:
        from_attributes = True

class AssignmentDetail(Assignment):
    rubric: Optional[Rubric] = None
    test_cases: List[TestCase] = []
    test_suites: List[Any] = []