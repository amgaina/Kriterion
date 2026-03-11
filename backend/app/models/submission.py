"""
Submission Model - Student submissions with file uploads, grading, plagiarism, and AI detection
"""
from datetime import datetime
from enum import Enum as PyEnum
from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey, Text, Float, Enum, JSON
from sqlalchemy.orm import relationship
from app.core.database import Base


class SubmissionStatus(str, PyEnum):
    PENDING = "pending"          # Just submitted, waiting to be processed
    AUTOGRADED = "autograded"           # Auto-grading complete
    MANUAL_REVIEW = "manual_review"  # Needs manual review
    COMPLETED = "completed"      # Fully graded
    ERROR = "error"             # Error during processing
    FLAGGED = "flagged"         # Flagged for plagiarism/AI


class Submission(Base):
    """
    Submission - Student submission for an assignment.
    Tracks files, grading, test results, plagiarism, and AI detection.
    """
    __tablename__ = "submissions"
    
    id = Column(Integer, primary_key=True, index=True)
    assignment_id = Column(Integer, ForeignKey("assignments.id"), nullable=False)
    student_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    group_id = Column(Integer, ForeignKey("groups.id"), nullable=True)
    
    # Submission tracking
    attempt_number = Column(Integer, default=1)
    status = Column(Enum(SubmissionStatus), default=SubmissionStatus.PENDING)
    
    # Code (for single-file submissions or concatenated view)
    code = Column(Text, nullable=True)
    
    # Late submission
    submitted_at = Column(DateTime, default=datetime.utcnow)
    is_late = Column(Boolean, default=False)
    late_penalty_applied = Column(Float, default=0.0)  # Percentage deducted
    
    # Auto-grading results
    tests_passed = Column(Integer, default=0)
    tests_total = Column(Integer, default=0)
    test_score = Column(Float, nullable=True)  # Score from tests
    
    # Manual grading
    rubric_score = Column(Float, nullable=True)  # Score from rubric
    
    # Final score calculation
    raw_score = Column(Float, nullable=True)  # Before late penalty
    final_score = Column(Float, nullable=True)  # After late penalty
    max_score = Column(Float, default=100.0)
    
    # Manual override
    override_score = Column(Float, nullable=True)
    
    # Grading info
    graded_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    graded_at = Column(DateTime, nullable=True)
    
    # Feedback
    feedback = Column(Text, nullable=True)
    
    # Plagiarism Detection
    plagiarism_checked = Column(Boolean, default=False)
    plagiarism_score = Column(Float, nullable=True)  # 0-100 percentage
    plagiarism_flagged = Column(Boolean, default=False)
    plagiarism_report = Column(JSON, nullable=True)  # Detailed matches
    
    # AI Detection
    ai_checked = Column(Boolean, default=False)
    ai_score = Column(Float, nullable=True)  # 0-100 percentage probability
    ai_flagged = Column(Boolean, default=False)
    ai_report = Column(JSON, nullable=True)  # Detailed analysis
    
    # Error handling
    error_message = Column(Text, nullable=True)
    error_details = Column(JSON, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    assignment = relationship("Assignment", back_populates="submissions")
    student = relationship("User", back_populates="submissions", foreign_keys=[student_id])
    group = relationship("Group", back_populates="submissions")
    grader = relationship("User", back_populates="graded_submissions", foreign_keys=[graded_by])
    files = relationship("SubmissionFile", back_populates="submission", cascade="all, delete-orphan")
    test_results = relationship("TestResult", back_populates="submission", cascade="all, delete-orphan")
    rubric_scores = relationship("RubricScore", back_populates="submission", cascade="all, delete-orphan")
    plagiarism_matches = relationship("PlagiarismMatch", back_populates="submission", 
                                      foreign_keys="PlagiarismMatch.submission_id", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<Submission {self.id} by student {self.student_id} for assignment {self.assignment_id}>"


class SubmissionFile(Base):
    """
    SubmissionFile - Individual file in a submission.
    Supports multiple file submissions per assignment.
    """
    __tablename__ = "submission_files"
    
    id = Column(Integer, primary_key=True, index=True)
    submission_id = Column(Integer, ForeignKey("submissions.id"), nullable=False)
    
    # File info
    filename = Column(String(255), nullable=False)
    original_filename = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)  # Storage path
    
    # File hash for duplicate detection
    file_hash = Column(String(64), nullable=True)
    
    # Size in bytes (required by DB)
    file_size_bytes = Column(Integer, nullable=False)
    
    # Metadata
    is_main_file = Column(Boolean, default=False)  # Entry point file
    language_detected = Column(String(50), nullable=True)
    line_count = Column(Integer, nullable=True)
    
    # Timestamps
    uploaded_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    submission = relationship("Submission", back_populates="files")
    
    def __repr__(self):
        return f"<SubmissionFile {self.filename}>"


class TestResult(Base):
    """
    TestResult - Result of running a test case on a submission.
    """
    __tablename__ = "test_results"
    
    id = Column(Integer, primary_key=True, index=True)
    submission_id = Column(Integer, ForeignKey("submissions.id"), nullable=False)
    test_case_id = Column(Integer, ForeignKey("test_cases.id"), nullable=False)
    
    # Result
    passed = Column(Boolean, default=False)
    points_awarded = Column(Float, default=0.0)
    
    # Output comparison
    actual_output = Column(Text, nullable=True)
    expected_output = Column(Text, nullable=True)
    
    # Error info
    error_message = Column(Text, nullable=True)
    error_type = Column(String(100), nullable=True)  # CompileError, RuntimeError, etc.
    stack_trace = Column(Text, nullable=True)
    
    # Status
    timed_out = Column(Boolean, default=False)
    memory_exceeded = Column(Boolean, default=False)
    
    # Timestamps
    executed_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    submission = relationship("Submission", back_populates="test_results")
    test_case = relationship("TestCase", back_populates="results")
    
    def __repr__(self):
        return f"<TestResult submission={self.submission_id} test={self.test_case_id} passed={self.passed}>"


class RubricScore(Base):
    """
    RubricScore - Score for a rubric item on a submission.
    """
    __tablename__ = "rubric_scores"
    
    id = Column(Integer, primary_key=True, index=True)
    submission_id = Column(Integer, ForeignKey("submissions.id"), nullable=False)
    rubric_item_id = Column(Integer, ForeignKey("rubric_items.id"), nullable=False)
    
    score = Column(Float, default=0.0)
    max_score = Column(Float, nullable=False)
    comment = Column(Text, nullable=True)
    
    # Grader info
    graded_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    graded_at = Column(DateTime, nullable=True)
    
    # Relationships
    submission = relationship("Submission", back_populates="rubric_scores")
    item = relationship("RubricItem", back_populates="scores")
    
    def __repr__(self):
        return f"<RubricScore {self.score}/{self.max_score}>"


class PlagiarismMatch(Base):
    """
    PlagiarismMatch - Detected plagiarism between submissions.
    """
    __tablename__ = "plagiarism_matches"
    
    id = Column(Integer, primary_key=True, index=True)
    submission_id = Column(Integer, ForeignKey("submissions.id"), nullable=False)
    matched_submission_id = Column(Integer, ForeignKey("submissions.id"), nullable=True)
    
    # Match details
    similarity_percentage = Column(Float, nullable=False)
    matched_source = Column(String(255), nullable=True)  # If external source
    matched_source_url = Column(String(500), nullable=True)
    
    # Code snippets
    source_code_snippet = Column(Text, nullable=True)
    matched_code_snippet = Column(Text, nullable=True)
    source_line_start = Column(Integer, nullable=True)
    source_line_end = Column(Integer, nullable=True)
    matched_line_start = Column(Integer, nullable=True)
    matched_line_end = Column(Integer, nullable=True)
    
    # Status
    is_reviewed = Column(Boolean, default=False)
    is_confirmed = Column(Boolean, nullable=True)  # Faculty confirmation
    reviewer_notes = Column(Text, nullable=True)
    
    # Timestamps
    detected_at = Column(DateTime, default=datetime.utcnow)
    reviewed_at = Column(DateTime, nullable=True)
    
    # Relationships
    submission = relationship("Submission", back_populates="plagiarism_matches", 
                             foreign_keys=[submission_id])
    matched_submission = relationship("Submission", foreign_keys=[matched_submission_id])
    
    def __repr__(self):
        return f"<PlagiarismMatch {self.similarity_percentage}% between {self.submission_id} and {self.matched_submission_id}>"
