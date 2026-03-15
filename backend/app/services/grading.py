"""
Grading Service - Automated grading with sandbox execution
"""
import asyncio
import subprocess
import json
import os
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, Optional, List
from sqlalchemy.orm import Session

from app.models import (
    Submission, SubmissionStatus, SubmissionFile,
    TestCase, TestResult, Assignment, Language
)
from app.core.config import settings
from app.core.logging import logger


class GradingService:
    """Service for autograding student submissions"""
    
    def __init__(self, db: Session):
        self.db = db
    
    async def grade_submission(self, submission_id: int) -> Dict[str, Any]:
        """Grade a submission by running test cases and calculating scores"""
        submission = self.db.query(Submission).filter(Submission.id == submission_id).first()
        if not submission:
            raise ValueError("Submission not found")
        
        logger.info(f"Starting grading for submission {submission_id}")
        
        try:
            submission.status = SubmissionStatus.PENDING
            self.db.commit()
            
            assignment = submission.assignment
            
            # Query test cases directly instead of using lazy loading
            from app.models.assignment import TestCase
            test_cases = self.db.query(TestCase).filter(
                TestCase.assignment_id == assignment.id
            ).order_by(TestCase.order).all()
            
            test_results = []
            
            # Run all test cases directly (no more TestSuite)
            for test_case in test_cases:
                result = await self._run_test_case(submission, test_case)
                test_results.append(result)
            
            # Calculate test score
            total_points = sum(tc.points for tc in test_cases)
            earned_points = sum(r.get('score', 0) for r in test_results)
            
            if total_points > 0:
                test_score = (earned_points / total_points) * 100
            else:
                test_score = 0
            
            # Count passed tests
            passed_count = sum(1 for r in test_results if r.get('passed'))
            total_count = len(test_results)
            
            # Manual rubric only: do not set final_score from tests; faculty grades via rubric
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
                    "total_tests": total_count
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
                    "total_tests": total_count
                }
            
        except Exception as e:
            logger.error(f"Error grading submission {submission_id}: {str(e)}")
            submission.status = SubmissionStatus.ERROR
            submission.error_message = str(e)
            self.db.commit()
            raise
    
    async def _run_test_case(self, submission: Submission, test_case: TestCase) -> Dict[str, Any]:
        """Run a single test case in sandbox"""
        try:
            assignment = submission.assignment
            language = assignment.language  # This is now a Language object
            
            # Get code to execute (either from submission files or inline code)
            code = self._get_submission_code(submission, assignment)
            
            if not code:
                return self._create_test_result(
                    submission, test_case,
                    passed=False, score=0,
                    output="", error="No code found to execute"
                )
            
            # Build execution command based on language
            cmd = self._build_execution_command(language, test_case)
            
            raw_input = test_case.input_data or ""
            input_data = raw_input.replace(",", "\n") if raw_input else ""
            
            # Run in sandbox (using Docker or subprocess based on config)
            start_time = datetime.utcnow()
            
            result = await self._execute_in_sandbox(
                code=code,
                cmd=cmd,
                input_data=input_data,
                language=language,
                timeout=test_case.time_limit_seconds or assignment.time_limit_seconds or 30
            )
            
            execution_time = (datetime.utcnow() - start_time).total_seconds() * 1000  # ms
            
            passed = self._check_test_output(
                actual=result.get('output', ''),
                expected=test_case.expected_output or '',
                ignore_whitespace=test_case.ignore_whitespace,
                ignore_case=test_case.ignore_case,
                use_regex=test_case.use_regex
            )
            
            # Calculate score
            score = test_case.points if passed else 0
            
            # Save test result to database
            return self._create_test_result(
                submission, test_case,
                passed=passed,
                score=score,
                output=result.get('output', ''),
                error=result.get('error', ''),
                execution_time=execution_time,
                memory_used=result.get('memory_used', 0)
            )
            
        except asyncio.TimeoutError:
            return self._create_test_result(
                submission, test_case,
                passed=False, score=0,
                output="", error="Time Exceeds",
                execution_time=30000
            )
        except Exception as e:
            logger.error(f"Error running test case {test_case.id}: {str(e)}")
            return self._create_test_result(
                submission, test_case,
                passed=False, score=0,
                output="", error=str(e)
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
    
    def _get_submission_code(self, submission: Submission, assignment: Assignment) -> Optional[str]:
        """Get the code to execute from submission"""
        # First check if there's inline code
        if submission.code:
            return submission.code
        
        # Otherwise look for files
        if submission.files:
            language = assignment.language
            ext = language.file_extension if language else ".py"
            
            # Find main file
            for file in submission.files:
                if file.filename.endswith(ext):
                    return file.content
            
            # Return first file if no language match
            return submission.files[0].content if submission.files else None
        
        return None
    
    def _build_execution_command(self, language: Language, test_case: TestCase) -> str:
        """Build the execution command based on language"""
        if not language:
            return "python3 main.py"
        
        return language.run_command.replace("{filename}", "main" + language.file_extension)
    
    async def _execute_in_sandbox(
        self, code: str, cmd: str, input_data: str,
        language: Language, timeout: int
    ) -> Dict[str, Any]:
        """Execute code in a sandboxed environment"""
        try:
            # For now, use simple subprocess execution
            # In production, use Docker sandbox
            
            import tempfile
            
            # Create temp directory for code
            with tempfile.TemporaryDirectory() as tmpdir:
                # Write code to file
                ext = language.file_extension if language else ".py"
                code_file = Path(tmpdir) / f"main{ext}"
                code_file.write_text(code)
                
                # Determine execution command
                if language and language.compile_command:
                    # Compiled language - compile first
                    compile_cmd = language.compile_command.replace("{filename}", f"main{ext}")
                    compile_cmd = compile_cmd.replace("{output}", "main")
                    
                    proc = await asyncio.create_subprocess_shell(
                        compile_cmd,
                        cwd=tmpdir,
                        stdout=asyncio.subprocess.PIPE,
                        stderr=asyncio.subprocess.PIPE
                    )
                    _, stderr = await asyncio.wait_for(proc.communicate(), timeout=30)
                    
                    if proc.returncode != 0:
                        return {
                            "output": "",
                            "error": f"Compilation failed: {stderr.decode('utf-8', errors='ignore')}"
                        }
                
                # Run the code
                run_cmd = cmd if cmd else f"python3 main{ext}"
                
                proc = await asyncio.create_subprocess_shell(
                    run_cmd,
                    cwd=tmpdir,
                    stdin=asyncio.subprocess.PIPE,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE
                )
                
                stdout, stderr = await asyncio.wait_for(
                    proc.communicate(input=input_data.encode() if input_data else None),
                    timeout=timeout
                )
                
                return {
                    "output": stdout.decode('utf-8', errors='ignore').strip(),
                    "error": stderr.decode('utf-8', errors='ignore').strip(),
                    "exit_code": proc.returncode
                }
                
        except asyncio.TimeoutError:
            return {
                "output": "",
                "error": "Time Exceeds",
                "timed_out": True
            }
        except Exception as e:
            return {
                "output": "",
                "error": str(e)
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
