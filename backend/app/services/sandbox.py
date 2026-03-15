import os
import re
import glob
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
        start_time = datetime.utcnow()
        
        try:
            exec_command = self._get_exec_command(language, code_path, command_args)
            result = self._run_in_docker(exec_command, code_path, test_input)
            
            runtime = (datetime.utcnow() - start_time).total_seconds()
            timed_out = result.get("exit_code") == -1 and "timed out" in result.get("stderr", "").lower()
            
            return {
                "stdout": result.get("stdout", ""),
                "stderr": result.get("stderr", ""),
                "exit_code": result.get("exit_code", -1),
                "runtime": runtime,
                "memory_used": result.get("memory_used", 0),
                "timed_out": timed_out or runtime >= self.timeout,
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

    def _find_java_main_class(self, code_path: str) -> str:
        """Scan .java files to find the class containing public static void main."""
        java_files = glob.glob(os.path.join(code_path, "*.java"))
        main_pattern = re.compile(
            r'public\s+static\s+void\s+main\s*\(\s*String',
            re.DOTALL
        )
        class_pattern = re.compile(
            r'(?:public\s+)?class\s+(\w+)'
        )
        
        for jf in java_files:
            try:
                with open(jf, 'r', encoding='utf-8', errors='ignore') as f:
                    content = f.read()
                if main_pattern.search(content):
                    match = class_pattern.search(content)
                    if match:
                        return match.group(1)
            except Exception:
                continue
        
        # Fallback: use filename without extension of first .java file
        if java_files:
            return os.path.splitext(os.path.basename(java_files[0]))[0]
        return "Main"

    def _get_exec_command(self, language: str, code_path: str, args: Optional[str] = None) -> str:
        """Build execution command based on language, handling arbitrary filenames."""
        a = args or ""
        lang = language.lower().strip()
        
        if lang == "python":
            py_files = glob.glob(os.path.join(code_path, "*.py"))
            if not py_files:
                return "echo 'No .py files found'"
            entry = os.path.basename(py_files[0])
            # Prefer main.py if it exists
            for pf in py_files:
                if os.path.basename(pf).lower() == "main.py":
                    entry = "main.py"
                    break
            return f"python3 {entry} {a}".strip()
        
        elif lang == "java":
            main_class = self._find_java_main_class(code_path)
            return f"javac *.java && java {main_class} {a}".strip()
        
        elif lang == "cpp" or lang == "c++":
            return f"g++ -std=c++17 -o program *.cpp && ./program {a}".strip()
        
        elif lang == "c":
            return f"gcc -std=c11 -o program *.c && ./program {a}".strip()
        
        elif lang == "javascript":
            js_files = glob.glob(os.path.join(code_path, "*.js"))
            if not js_files:
                return "echo 'No .js files found'"
            entry = os.path.basename(js_files[0])
            for jf in js_files:
                if os.path.basename(jf).lower() in ("main.js", "index.js"):
                    entry = os.path.basename(jf)
                    break
            return f"node {entry} {a}".strip()
        
        elif lang == "typescript":
            ts_files = glob.glob(os.path.join(code_path, "*.ts"))
            if not ts_files:
                return "echo 'No .ts files found'"
            entry = os.path.basename(ts_files[0])
            return f"ts-node {entry} {a}".strip()
        
        elif lang in ("csharp", "c#"):
            cs_files = glob.glob(os.path.join(code_path, "*.cs"))
            cs_file = os.path.basename(cs_files[0]) if cs_files else "Program.cs"
            return f"mcs -out:program.exe {cs_file} && mono program.exe {a}".strip()
        
        return "echo 'Unsupported language'"

    def get_exec_command(self, language: str, code_path: str, command_args: Optional[str] = None) -> str:
        """Public: return shell command to run code (for interactive execution)."""
        return self._get_exec_command(language, code_path, command_args)

    def _run_in_docker(
        self,
        command: str,
        code_path: str,
        stdin_input: Optional[str] = None
    ) -> Dict[str, Any]:
        if os.path.exists("/.dockerenv"):
            return self._run_local(command, code_path, stdin_input)
        
        if settings.ENVIRONMENT == "development":
            return self._run_local(command, code_path, stdin_input)
        
        docker_cmd = [
            "docker", "run",
            "--rm",
            "--network", "none",
            "--memory", self.memory_limit,
            "--cpus", str(self.cpu_limit),
            "--user", "1000:1000",
            "-v", f"{code_path}:/workspace:ro",
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
                "memory_used": 0
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
                "memory_used": 0
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
