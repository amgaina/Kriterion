"""
Code Execution Celery Tasks
"""
import tempfile
import os
import shutil
from typing import Dict, List, Any
from celery import Task
from sqlalchemy.orm import Session

from app.core.celery_app import celery_app
from app.core.database import SessionLocal
from app.core.logging import logger
from app.models import Assignment, TestCase, User, AuditLog
from app.services.sandbox import sandbox_executor
from sqlalchemy import and_, or_


class DatabaseTask(Task):
    """Base task with database session management"""
    _db = None

    @property
    def db(self) -> Session:
        if self._db is None:
            self._db = SessionLocal()
        return self._db

    def after_return(self, *args, **kwargs):
        if self._db is not None:
            self._db.close()
            self._db = None


@celery_app.task(
    bind=True,
    base=DatabaseTask,
    name="app.tasks.code_execution.run_code_task",
    max_retries=3,
    default_retry_delay=10,
)
def run_code_task(
    self,
    assignment_id: int,
    user_id: int,
    files: List[Dict[str, str]],
) -> Dict[str, Any]:
    """
    Run code against test cases in the background
    
    Args:
        assignment_id: Assignment ID
        user_id: User ID who initiated the run
        files: List of files with 'name' and 'content'
        
    Returns:
        Dict with test results
    """
    try:
        # Get assignment with test cases
        assignment = self.db.query(Assignment).filter(
            Assignment.id == assignment_id
        ).first()
        
        if not assignment:
            return {
                "success": False,
                "error": "Assignment not found",
                "results": [],
                "total_score": 0,
                "max_score": 0,
                "tests_passed": 0,
                "tests_total": 0,
            }
        
        # Get test cases (only public/sample for practice runs)
        test_cases = self.db.query(TestCase).filter(
            and_(
                TestCase.assignment_id == assignment_id,
                or_(
                    TestCase.is_sample == True,
                    TestCase.is_hidden == False
                )
            )
        ).order_by(TestCase.order).all()
        
        # If no test cases, just compile
        if not test_cases:
            return compile_check_task.apply_async(
                args=[assignment_id, user_id, files],
                queue="code_execution"
            ).get()
        
        # Create temp directory for code
        temp_dir = tempfile.mkdtemp(prefix=f"celery_run_{assignment_id}_")
        
        try:
            # Write files
            for file in files:
                file_path = os.path.join(temp_dir, file["name"])
                with open(file_path, 'w', encoding='utf-8') as f:
                    f.write(file["content"])
            
            # Run tests
            all_results = []
            total_score = 0
            max_score = 0
            tests_passed = 0
            language = assignment.language.name.lower() if assignment.language else "python"
            
            for test_case in test_cases:
                max_score += test_case.points
                
                try:
                    # Execute code
                    execution_result = sandbox_executor.execute_code(
                        code_path=temp_dir,
                        language=language,
                        test_input=test_case.input_data,
                        command_args=None
                    )
                    
                    # Compare output
                    actual_output = execution_result.get("stdout", "").strip()
                    expected_output = (test_case.expected_output or "").strip()
                    
                    # Apply comparison settings
                    if test_case.ignore_whitespace:
                        actual_output = " ".join(actual_output.split())
                        expected_output = " ".join(expected_output.split())
                    
                    if test_case.ignore_case:
                        actual_output = actual_output.lower()
                        expected_output = expected_output.lower()
                    
                    passed = (
                        execution_result.get("success", False) and 
                        actual_output == expected_output
                    )
                    
                    if passed:
                        tests_passed += 1
                        total_score += test_case.points
                    
                    all_results.append({
                        "id": test_case.id,
                        "name": test_case.name,
                        "passed": passed,
                        "score": test_case.points if passed else 0,
                        "max_score": test_case.points,
                        "output": execution_result.get("stdout", "")[:1000],
                        "error": execution_result.get("stderr", "")[:1000] if not execution_result.get("success") else None,
                        "expected_output": expected_output if not passed else None,
                        "execution_time": execution_result.get("runtime", 0)
                    })
                    
                except Exception as e:
                    logger.error(f"Test execution error: {str(e)}", exc_info=True)
                    all_results.append({
                        "id": test_case.id,
                        "name": test_case.name,
                        "passed": False,
                        "score": 0,
                        "max_score": test_case.points,
                        "output": None,
                        "error": f"Execution error: {str(e)}",
                        "expected_output": None,
                        "execution_time": 0
                    })
            
            # Audit log
            audit = AuditLog(
                user_id=user_id,
                event_type="code_run_celery",
                description=f"Code run for assignment {assignment_id}: {tests_passed}/{len(test_cases)} tests passed"
            )
            self.db.add(audit)
            self.db.commit()
            
            return {
                "success": True,
                "results": all_results,
                "total_score": total_score,
                "max_score": max_score,
                "tests_passed": tests_passed,
                "tests_total": len(test_cases),
                "message": f"Tests completed: {tests_passed}/{len(test_cases)} passed"
            }
            
        finally:
            # Clean up
            if os.path.exists(temp_dir):
                try:
                    shutil.rmtree(temp_dir)
                except Exception as e:
                    logger.warning(f"Failed to clean up temp dir: {str(e)}")
    
    except Exception as e:
        logger.error(f"Code execution task error: {str(e)}", exc_info=True)
        # Retry on failure
        raise self.retry(exc=e, countdown=min(2 ** self.request.retries, 60))


