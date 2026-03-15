"""
Grading Service - Automated grading with sandbox execution
"""
import asyncio
import shutil
import tempfile
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, Optional, List
from sqlalchemy.orm import Session, joinedload

from app.models import (
    Submission, SubmissionStatus, SubmissionFile,
    TestCase, TestResult, Assignment, Language
)
from app.core.config import settings
from app.core.logging import logger


def _read_submission_file_content(file_record: SubmissionFile) -> str:
    """Read file content from storage (local path or S3). Same logic as submissions get_file_content."""
    if getattr(settings, "USE_S3_STORAGE", False) and file_record.file_path.startswith("http"):
        try:
            from urllib.parse import unquote
            from app.services.s3_storage import s3_service
            raw = (
                file_record.file_path.split(".amazonaws.com/")[-1]
                if ".amazonaws.com/" in file_record.file_path
                else file_record.file_path
            )
            s3_key = unquote(raw.split("?")[0])
            with tempfile.NamedTemporaryFile(delete=False, suffix=file_record.filename) as tmp:
                s3_service.download_submission_file(s3_key, tmp.name)
                try:
                    with open(tmp.name, "r", encoding="utf-8", errors="replace") as f:
                        return f.read()
                finally:
                    try:
                        Path(tmp.name).unlink(missing_ok=True)
                    except Exception:
                        pass
        except Exception as e:
            logger.error(f"Error reading S3 file {file_record.filename}: {e}")
            return ""
    path = Path(file_record.file_path)
    if path.exists():
        try:
            with open(path, "r", encoding="utf-8", errors="replace") as f:
                return f.read()
        except Exception as e:
            logger.error(f"Error reading local file {path}: {e}")
            return ""
    return ""


