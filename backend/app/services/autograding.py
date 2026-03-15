from typing import Dict, List, Any, Tuple
from sqlalchemy.orm import Session
from app.models.submission import Submission
from app.models.assignment import TestCase, Assignment
from app.services.sandbox import sandbox_executor
from app.services.s3_storage import s3_service
from app.core.logging import logger
import os


def _get_test_case_input_file_list(test_case: TestCase) -> List[Tuple[str, str]]:
    """Return list of (filename, s3_key) for test case input files. Prefer input_files_json; fallback to single file."""
    files_json = getattr(test_case, "input_files_json", None)
    if files_json and isinstance(files_json, list) and len(files_json) > 0:
        return [(item.get("filename") or "input.txt", item.get("s3_key")) for item in files_json if item.get("s3_key")]
    key = getattr(test_case, "input_file_s3_key", None)
    if key:
        fn = (getattr(test_case, "input_filename", None) or "input.txt").strip() or "input.txt"
        return [(fn, key)]
    return []


class AutoGradingService:
    """Autograding service for submissions"""
    
    def grade_submission(self, submission: Submission, db: Session) -> Dict[str, Any]:
        """
        Grade a submission by running all test cases
        
        Returns:
            Dict with test results and score
        """
        assignment = db.query(Assignment).filter(Assignment.id == submission.assignment_id).first()
        if not assignment:
            return {"error": "Assignment not found"}
        
        # Get all test cases for this assignment
        test_cases = db.query(TestCase).filter(
            TestCase.assignment_id == assignment.id
        ).order_by(TestCase.order).all()
        
        results = {
            "test_cases": [],
            "public_passed": 0,
            "public_total": 0,
            "hidden_passed": 0,
            "hidden_total": 0,
            "total_score": 0,
            "max_score": 0
        }
        
        for test_case in test_cases:
            case_result = self._run_test_case(
                test_case,
                submission.files_path if hasattr(submission, 'files_path') else "",
                assignment.language.name if assignment.language else "python"
            )
            results["test_cases"].append(case_result)
            
            if not test_case.is_hidden:
                results["public_total"] += 1
                if case_result["passed"]:
                    results["public_passed"] += 1
            else:
                results["hidden_total"] += 1
                if case_result["passed"]:
                    results["hidden_passed"] += 1
            
            if case_result["passed"]:
                results["total_score"] += test_case.points
            results["max_score"] += test_case.points
        
        # Calculate percentage score
        if results["max_score"] > 0:
            percentage = (results["total_score"] / results["max_score"]) * 100
        else:
            percentage = 0
        
        results["percentage"] = percentage
        
        return results
    
    def _run_test_case(
        self,
        test_case: TestCase,
        code_path: str,
        language: str
    ) -> Dict[str, Any]:
        """Run a single test case"""
        result = {
            "test_name": test_case.name,
            "passed": False,
            "output": "",
            "expected": "",
            "error": "",
            "runtime": 0
        }
        
        try:
            input_type = getattr(test_case, "input_type", "stdin") or "stdin"
            if input_type == "file":
                file_list = _get_test_case_input_file_list(test_case)
                if file_list:
                    try:
                        for input_filename, s3_key in file_list:
                            if not s3_key or ".." in (input_filename or "") or "/" in (input_filename or "") or "\\" in (input_filename or ""):
                                continue
                            file_content = s3_service.get_object_content(s3_key)
                            input_path = os.path.join(code_path, (input_filename or "input.txt").strip() or "input.txt")
                            with open(input_path, "w", encoding="utf-8") as f:
                                f.write(file_content)
                        test_input = ""
                    except Exception as e:
                        logger.warning(f"Autograding: failed to load test input file(s) from S3: {e}")
                        test_input = test_case.input_data or ""
                else:
                    test_input = test_case.input_data or ""
            else:
                test_input = test_case.input_data or ""

            execution_result = sandbox_executor.execute_code(
                code_path=code_path,
                language=language,
                test_input=test_input
            )
            
            result["output"] = execution_result["stdout"]
            result["error"] = execution_result["stderr"]
            result["runtime"] = execution_result["runtime"]

            expected_output_type = getattr(test_case, "expected_output_type", "text") or "text"
            if expected_output_type == "file" and getattr(test_case, "expected_output_file_s3_key", None):
                try:
                    expected = s3_service.get_object_content(test_case.expected_output_file_s3_key).strip()
                except Exception as e:
                    logger.warning(f"Autograding: failed to load expected output file from S3: {e}")
                    expected = test_case.expected_output or ""
            else:
                expected = test_case.expected_output or ""
            result["expected"] = expected
            
            if execution_result["success"]:
                actual = execution_result["stdout"]
                if test_case.ignore_whitespace:
                    actual = " ".join(actual.split())
                    expected = " ".join(expected.split())
                if test_case.ignore_case:
                    actual = actual.lower()
                    expected = expected.lower()
                result["passed"] = actual.strip() == expected.strip()
            
        except Exception as e:
            logger.error(f"Test case execution error: {str(e)}")
            result["error"] = str(e)
        
        return result


autograding_service = AutoGradingService()
