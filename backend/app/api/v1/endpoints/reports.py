from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session
from sqlalchemy import and_, func, case
from datetime import datetime
import csv
import io

from app.api.deps import get_db, get_current_user, require_role
from app.models import User, UserRole, Assignment, Submission, Course, Enrollment, EnrollmentStatus
from app.schemas.reports import (
    StudentReportSchema,
    AssignmentReportSchema,
    CourseReportSchema,
    DashboardStats
)
from app.core.logging import logger

router = APIRouter()


@router.get("/dashboard", response_model=DashboardStats)
def get_dashboard_stats(
    course_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get dashboard statistics for current user"""
    stats = {}
    
    if current_user.role == UserRole.STUDENT:
        # Student dashboard stats
        enrollments = db.query(Enrollment).filter(
            and_(Enrollment.student_id == current_user.id, Enrollment.status == EnrollmentStatus.ACTIVE)
        ).all()
        
        enrolled_courses = len(enrollments)
        
        # Get submissions
        submissions = db.query(Submission).filter(
            Submission.student_id == current_user.id
        ).all()
        
        total_submissions = len(submissions)
        graded_submissions = len([s for s in submissions if s.status == "graded"])
        
        # Calculate average score
        if graded_submissions > 0:
            avg_score = sum(s.final_score for s in submissions if s.status == "graded") / graded_submissions
        else:
            avg_score = 0
        
        # Upcoming assignments
        enrolled_course_ids = [e.course_id for e in enrollments]
        upcoming = db.query(Assignment).filter(
            and_(
                Assignment.course_id.in_(enrolled_course_ids),
                Assignment.is_published == True,
                Assignment.due_date > datetime.utcnow()
            )
        ).order_by(Assignment.due_date).limit(5).all()
        
        stats = {
            "enrolled_courses": enrolled_courses,
            "total_submissions": total_submissions,
            "graded_submissions": graded_submissions,
            "average_score": round(avg_score, 2),
            "upcoming_assignments": len(upcoming),
            "recent_submissions": [
    {
        "id": sub.id,
        "assignment_id": sub.assignment_id,
        "created_at": sub.created_at.isoformat() if sub.created_at else None,
        "status": sub.status,
        "final_score": sub.final_score,
    }
    for sub in submissions[:5]
]
        }
    
    elif current_user.role == UserRole.FACULTY:
        # Faculty dashboard stats
        if course_id:
            courses = [db.query(Course).filter(Course.id == course_id).first()]
        else:
            courses = db.query(Course).filter(Course.instructor_id == current_user.id).all()
        
        total_courses = len(courses)
        course_ids = [c.id for c in courses]
        
        # Count students
        total_students = db.query(func.count(Enrollment.id)).filter(
            and_(
                Enrollment.course_id.in_(course_ids),
                Enrollment.status == EnrollmentStatus.ACTIVE
            )
        ).scalar()
        
        # Count assignments
        total_assignments = db.query(func.count(Assignment.id)).filter(
            Assignment.course_id.in_(course_ids)
        ).scalar()
        
        # Count submissions
        total_submissions = db.query(func.count(Submission.id)).join(
            Assignment
        ).filter(
            Assignment.course_id.in_(course_ids)
        ).scalar()
        
        # Pending grading
        pending_grading = db.query(func.count(Submission.id)).join(
            Assignment
        ).filter(
            and_(
                Assignment.course_id.in_(course_ids),
                Submission.status == "pending"
            )
        ).scalar()
        
        stats = {
            "total_courses": total_courses,
            "total_students": total_students,
            "total_assignments": total_assignments,
            "total_submissions": total_submissions,
            "pending_grading": pending_grading
        }
    
    elif current_user.role == UserRole.ADMIN:
        # Admin dashboard stats
        total_users = db.query(func.count(User.id)).scalar()
        total_courses = db.query(func.count(Course.id)).scalar()
        total_assignments = db.query(func.count(Assignment.id)).scalar()
        total_submissions = db.query(func.count(Submission.id)).scalar()
        
        stats = {
            "total_users": total_users,
            "total_courses": total_courses,
            "total_assignments": total_assignments,
            "total_submissions": total_submissions
        }
    
    return stats


@router.get("/student/{student_id}")
def get_student_report(
    student_id: int,
    course_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.FACULTY, UserRole.ADMIN]))
):
    """Get comprehensive report for a student"""
    student = db.query(User).filter(User.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    
    query = db.query(Submission).filter(Submission.student_id == student_id)
    
    if course_id:
        query = query.join(Assignment).filter(Assignment.course_id == course_id)
        
        # Verify faculty access
        if current_user.role == UserRole.FACULTY:
            course = db.query(Course).filter(Course.id == course_id).first()
            if course.instructor_id != current_user.id:
                raise HTTPException(status_code=403, detail="Not authorized")
    
    submissions = query.all()
    
    # Calculate statistics
    graded = [s for s in submissions if s.status == "graded"]
    avg_score = sum(s.final_score for s in graded) / len(graded) if graded else 0
    
    return {
        "student": {
            "id": student.id,
            "name": student.full_name,
            "email": student.email,
            "student_id": student.student_id
        },
        "total_submissions": len(submissions),
        "graded_submissions": len(graded),
        "average_score": round(avg_score, 2),
        "submissions": submissions
    }


@router.get("/assignment/{assignment_id}")
def get_assignment_report(
    assignment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.FACULTY, UserRole.ADMIN]))
):
    """Get comprehensive report for an assignment"""
    assignment = db.query(Assignment).filter(Assignment.id == assignment_id).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    
    # Verify faculty access
    if current_user.role == UserRole.FACULTY:
        if assignment.course.instructor_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not authorized")
    
    submissions = db.query(Submission).filter(
        Submission.assignment_id == assignment_id
    ).all()
    
    graded = [s for s in submissions if s.status == "graded"]
    
    # Calculate statistics
    if graded:
        scores = [s.final_score for s in graded]
        avg_score = sum(scores) / len(scores)
        min_score = min(scores)
        max_score = max(scores)
        
        # Score distribution
        distribution = {
            "A (90-100)": len([s for s in scores if s >= 90]),
            "B (80-89)": len([s for s in scores if 80 <= s < 90]),
            "C (70-79)": len([s for s in scores if 70 <= s < 80]),
            "D (60-69)": len([s for s in scores if 60 <= s < 70]),
            "F (<60)": len([s for s in scores if s < 60])
        }
    else:
        avg_score = 0
        min_score = 0
        max_score = 0
        distribution = {}
    
    return {
        "assignment": {
            "id": assignment.id,
            "title": assignment.title,
            "due_date": assignment.due_date,
            "total_points": assignment.rubric.total_points if assignment.rubric else 100
        },
        "total_submissions": len(submissions),
        "graded_submissions": len(graded),
        "average_score": round(avg_score, 2),
        "min_score": round(min_score, 2),
        "max_score": round(max_score, 2),
        "score_distribution": distribution,
        "late_submissions": len([s for s in submissions if s.is_late]),
        "submissions": submissions
    }


@router.get("/course/{course_id}")
def get_course_report(
    course_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.FACULTY, UserRole.ADMIN]))
):
    """Get comprehensive report for a course"""
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    
    # Verify faculty access
    if current_user.role == UserRole.FACULTY:
        if course.instructor_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not authorized")
    
    # Get enrollments
    enrollments = db.query(Enrollment).filter(
        and_(Enrollment.course_id == course_id, Enrollment.status == EnrollmentStatus.ACTIVE)
    ).all()
    
    # Get assignments
    assignments = db.query(Assignment).filter(Assignment.course_id == course_id).all()
    
    # Get all submissions for this course
    submission_count = db.query(func.count(Submission.id)).join(
        Assignment
    ).filter(
        Assignment.course_id == course_id
    ).scalar()
    
    return {
        "course": {
            "id": course.id,
            "code": course.code,
            "name": course.name,
            "semester": course.semester,
            "year": course.year
        },
        "total_students": len(enrollments),
        "total_assignments": len(assignments),
        "total_submissions": submission_count,
        "students": [{"id": e.student.id, "name": e.student.full_name, "email": e.student.email} for e in enrollments],
        "assignments": assignments
    }


@router.get("/export/canvas/{course_id}")
def export_canvas_gradebook(
    course_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.FACULTY, UserRole.ADMIN]))
):
    """Export grades in Canvas-compatible CSV format"""
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    
    # Verify faculty access
    if current_user.role == UserRole.FACULTY:
        if course.instructor_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not authorized")
    
    # Get students and assignments
    enrollments = db.query(Enrollment).filter(
        and_(Enrollment.course_id == course_id, Enrollment.status == EnrollmentStatus.ACTIVE)
    ).all()
    
    assignments = db.query(Assignment).filter(
        and_(Assignment.course_id == course_id, Assignment.is_published == True)
    ).all()
    
    # Create CSV
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Header row
    header = ["Student", "ID", "SIS User ID", "SIS Login ID", "Section"]
    header.extend([a.title for a in assignments])
    writer.writerow(header)
    
    # Data rows
    for enrollment in enrollments:
        student = enrollment.user
        row = [
            student.full_name,
            str(student.id),
            student.student_id or "",
            student.email,
            course.section or ""
        ]
        
        # Get grades for each assignment
        for assignment in assignments:
            submission = db.query(Submission).filter(
                and_(
                    Submission.assignment_id == assignment.id,
                    Submission.student_id == student.id,
                    Submission.status == "graded"
                )
            ).order_by(Submission.submitted_at.desc()).first()
            
            if submission:
                row.append(str(round(submission.final_score, 2)))
            else:
                row.append("")
        
        writer.writerow(row)
    
    # Return CSV
    csv_data = output.getvalue()
    output.close()
    
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=grades_{course.code}.csv"}
    )
