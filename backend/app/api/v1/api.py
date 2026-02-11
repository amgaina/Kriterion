from fastapi import APIRouter
from app.api.v1.endpoints import (
    auth, courses, assignments, submissions, reports, admin,
    students, faculty, settings, code, languages
)

api_router = APIRouter()

# Authentication
api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])

# Student endpoints
api_router.include_router(students.router, prefix="/student", tags=["Student"])

# Faculty endpoints
api_router.include_router(faculty.router, prefix="/faculty", tags=["Faculty"])

# Admin endpoints
api_router.include_router(admin.router, prefix="/admin", tags=["Admin"])

# Course management
api_router.include_router(courses.router, prefix="/courses", tags=["Courses"])

# Assignment management
api_router.include_router(assignments.router, prefix="/assignments", tags=["Assignments"])

# Submissions
api_router.include_router(submissions.router, prefix="/submissions", tags=["Submissions"])

# Code execution
api_router.include_router(code.router, prefix="/code", tags=["Code Execution"])

# Reports & Analytics
api_router.include_router(reports.router, prefix="/reports", tags=["Reports"])

# User settings & profile
api_router.include_router(settings.router, prefix="/settings", tags=["Settings"])

# Programming languages
api_router.include_router(languages.router, prefix="/languages", tags=["Languages"])

