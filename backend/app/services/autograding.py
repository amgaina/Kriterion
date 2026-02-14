from typing import Dict, List, Any
from sqlalchemy.orm import Session
from app.models.submission import Submission
from app.models.assignment import TestCase, Assignment
from app.services.sandbox import sandbox_executor
from app.core.logging import logger
import os


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
            # Execute code with test input
            execution_result = sandbox_executor.execute_code(
                code_path=code_path,
                language=language,
                test_input=test_case.input_data
            )
            
            result["output"] = execution_result["stdout"]
            result["error"] = execution_result["stderr"]
            result["runtime"] = execution_result["runtime"]
            result["expected"] = test_case.expected_output or ""
            
            # Check if output matches expected
            if execution_result["success"]:
                actual = execution_result["stdout"]
                expected = test_case.expected_output or ""
                
                # Apply comparison settings
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
