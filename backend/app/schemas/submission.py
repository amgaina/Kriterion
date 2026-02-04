from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel
from app.models.submission import SubmissionStatus


class SubmissionCreate(BaseModel):
    assignment_id: int
    student_id: int
    group_id: Optional[int] = None
    code: Optional[str] = None


class SubmissionUpdate(BaseModel):
    status: Optional[SubmissionStatus] = None
    attempt_number: Optional[int] = None
    test_score: Optional[float] = None
    rubric_score: Optional[float] = None
    raw_score: Optional[float] = None
    final_score: Optional[float] = None
    override_score: Optional[float] = None
    graded_by: Optional[int] = None
    graded_at: Optional[datetime] = None
    feedback: Optional[str] = None
    plagiarism_checked: Optional[bool] = None
    plagiarism_score: Optional[float] = None
    plagiarism_flagged: Optional[bool] = None
    ai_checked: Optional[bool] = None
    ai_score: Optional[float] = None
    ai_flagged: Optional[bool] = None
    error_message: Optional[str] = None


class Submission(BaseModel):
    id: int
    assignment_id: int
    student_id: int
    group_id: Optional[int] = None
    attempt_number: int
    status: SubmissionStatus
    code: Optional[str] = None
    submitted_at: datetime
    is_late: bool
    late_penalty_applied: float
    tests_passed: int
    tests_total: int
    test_score: Optional[float] = None
    rubric_score: Optional[float] = None
    raw_score: Optional[float] = None
    final_score: Optional[float] = None
    max_score: float
    override_score: Optional[float] = None
    graded_by: Optional[int] = None
    graded_at: Optional[datetime] = None
    feedback: Optional[str] = None
    plagiarism_checked: bool
    plagiarism_score: Optional[float] = None
    plagiarism_flagged: bool
    ai_checked: bool
    ai_score: Optional[float] = None
    ai_flagged: bool
    error_message: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class SubmissionFileOut(BaseModel):
    id: int
    filename: str
    original_filename: Optional[str] = None
    file_path: str
    is_main_file: Optional[bool] = None
    uploaded_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class TestResultOut(BaseModel):
    id: int
    test_case_id: int
    passed: bool
    points_awarded: float
    actual_output: Optional[str] = None
    expected_output: Optional[str] = None
    error_message: Optional[str] = None
    executed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class SubmissionDetail(Submission):
    files: List[SubmissionFileOut] = []
    test_results: List[TestResultOut] = []

    class Config:
        from_attributes = True
