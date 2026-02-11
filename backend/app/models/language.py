"""
Language Model - Programming language configuration for code execution
"""
from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.core.database import Base


class Language(Base):
    """
    Language - Supported programming language with execution configuration.
    """
    __tablename__ = "languages"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Basic info
    name = Column(String(50), unique=True, nullable=False)  # python, java, cpp
    display_name = Column(String(100), nullable=False)  # Python, Java, C++
    #version = Column(String(20), nullable=True)  # 3.11, 17, 11
    
    # File info
    file_extension = Column(String(10), nullable=False)  # .py, .java, .cpp
    
    # Execution commands
    compile_command = Column(Text, nullable=True)  # For compiled languages
    run_command = Column(Text, nullable=False)  # Command to execute
    
    # Docker image for sandboxed execution
    docker_image = Column(String(255), nullable=True)  # python:3.11-slim
    
    # Default limits
    default_timeout_seconds = Column(Integer, default=30)
    default_memory_mb = Column(Integer, default=256)
    
    # Status
    is_active = Column(Boolean, default=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    assignments = relationship("Assignment", back_populates="language")
    faculty_permissions = relationship("FacultyLanguagePermission", back_populates="language",
                                       cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<Language {self.display_name} ({self.version})>"


class FacultyLanguagePermission(Base):
    """
    FacultyLanguagePermission - Which languages a faculty member can use.
    Admin can restrict which languages each faculty can assign.
    """
    __tablename__ = "faculty_language_permissions"
    
    id = Column(Integer, primary_key=True, index=True)
    faculty_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    language_id = Column(Integer, ForeignKey("languages.id"), nullable=False)
    
    is_allowed = Column(Boolean, default=True)
    
    # Timestamps
    granted_at = Column(DateTime, default=datetime.utcnow)
    granted_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    # Relationships
    faculty = relationship("User", back_populates="language_permissions", foreign_keys=[faculty_id])
    language = relationship("Language", back_populates="faculty_permissions")
    
    def __repr__(self):
        return f"<FacultyLanguagePermission faculty={self.faculty_id} language={self.language_id}>"


# Default languages to seed
DEFAULT_LANGUAGES = [
    {
        "name": "python",
        "display_name": "Python",
        "version": "3.11",
        "file_extension": ".py",
        "compile_command": None,
        "run_command": "python3 {filename}",
        "docker_image": "python:3.11-slim",
        "default_timeout_seconds": 30,
        "default_memory_mb": 256,
        "monaco_language": "python",
        "is_active": True
    },
    {
        "name": "java",
        "display_name": "Java",
        "version": "17",
        "file_extension": ".java",
        "compile_command": "javac {filename}",
        "run_command": "java {classname}",
        "docker_image": "openjdk:17-slim",
        "default_timeout_seconds": 30,
        "default_memory_mb": 512,
        "monaco_language": "java",
        "is_active": True
    },
    {
        "name": "cpp",
        "display_name": "C++",
        "version": "17",
        "file_extension": ".cpp",
        "compile_command": "g++ -std=c++17 -o {output} {filename}",
        "run_command": "./{output}",
        "docker_image": "gcc:latest",
        "default_timeout_seconds": 30,
        "default_memory_mb": 256,
        "monaco_language": "cpp",
        "is_active": True
    },
    {
        "name": "c",
        "display_name": "C",
        "version": "11",
        "file_extension": ".c",
        "compile_command": "gcc -std=c11 -o {output} {filename}",
        "run_command": "./{output}",
        "docker_image": "gcc:latest",
        "default_timeout_seconds": 30,
        "default_memory_mb": 256,
        "monaco_language": "c",
        "is_active": True
    },
    {
        "name": "javascript",
        "display_name": "JavaScript",
        "version": "ES2022",
        "file_extension": ".js",
        "compile_command": None,
        "run_command": "node {filename}",
        "docker_image": "node:20-slim",
        "default_timeout_seconds": 30,
        "default_memory_mb": 256,
        "monaco_language": "javascript",
        "is_active": True
    },
]