@celery_app.task(
    bind=True,
    base=DatabaseTask,
    name="app.tasks.code_execution.compile_check_task",
    max_retries=2,
)
def compile_check_task(
    self,
    assignment_id: int,
    user_id: int,
    files: List[Dict[str, str]],
) -> Dict[str, Any]:
    """
    Check if code compiles/runs without test cases
    
    Args:
        assignment_id: Assignment ID
        user_id: User ID
        files: List of files
        
    Returns:
        Dict with compilation result
    """
    try:
        assignment = self.db.query(Assignment).filter(
            Assignment.id == assignment_id
        ).first()
        
        if not assignment:
            return {
                "success": False,
                "error": "Assignment not found",
                "results": [],
                "total_score": 0,
                "max_score": 0,
                "tests_passed": 0,
                "tests_total": 0,
                "message": "Assignment not found"
            }
        
        temp_dir = tempfile.mkdtemp(prefix=f"celery_compile_{assignment_id}_")
        
        try:
            # Write files
            for file in files:
                file_path = os.path.join(temp_dir, file["name"])
                with open(file_path, 'w', encoding='utf-8') as f:
                    f.write(file["content"])
            
            # Try to compile/run
            language = assignment.language.name.lower() if assignment.language else "python"
            execution_result = sandbox_executor.execute_code(
                code_path=temp_dir,
                language=language,
                test_input="",
                command_args=None
            )
            
            # Check result
            success = execution_result.get("success", False) or execution_result.get("exit_code") == 0
            
            if success:
                message = "✓ Your code compiled and ran successfully!"
                if execution_result.get("stdout"):
                    message += f"\n\nOutput:\n{execution_result.get('stdout', '')[:500]}"
            else:
                error_msg = execution_result.get("stderr", "Unknown error")
                message = f"⚠ Compilation/Runtime Error:\n{error_msg[:500]}"
            
            # Audit log
            audit = AuditLog(
                user_id=user_id,
                event_type="code_compile_check_celery",
                description=f"Compilation check for assignment {assignment_id}: {'success' if success else 'failed'}"
            )
            self.db.add(audit)
            self.db.commit()
            
            return {
                "success": success,
                "results": [],
                "total_score": 0,
                "max_score": 0,
                "tests_passed": 0,
                "tests_total": 0,
                "message": message
            }
            
        finally:
            if os.path.exists(temp_dir):
                try:
                    shutil.rmtree(temp_dir)
                except Exception as e:
                    logger.warning(f"Failed to clean up: {str(e)}")
    
    except Exception as e:
        logger.error(f"Compile check error: {str(e)}", exc_info=True)
        raise self.retry(exc=e, countdown=10)
