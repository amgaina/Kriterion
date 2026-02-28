"""
Mapping of programming language names to allowed file extensions for submissions.
Used to auto-fill allowed_file_extensions when an assignment language is selected.
"""
from typing import List

# Language name (lowercase) -> list of allowed extensions (e.g. .py, .java)
LANGUAGE_EXTENSIONS: dict[str, List[str]] = {
    "python": [".py"],
    "java": [".java"],
    "cpp": [".cpp", ".cc", ".cxx", ".h", ".hpp", ".hxx"],
    "c": [".c", ".h"],
    "javascript": [".js", ".mjs", ".cjs"],
    "typescript": [".ts", ".tsx", ".js", ".jsx"],
    "go": [".go"],
    "rust": [".rs"],
    "ruby": [".rb"],
    "php": [".php"],
    "swift": [".swift"],
    "kotlin": [".kt", ".kts"],
    "scala": [".scala"],
    "r": [".r", ".R"],
    "matlab": [".m"],
}

def get_extensions_for_language(language_name: str) -> List[str]:
    """
    Get allowed file extensions for a programming language.
    Falls back to [f".{language_name}"] or common defaults if not in mapping.
    """
    key = (language_name or "").strip().lower()
    if key in LANGUAGE_EXTENSIONS:
        return list(LANGUAGE_EXTENSIONS[key])
    # Fallback: try treating name as extension base (e.g. "python" -> ".py")
    if key:
        ext = f".{key}" if not key.startswith(".") else key
        return [ext]
    return []
