from typing import Optional, List, Any
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
    ai_report: Optional[Any] = None
    plagiarism_report: Optional[Any] = None
    error_message: Optional[str] = None
    error_details: Optional[Any] = None
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class SubmissionFileOut(BaseModel):
    id: int
    filename: str
    original_filename: Optional[str] = None
    file_path: str
    file_hash: Optional[str] = None
    is_main_file: Optional[bool] = None
    language_detected: Optional[str] = None
    line_count: Optional[int] = None
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
    error_type: Optional[str] = None
    stack_trace: Optional[str] = None
    timed_out: bool = False
    memory_exceeded: bool = False
    executed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class PlagiarismMatchOut(BaseModel):
    id: int
    submission_id: int
    matched_submission_id: Optional[int] = None
    similarity_percentage: float
    matched_source: Optional[str] = None
    matched_source_url: Optional[str] = None
    source_code_snippet: Optional[str] = None
    matched_code_snippet: Optional[str] = None
    source_line_start: Optional[int] = None
    source_line_end: Optional[int] = None
    matched_line_start: Optional[int] = None
    matched_line_end: Optional[int] = None
    is_reviewed: bool = False
    is_confirmed: Optional[bool] = None
    reviewer_notes: Optional[str] = None
    detected_at: Optional[datetime] = None
    reviewed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class RubricItemInfo(BaseModel):
    id: int
    name: str

    class Config:
        from_attributes = True


class RubricScoreOut(BaseModel):
    id: int
    rubric_item_id: int
    score: float
    max_score: float
    comment: Optional[str] = None
    graded_by: Optional[int] = None
    graded_at: Optional[datetime] = None
    item: Optional[RubricItemInfo] = None

    class Config:
        from_attributes = True


class SubmissionDetail(Submission):
    files: List[SubmissionFileOut] = []
    test_results: List[TestResultOut] = []
    plagiarism_matches: List[PlagiarismMatchOut] = []
    rubric_scores: List[RubricScoreOut] = []

    class Config:
        from_attributes = True


class StudentInfo(BaseModel):
    id: int
    full_name: str
    email: str
    student_id: Optional[str] = None

    class Config:
        from_attributes = True


class GroupMemberInSubmission(BaseModel):
    id: int
    user_id: int
    full_name: str
    email: str
    student_id: Optional[str] = None
    is_leader: bool = False

    class Config:
        from_attributes = True


class GroupInSubmission(BaseModel):
    id: int
    name: str
    members: List[GroupMemberInSubmission] = []

    class Config:
        from_attributes = True


class SubmissionWithStudent(Submission):
    student: Optional[StudentInfo] = None
    group: Optional[GroupInSubmission] = None

    class Config:
        from_attributes = True


class SubmissionDetailWithStudent(SubmissionDetail):
    student: Optional[StudentInfo] = None
    group: Optional[GroupInSubmission] = None

    class Config:
        from_attributes = True
