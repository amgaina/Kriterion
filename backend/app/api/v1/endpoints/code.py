"""
Code Execution Endpoints - Run code, get results
"""
from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user
from app.models import User, Language, Assignment, Enrollment, EnrollmentStatus
from app.core.logging import logger
from pydantic import BaseModel
import asyncio
import tempfile
from pathlib import Path

router = APIRouter()


# ============== Schemas ==============

class CodeExecutionRequest(BaseModel):
    code: str
    language_id: int
    input_data: Optional[str] = None
    timeout: int = 30  # seconds

class CodeExecutionResponse(BaseModel):
    success: bool
    output: str
    error: Optional[str]
    execution_time_ms: float
    memory_used_mb: Optional[float]

class LanguageResponse(BaseModel):
    id: int
    name: str
    display_name: str
    version: Optional[str]
    file_extension: str
    monaco_language: Optional[str]


# ============== Endpoints ==============

@router.get("/languages", response_model=List[LanguageResponse])
def get_languages(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all available programming languages"""
    languages = db.query(Language).filter(Language.is_active == True).all()
    
    return [
        LanguageResponse(
            id=lang.id,
            name=lang.name,
            display_name=lang.display_name,
            version=getattr(lang, "version", None),
            file_extension=lang.file_extension,
            monaco_language=getattr(lang, "monaco_language", None)
        ) for lang in languages
    ]


@router.post("/run", response_model=CodeExecutionResponse)
async def run_code(
    request: CodeExecutionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Execute code in sandbox and return results"""
    # Get language
    language = db.query(Language).filter(
        Language.id == request.language_id,
        Language.is_active == True
    ).first()
    
    if not language:
        raise HTTPException(status_code=400, detail="Invalid or inactive language")
    
    # Rate limiting - in production, use Redis
    # For now, simple check
    
    try:
        result = await _execute_code(
            code=request.code,
            language=language,
            input_data=request.input_data,
            timeout=min(request.timeout, 60)  # Max 60 seconds
        )
        
        logger.info(f"Code execution by user {current_user.id}: success={result['success']}")
        
        return CodeExecutionResponse(
            success=result['success'],
            output=result['output'],
            error=result.get('error'),
            execution_time_ms=result['execution_time_ms'],
            memory_used_mb=result.get('memory_used_mb')
        )
        
    except Exception as e:
        logger.error(f"Code execution error for user {current_user.id}: {str(e)}")
        return CodeExecutionResponse(
            success=False,
            output="",
            error=str(e),
            execution_time_ms=0,
            memory_used_mb=None
        )


@router.post("/run-assignment/{assignment_id}", response_model=CodeExecutionResponse)
async def run_assignment_code(
    assignment_id: int,
    request: CodeExecutionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Execute code for a specific assignment (uses assignment's language and test input)"""
    assignment = db.query(Assignment).filter(Assignment.id == assignment_id).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    
    # Check access
    enrollment = db.query(Enrollment).filter(
        Enrollment.student_id == current_user.id,
        Enrollment.course_id == assignment.course_id,
        Enrollment.status == EnrollmentStatus.ACTIVE
    ).first()
    
    if not enrollment and assignment.course.instructor_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Use assignment's language
    language = assignment.language
    if not language:
        raise HTTPException(status_code=400, detail="Assignment has no language configured")
    
    try:
        result = await _execute_code(
            code=request.code,
            language=language,
            input_data=request.input_data,
            timeout=assignment.time_limit_seconds or 30
        )
        
        return CodeExecutionResponse(
            success=result['success'],
            output=result['output'],
            error=result.get('error'),
            execution_time_ms=result['execution_time_ms'],
            memory_used_mb=result.get('memory_used_mb')
        )
        
    except Exception as e:
        return CodeExecutionResponse(
            success=False,
            output="",
            error=str(e),
            execution_time_ms=0,
            memory_used_mb=None
        )


@router.post("/test/{assignment_id}")
async def test_against_samples(
    assignment_id: int,
    request: CodeExecutionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Run code against sample (non-hidden) test cases"""
    from app.models import TestCase
    
    assignment = db.query(Assignment).filter(Assignment.id == assignment_id).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    
    # Get visible (non-hidden) test cases for run
    test_cases = db.query(TestCase).filter(
        TestCase.assignment_id == assignment_id,
        TestCase.is_hidden == False
    ).order_by(TestCase.order).all()

    if not test_cases:
        return {"message": "No visible test cases available", "results": []}
    
    language = assignment.language
    results = []
    
    for tc in test_cases:
        try:
            result = await _execute_code(
                code=request.code,
                language=language,
                input_data=tc.input_data,
                timeout=tc.time_limit_seconds or 30
            )
            
            # Check if output matches expected
            actual = result['output'].strip()
            expected = (tc.expected_output or "").strip()
            
            if tc.ignore_whitespace:
                actual = ' '.join(actual.split())
                expected = ' '.join(expected.split())
            
            passed = actual == expected
            
            results.append({
                "test_case_id": tc.id,
                "name": tc.name,
                "passed": passed,
                "expected": tc.expected_output,
                "actual": result['output'],
                "error": result.get('error'),
                "execution_time_ms": result['execution_time_ms']
            })
            
        except Exception as e:
            results.append({
                "test_case_id": tc.id,
                "name": tc.name,
                "passed": False,
                "expected": tc.expected_output,
                "actual": "",
                "error": str(e),
                "execution_time_ms": 0
            })
    
    passed_count = sum(1 for r in results if r['passed'])
    
    return {
        "total": len(results),
        "passed": passed_count,
        "failed": len(results) - passed_count,
        "results": results
    }


# ============== Helper Functions ==============

async def _execute_code(
    code: str,
    language: Language,
    input_data: Optional[str],
    timeout: int
) -> dict:
    """Execute code in a sandboxed environment"""
    start_time = datetime.utcnow()
    
    try:
        with tempfile.TemporaryDirectory() as tmpdir:
            # Write code to file
            code_file = Path(tmpdir) / f"main{language.file_extension}"
            code_file.write_text(code)
            
            # Handle compilation for compiled languages
            if language.compile_command:
                compile_cmd = language.compile_command
                compile_cmd = compile_cmd.replace("{filename}", f"main{language.file_extension}")
                compile_cmd = compile_cmd.replace("{output}", "main")
                compile_cmd = compile_cmd.replace("{classname}", "Main")
                
                proc = await asyncio.create_subprocess_shell(
                    compile_cmd,
                    cwd=tmpdir,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE
                )
                _, stderr = await asyncio.wait_for(proc.communicate(), timeout=30)
                
                if proc.returncode != 0:
                    execution_time = (datetime.utcnow() - start_time).total_seconds() * 1000
                    return {
                        "success": False,
                        "output": "",
                        "error": f"Compilation error:\n{stderr.decode('utf-8', errors='ignore')}",
                        "execution_time_ms": execution_time
                    }
            
            # Build run command
            run_cmd = language.run_command
            run_cmd = run_cmd.replace("{filename}", f"main{language.file_extension}")
            run_cmd = run_cmd.replace("{output}", "./main")
            run_cmd = run_cmd.replace("{classname}", "Main")
            
            # Execute
            proc = await asyncio.create_subprocess_shell(
                run_cmd,
                cwd=tmpdir,
                stdin=asyncio.subprocess.PIPE,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            input_bytes = input_data.encode() if input_data else None
            stdout, stderr = await asyncio.wait_for(
                proc.communicate(input=input_bytes),
                timeout=timeout
            )
            
            execution_time = (datetime.utcnow() - start_time).total_seconds() * 1000
            
            output = stdout.decode('utf-8', errors='ignore')
            error = stderr.decode('utf-8', errors='ignore')
            
            return {
                "success": proc.returncode == 0,
                "output": output,
                "error": error if error else None,
                "execution_time_ms": execution_time
            }
            
    except asyncio.TimeoutError:
        execution_time = (datetime.utcnow() - start_time).total_seconds() * 1000
        return {
            "success": False,
            "output": "",
            "error": f"Execution timed out (>{timeout}s)",
            "execution_time_ms": execution_time
        }
    except Exception as e:
        execution_time = (datetime.utcnow() - start_time).total_seconds() * 1000
        return {
            "success": False,
            "output": "",
            "error": str(e),
            "execution_time_ms": execution_time
        }
