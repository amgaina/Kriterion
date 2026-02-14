import os
import json
import subprocess
import tempfile
import shutil
from typing import Dict, Any, Optional
from datetime import datetime
from app.core.config import settings
from app.core.logging import logger


class SandboxExecutor:
    """Execute student code in isolated Docker container"""
    
    def __init__(self):
        self.timeout = settings.SANDBOX_TIMEOUT_SECONDS
        self.memory_limit = f"{settings.SANDBOX_MEMORY_LIMIT_MB}m"
        self.cpu_limit = settings.SANDBOX_CPU_LIMIT
        self.sandbox_image = settings.SANDBOX_IMAGE
    
    def execute_code(
        self,
        code_path: str,
        language: str,
        test_input: Optional[str] = None,
        command_args: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Execute code in sandbox
        
        Args:
            code_path: Path to code files
            language: Programming language
            test_input: stdin input for the program
            command_args: Command line arguments
            
        Returns:
            Dict with stdout, stderr, exit_code, runtime, memory_used
        """
        start_time = datetime.utcnow()
        
        try:
            # Prepare execution command based on language
            exec_command = self._get_exec_command(language, code_path, command_args)
            
            # Execute in Docker container
            result = self._run_in_docker(exec_command, code_path, test_input)
            
            runtime = (datetime.utcnow() - start_time).total_seconds()
            
            return {
                "stdout": result.get("stdout", ""),
                "stderr": result.get("stderr", ""),
                "exit_code": result.get("exit_code", -1),
                "runtime": runtime,
                "memory_used": result.get("memory_used", 0),
                "timed_out": runtime >= self.timeout,
                "success": result.get("exit_code", -1) == 0
            }
            
        except Exception as e:
            logger.error(f"Sandbox execution error: {str(e)}")
            return {
                "stdout": "",
                "stderr": str(e),
                "exit_code": -1,
                "runtime": 0,
                "memory_used": 0,
                "timed_out": False,
                "success": False
            }
    
    def _get_exec_command(self, language: str, code_path: str, args: Optional[str] = None) -> str:
        """Get execution command based on language"""
        import glob
        
        # For Python, find the first .py file
        python_files = glob.glob(os.path.join(code_path, "*.py"))
        python_file = os.path.basename(python_files[0]) if python_files else "main.py"
        
        commands = {
            "python": f"python3 {python_file} {args or ''}",
            "java": f"javac *.java && java Main {args or ''}",
            "cpp": f"g++ -o program *.cpp && ./program {args or ''}",
            "c": f"gcc -o program *.c && ./program {args or ''}",
            "javascript": f"node *.js {args or ''}",
            "typescript": f"ts-node *.ts {args or ''}"
        }
        return commands.get(language, "echo 'Unsupported language'")

    
    def _run_in_docker(
        self,
        command: str,
        code_path: str,
        stdin_input: Optional[str] = None
    ) -> Dict[str, Any]:
        """Run command in Docker container"""
        
        # If we're already inside a Docker container (backend container),
        # use local execution instead of trying Docker-in-Docker
        if os.path.exists("/.dockerenv"):
            logger.info("Running inside Docker container, using local execution")
            return self._run_local(command, code_path, stdin_input)
        
        # For development without Docker, use subprocess directly
        if settings.ENVIRONMENT == "development":
            logger.info("Development mode, using local execution")
            return self._run_local(command, code_path, stdin_input)
        
        # Docker execution (only for production on host machine)
        docker_cmd = [
            "docker", "run",
            "--rm",
            "--network", "none",  # No network access
            "--memory", self.memory_limit,
            "--cpus", str(self.cpu_limit),
            "--user", "1000:1000",  # Non-root user
            "-v", f"{code_path}:/workspace:ro",  # Read-only mount
            "-w", "/workspace",
            self.sandbox_image,
            "sh", "-c", command
        ]
        
        try:
            process = subprocess.run(
                docker_cmd,
                input=stdin_input.encode() if stdin_input else None,
                capture_output=True,
                timeout=self.timeout
            )
            
            return {
                "stdout": process.stdout.decode(),
                "stderr": process.stderr.decode(),
                "exit_code": process.returncode,
                "memory_used": 0  # Would need Docker stats for accurate value
            }
        except subprocess.TimeoutExpired:
            return {
                "stdout": "",
                "stderr": "Execution timed out",
                "exit_code": -1,
                "memory_used": 0
            }
        except Exception as e:
            return {
                "stdout": "",
                "stderr": f"Docker execution error: {str(e)}",
                "exit_code": -1,
                "memory_used": 0
            }
    
    def _run_local(self, command: str, code_path: str, stdin_input: Optional[str] = None) -> Dict[str, Any]:
        """Run locally for development (not secure for production)"""
        try:
            process = subprocess.run(
                command,
                shell=True,
                cwd=code_path,
                input=stdin_input.encode() if stdin_input else None,
                capture_output=True,
                timeout=self.timeout
            )
            
            return {
                "stdout": process.stdout.decode('utf-8', errors='replace'),
                "stderr": process.stderr.decode('utf-8', errors='replace'),
                "exit_code": process.returncode,
                "memory_used": 0  # Not available in local mode
            }
        except subprocess.TimeoutExpired:
            logger.warning(f"Process timed out after {self.timeout} seconds")
            return {
                "stdout": "",
                "stderr": f"Execution timed out after {self.timeout} seconds",
                "exit_code": -1,
                "memory_used": 0
            }
        except FileNotFoundError as e:
            logger.error(f"File not found during execution: {str(e)}")
            return {
                "stdout": "",
                "stderr": f"Required file or command not found: {str(e)}",
                "exit_code": -1,
                "memory_used": 0
            }
        except Exception as e:
            logger.error(f"Local execution error: {str(e)}", exc_info=True)
            return {
                "stdout": "",
                "stderr": f"Execution error: {str(e)}",
                "exit_code": -1,
                "memory_used": 0
            }


sandbox_executor = SandboxExecutor()