class GradingService:
    """Service for autograding student submissions"""

    def __init__(self, db: Session):
        self.db = db

    async def grade_submission(self, submission_id: int) -> Dict[str, Any]:
        """Grade a submission by running test cases and calculating scores."""
        submission = (
            self.db.query(Submission)
            .options(
                joinedload(Submission.files),
                joinedload(Submission.assignment).joinedload(Assignment.language),
            )
            .filter(Submission.id == submission_id)
            .first()
        )
        if not submission:
            raise ValueError("Submission not found")

        logger.info(f"Starting grading for submission {submission_id}")

        temp_dir = None
        try:
            submission.status = SubmissionStatus.PENDING
            self.db.commit()

            assignment = submission.assignment
            test_cases = (
                self.db.query(TestCase)
                .filter(TestCase.assignment_id == assignment.id)
                .order_by(TestCase.order)
                .all()
            )

            # Prepare temp dir with submission code (from files or inline)
            temp_dir = self._prepare_submission_temp_dir(submission, assignment)
            if not temp_dir:
                for test_case in test_cases:
                    self._create_test_result(
                        submission, test_case,
                        passed=False, score=0,
                        output="", error="No code found to execute",
                    )
                passed_count = 0
                total_count = len(test_cases)
                test_score = 0.0
                submission.tests_passed = passed_count
                submission.tests_total = total_count
                submission.test_score = None
                submission.status = SubmissionStatus.ERROR
                submission.error_message = "No code found to execute"
                self.db.commit()
                return {
                    "submission_id": submission_id,
                    "status": "error",
                    "test_score": 0,
                    "tests_passed": 0,
                    "total_tests": total_count,
                }

            test_results = []
            for test_case in test_cases:
                result = await self._run_test_case_with_path(submission, test_case, temp_dir)
                test_results.append(result)

            total_points = sum(tc.points for tc in test_cases)
            earned_points = sum(r.get("score", 0) for r in test_results)
            test_score = (earned_points / total_points) * 100 if total_points > 0 else 0
            passed_count = sum(1 for r in test_results if r.get("passed"))
            total_count = len(test_results)

            submission.tests_passed = passed_count
            submission.tests_total = total_count
            submission.test_score = test_score if total_count > 0 else None

            if assignment.rubric:
                submission.rubric_score = None
                submission.raw_score = None
                submission.final_score = None
                submission.status = SubmissionStatus.MANUAL_REVIEW
                submission.graded_at = None
                self.db.commit()
                logger.info(f"Submission {submission_id} ready for manual rubric grading")
                return {
                    "submission_id": submission_id,
                    "status": "manual_review",
                    "test_score": test_score,
                    "tests_passed": passed_count,
                    "total_tests": total_count,
                }
            else:
                raw_score = test_score
                final_score = raw_score * (1 - (submission.late_penalty_applied or 0) / 100)
                submission.rubric_score = None
                submission.raw_score = raw_score
                submission.final_score = final_score
                submission.status = SubmissionStatus.AUTOGRADED
                submission.graded_at = datetime.utcnow()
                self.db.commit()
                logger.info(f"Grading completed for submission {submission_id}: {final_score:.2f}%")
                return {
                    "submission_id": submission_id,
                    "status": "graded",
                    "test_score": test_score,
                    "raw_score": raw_score,
                    "final_score": final_score,
                    "tests_passed": passed_count,
                    "total_tests": total_count,
                }

        except Exception as e:
            logger.error(f"Error grading submission {submission_id}: {str(e)}")
            submission.status = SubmissionStatus.ERROR
            submission.error_message = str(e)
            self.db.commit()
            raise
        finally:
            if temp_dir and Path(temp_dir).exists():
                try:
                    shutil.rmtree(temp_dir)
                except Exception as e:
                    logger.warning(f"Failed to clean up temp dir: {e}")

    def _prepare_submission_temp_dir(self, submission: Submission, assignment: Assignment) -> Optional[str]:
        """Write submission code to a temp directory (inline code or all files from storage). Returns path or None."""
        temp_dir = None
        try:
            temp_dir = tempfile.mkdtemp(prefix="grading_")
            language = assignment.language
            ext = (language.file_extension if language else ".py") or ".py"

            if submission.code:
                main_name = f"main{ext}" if not ext.startswith(".") else f"main{ext}"
                (Path(temp_dir) / main_name).write_text(submission.code, encoding="utf-8")
                return temp_dir

            if not submission.files:
                shutil.rmtree(temp_dir)
                return None

            for file_record in submission.files:
                content = _read_submission_file_content(file_record)
                if content is None:
                    content = ""
                out_path = Path(temp_dir) / file_record.filename
                out_path.write_text(content, encoding="utf-8")

            return temp_dir
        except Exception as e:
            logger.error(f"Failed to prepare submission temp dir: {e}")
            if temp_dir and Path(temp_dir).exists():
                try:
                    shutil.rmtree(temp_dir)
                except Exception:
                    pass
            return None

    async def _run_test_case_with_path(
        self, submission: Submission, test_case: TestCase, code_path: str
    ) -> Dict[str, Any]:
        """Run a single test case using sandbox with code_path (same as /assignments/{id}/run)."""
        try:
            from app.services.sandbox import sandbox_executor

            assignment = submission.assignment
            language_name = (assignment.language.name if assignment.language else "python").lower()
            raw_input = test_case.input_data or ""
            stdin_input = raw_input.replace("\r\n", "\n").replace("\r", "\n") if raw_input else ""

            execution_result = await asyncio.to_thread(
                sandbox_executor.execute_code,
                code_path=code_path,
                language=language_name,
                test_input=stdin_input,
                command_args=None,
            )

            stdout = (execution_result.get("stdout") or "").strip()
            stderr = (execution_result.get("stderr") or "").strip()
            timed_out = execution_result.get("timed_out", False)
            success = execution_result.get("success", False) or execution_result.get("exit_code", -1) == 0

            if timed_out:
                return self._create_test_result(
                    submission, test_case,
                    passed=False, score=0,
                    output=stdout, error="Time Exceeds",
                    execution_time=execution_result.get("runtime", 0),
                )

            if not success:
                err_msg = stderr[:2000] if stderr else "Runtime error"
                return self._create_test_result(
                    submission, test_case,
                    passed=False, score=0,
                    output=stdout, error=err_msg,
                    execution_time=execution_result.get("runtime", 0),
                )

            passed = self._check_test_output(
                actual=stdout,
                expected=test_case.expected_output or "",
                ignore_whitespace=test_case.ignore_whitespace,
                ignore_case=test_case.ignore_case,
                use_regex=test_case.use_regex,
            )
            score = test_case.points if passed else 0
            return self._create_test_result(
                submission, test_case,
                passed=passed,
                score=score,
                output=stdout,
                error=stderr,
                execution_time=execution_result.get("runtime", 0),
                memory_used=execution_result.get("memory_used", 0),
            )

        except Exception as e:
            logger.error(f"Error running test case {test_case.id}: {str(e)}")
            return self._create_test_result(
                submission, test_case,
                passed=False, score=0,
                output="", error=str(e),
            )
    
    def _create_test_result(
        self, submission: Submission, test_case: TestCase,
        passed: bool, score: float, output: str, error: str = "",
        execution_time: float = 0, memory_used: float = 0
    ) -> Dict[str, Any]:
        """Create and save a test result"""
        timed_out = "Time Exceeds" in error if error else False
        test_result = TestResult(
            submission_id=submission.id,
            test_case_id=test_case.id,
            passed=passed,
            points_awarded=score,
            actual_output=output,
            error_message=error if error else None,
            timed_out=timed_out,
        )
        self.db.add(test_result)
        self.db.commit()
        
        return {
            "test_case_id": test_case.id,
            "name": test_case.name,
            "passed": passed,
            "score": score,
            "output": output,
            "error": error,
            "execution_time": execution_time,
            "is_hidden": test_case.is_hidden
        }
    
    def _check_test_output(
        self, actual: str, expected: str,
        ignore_whitespace: bool = False,
        ignore_case: bool = False,
        use_regex: bool = False
    ) -> bool:
        """Check if test output matches expected output"""
        if not expected:
            return True
        
        if use_regex:
            import re
            flags = re.IGNORECASE if ignore_case else 0
            return bool(re.search(expected, actual, flags))
        
        a = actual.strip()
        e = expected.strip()
        
        if ignore_whitespace:
            a = ' '.join(a.split())
            e = ' '.join(e.split())
        
        if ignore_case:
            a = a.lower()
            e = e.lower()
        
        return a == e
    
    def _calculate_rubric_score(self, submission: Submission, test_score: float) -> float:
        """Calculate rubric score based on test results and rubric items"""
        rubric = submission.assignment.rubric
        if not rubric:
            return test_score
        
        total_score = 0.0
        
        for category in rubric.categories:
            for item in category.items:
                # Auto-score correctness items based on test results
                if any(kw in item.name.lower() for kw in ['correct', 'output', 'test', 'function']):
                    item_score = (test_score / 100) * item.max_points
                else:
                    # For style/documentation, give 80% by default
                    item_score = item.max_points * 0.8
                
                total_score += item_score
        
        # Normalize to 100
        if rubric.total_points > 0:
            return (total_score / rubric.total_points) * 100
        
        return test_score
