"""
Faculty Endpoints - Course Management, Grading, Analytics
"""
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, Query, Body
from sqlalchemy.orm import Session
from sqlalchemy import and_, func, desc, case

from app.api.deps import get_db, get_current_user, require_role
from app.models import (
    User, UserRole, Course, CourseStatus, Enrollment, EnrollmentStatus,
    Assignment, AssignmentStatus, DifficultyLevel, TestCase,
    Submission, SubmissionStatus, TestResult,
    Rubric, RubricCategory, RubricItem, RubricScore,
    Group, GroupMembership, Announcement, AuditLog, Language
)
from app.core.logging import logger
from pydantic import BaseModel, Field

router = APIRouter()


# ============== Schemas ==============

class FacultyDashboardStats(BaseModel):
    total_courses: int
    total_students: int
    total_assignments: int
    pending_grading: int
    average_class_score: Optional[float]
    submissions_this_week: int
    flagged_submissions: int

class CourseDetailResponse(BaseModel):
    id: int
    code: str
    name: str
    description: Optional[str]
    section: Optional[str]
    semester: Optional[str]
    year: Optional[int]
    student_count: int
    assignment_count: int
    average_score: Optional[float]
    status: str
    is_active: bool

class StudentInCourse(BaseModel):
    id: int
    email: str
    full_name: str
    student_id: Optional[str]
    enrollment_status: str
    progress_percentage: float
    current_grade: Optional[float]
    submissions_count: int
    last_submission: Optional[datetime]

class AssignmentAnalytics(BaseModel):
    id: int
    title: str
    submissions_count: int
    graded_count: int
    pending_count: int
    average_score: Optional[float]
    highest_score: Optional[float]
    lowest_score: Optional[float]
    pass_rate: Optional[float]
    plagiarism_flags: int
    ai_flags: int

class SubmissionForGrading(BaseModel):
    id: int
    student_id: int
    student_name: str
    student_email: str
    submitted_at: datetime
    attempt_number: int
    status: str
    auto_score: Optional[float]
    final_score: Optional[float]
    plagiarism_flagged: bool
    ai_flagged: bool

class GradeSubmissionRequest(BaseModel):
    final_score: float = Field(..., ge=0, le=100)
    feedback: Optional[str] = None
    rubric_scores: Optional[Dict[int, float]] = None  # rubric_item_id: score

class TestCaseCreate(BaseModel):
    name: str
    description: Optional[str] = None
    input_data: Optional[str] = None
    expected_output: str
    points: float = 10.0
    is_hidden: bool = False
    is_sample: bool = False
    ignore_whitespace: bool = False
    use_regex: bool = False
    time_limit_seconds: Optional[int] = None
    order: int = 0

class BulkEnrollRequest(BaseModel):
    student_emails: List[str]

class AnnouncementCreate(BaseModel):
    title: str
    content: str
    is_pinned: bool = False


# ============== Dashboard ==============

@router.get("/dashboard", response_model=FacultyDashboardStats)
def get_faculty_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.FACULTY]))
):
    """Get faculty dashboard statistics"""
    # Get courses taught
    courses = db.query(Course).filter(Course.instructor_id == current_user.id).all()
    course_ids = [c.id for c in courses]
    
    total_courses = len(courses)
    
    # Count total students
    total_students = db.query(Enrollment).filter(
        Enrollment.course_id.in_(course_ids),
        Enrollment.status == EnrollmentStatus.ACTIVE
    ).count()
    
    # Count assignments
    total_assignments = db.query(Assignment).filter(
        Assignment.course_id.in_(course_ids)
    ).count()
    
    # Get assignment IDs for submissions query
    assignment_ids = [a.id for a in db.query(Assignment).filter(
        Assignment.course_id.in_(course_ids)
    ).all()]
    
    # Count pending grading
    pending_grading = db.query(Submission).filter(
        Submission.assignment_id.in_(assignment_ids),
        Submission.status.in_([SubmissionStatus.PENDING, SubmissionStatus.PROCESSING])
    ).count()
    
    # Calculate average class score
    avg_result = db.query(func.avg(Submission.final_score)).filter(
        Submission.assignment_id.in_(assignment_ids),
        Submission.final_score.isnot(None)
    ).scalar()
    average_class_score = float(avg_result) if avg_result else None
    
    # Submissions this week
    week_ago = datetime.utcnow() - timedelta(days=7)
    submissions_this_week = db.query(Submission).filter(
        Submission.assignment_id.in_(assignment_ids),
        Submission.submitted_at >= week_ago
    ).count()
    
    # Flagged submissions
    flagged_submissions = db.query(Submission).filter(
        Submission.assignment_id.in_(assignment_ids),
        (Submission.plagiarism_flagged == True) | (Submission.ai_flagged == True)
    ).count()
    
    return FacultyDashboardStats(
        total_courses=total_courses,
        total_students=total_students,
        total_assignments=total_assignments,
        pending_grading=pending_grading,
        average_class_score=average_class_score,
        submissions_this_week=submissions_this_week,
        flagged_submissions=flagged_submissions
    )


# ============== Course Management ==============

@router.get("/courses", response_model=List[CourseDetailResponse])
def get_faculty_courses(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.FACULTY]))
):
    """Get all courses taught by faculty"""
    courses = db.query(Course).filter(Course.instructor_id == current_user.id).all()
    
    result = []
    for course in courses:
        student_count = db.query(Enrollment).filter(
            Enrollment.course_id == course.id,
            Enrollment.status == EnrollmentStatus.ACTIVE
        ).count()
        
        assignment_count = db.query(Assignment).filter(
            Assignment.course_id == course.id
        ).count()
        
        # Calculate average score
        assignment_ids = [a.id for a in course.assignments]
        avg_score = None
        if assignment_ids:
            avg_result = db.query(func.avg(Submission.final_score)).filter(
                Submission.assignment_id.in_(assignment_ids),
                Submission.final_score.isnot(None)
            ).scalar()
            avg_score = float(avg_result) if avg_result else None
        
        result.append(CourseDetailResponse(
            id=course.id,
            code=course.code,
            name=course.name,
            description=course.description,
            section=course.section,
            semester=course.semester,
            year=course.year,
            student_count=student_count,
            assignment_count=assignment_count,
            average_score=avg_score,
            status=course.status.value if course.status else "ACTIVE",
            is_active=course.is_active
        ))
    
    return result


@router.get("/courses/{course_id}/students", response_model=List[StudentInCourse])
def get_course_students(
    course_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.FACULTY]))
):
    """Get all students enrolled in a course"""
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    
    if course.instructor_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    enrollments = db.query(Enrollment).filter(
        Enrollment.course_id == course_id
    ).all()
    
    # Get assignment IDs for this course
    assignment_ids = [a.id for a in course.assignments]
    
    result = []
    for enrollment in enrollments:
        student = enrollment.student
        
        # Count submissions
        submissions_count = db.query(Submission).filter(
            Submission.student_id == student.id,
            Submission.assignment_id.in_(assignment_ids)
        ).count() if assignment_ids else 0
        
        # Get last submission
        last_submission = db.query(Submission).filter(
            Submission.student_id == student.id,
            Submission.assignment_id.in_(assignment_ids)
        ).order_by(desc(Submission.submitted_at)).first() if assignment_ids else None
        
        result.append(StudentInCourse(
            id=student.id,
            email=student.email,
            full_name=student.full_name,
            student_id=student.student_id,
            enrollment_status=enrollment.status.value,
            progress_percentage=enrollment.progress_percentage or 0,
            current_grade=enrollment.current_grade,
            submissions_count=submissions_count,
            last_submission=last_submission.submitted_at if last_submission else None
        ))
    
    return result


@router.post("/courses/{course_id}/enroll", status_code=status.HTTP_201_CREATED)
def enroll_students(
    course_id: int,
    request: BulkEnrollRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.FACULTY]))
):
    """Enroll multiple students in a course"""
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    
    if course.instructor_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    enrolled = []
    not_found = []
    already_enrolled = []
    
    for email in request.student_emails:
        student = db.query(User).filter(
            User.email == email,
            User.role == UserRole.STUDENT
        ).first()
        
        if not student:
            not_found.append(email)
            continue
        
        existing = db.query(Enrollment).filter(
            Enrollment.student_id == student.id,
            Enrollment.course_id == course_id
        ).first()
        
        if existing:
            already_enrolled.append(email)
            continue
        
        enrollment = Enrollment(
            student_id=student.id,
            course_id=course_id,
            status=EnrollmentStatus.ACTIVE
        )
        db.add(enrollment)
        enrolled.append(email)
    
    db.commit()
    
    # Audit log
    audit = AuditLog(
        user_id=current_user.id,
        event_type="students_enrolled",
        description=f"Enrolled {len(enrolled)} students in {course.code}"
    )
    db.add(audit)
    db.commit()
    
    return {
        "enrolled": enrolled,
        "not_found": not_found,
        "already_enrolled": already_enrolled
    }


@router.delete("/courses/{course_id}/students/{student_id}")
def remove_student(
    course_id: int,
    student_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.FACULTY]))
):
    """Remove student from course"""
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course or course.instructor_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    enrollment = db.query(Enrollment).filter(
        Enrollment.student_id == student_id,
        Enrollment.course_id == course_id
    ).first()
    
    if not enrollment:
        raise HTTPException(status_code=404, detail="Enrollment not found")
    
    enrollment.status = EnrollmentStatus.DROPPED
    db.commit()
    
    return {"message": "Student removed from course"}


# ============== Assignment Management ==============

@router.get("/courses/{course_id}/assignments", response_model=List[AssignmentAnalytics])
def get_course_assignments(
    course_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.FACULTY]))
):
    """Get all assignments for a course with analytics"""
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course or course.instructor_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    assignments = db.query(Assignment).filter(
        Assignment.course_id == course_id
    ).order_by(Assignment.due_date.desc()).all()
    
    result = []
    for assignment in assignments:
        # Get submissions stats
        submissions = db.query(Submission).filter(
            Submission.assignment_id == assignment.id
        ).all()
        
        submissions_count = len(submissions)
        graded = [s for s in submissions if s.final_score is not None]
        graded_count = len(graded)
        pending_count = submissions_count - graded_count
        
        # Calculate scores
        scores = [s.final_score for s in graded if s.final_score is not None]
        average_score = sum(scores) / len(scores) if scores else None
        highest_score = max(scores) if scores else None
        lowest_score = min(scores) if scores else None
        
        # Pass rate (>= passing_score)
        passing = assignment.passing_score or 60
        pass_count = sum(1 for s in scores if s >= passing)
        pass_rate = (pass_count / len(scores) * 100) if scores else None
        
        # Flags
        plagiarism_flags = sum(1 for s in submissions if s.plagiarism_flagged)
        ai_flags = sum(1 for s in submissions if s.ai_flagged)
        
        result.append(AssignmentAnalytics(
            id=assignment.id,
            title=assignment.title,
            submissions_count=submissions_count,
            graded_count=graded_count,
            pending_count=pending_count,
            average_score=average_score,
            highest_score=highest_score,
            lowest_score=lowest_score,
            pass_rate=pass_rate,
            plagiarism_flags=plagiarism_flags,
            ai_flags=ai_flags
        ))
    
    return result


@router.post("/assignments/{assignment_id}/test-cases", status_code=status.HTTP_201_CREATED)
def create_test_case(
    assignment_id: int,
    test_case: TestCaseCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.FACULTY]))
):
    """Add a test case to an assignment"""
    assignment = db.query(Assignment).filter(Assignment.id == assignment_id).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    
    if assignment.course.instructor_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    new_test = TestCase(
        assignment_id=assignment_id,
        **test_case.model_dump()
    )
    db.add(new_test)
    db.commit()
    db.refresh(new_test)
    
    return {"id": new_test.id, "message": "Test case created"}


@router.get("/assignments/{assignment_id}/test-cases")
def get_test_cases(
    assignment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.FACULTY]))
):
    """Get all test cases for an assignment"""
    assignment = db.query(Assignment).filter(Assignment.id == assignment_id).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    
    if assignment.course.instructor_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    test_cases = db.query(TestCase).filter(
        TestCase.assignment_id == assignment_id
    ).order_by(TestCase.order).all()
    
    return [
        {
            "id": tc.id,
            "name": tc.name,
            "description": tc.description,
            "input_data": tc.input_data,
            "expected_output": tc.expected_output,
            "points": tc.points,
            "is_hidden": tc.is_hidden,
            "is_sample": tc.is_sample,
            "order": tc.order
        } for tc in test_cases
    ]


@router.delete("/test-cases/{test_case_id}")
def delete_test_case(
    test_case_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.FACULTY]))
):
    """Delete a test case"""
    test_case = db.query(TestCase).filter(TestCase.id == test_case_id).first()
    if not test_case:
        raise HTTPException(status_code=404, detail="Test case not found")
    
    if test_case.assignment.course.instructor_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    db.delete(test_case)
    db.commit()
    
    return {"message": "Test case deleted"}


# ============== Grading ==============

@router.get("/assignments/{assignment_id}/submissions", response_model=List[SubmissionForGrading])
def get_submissions_for_grading(
    assignment_id: int,
    status_filter: Optional[str] = None,
    flagged_only: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.FACULTY]))
):
    """Get all submissions for an assignment for grading"""
    assignment = db.query(Assignment).filter(Assignment.id == assignment_id).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    
    if assignment.course.instructor_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    query = db.query(Submission).filter(Submission.assignment_id == assignment_id)
    
    if status_filter:
        try:
            status_enum = SubmissionStatus(status_filter.upper())
            query = query.filter(Submission.status == status_enum)
        except ValueError:
            pass
    
    if flagged_only:
        query = query.filter(
            (Submission.plagiarism_flagged == True) | (Submission.ai_flagged == True)
        )
    
    submissions = query.order_by(desc(Submission.submitted_at)).all()
    
    return [
        SubmissionForGrading(
            id=s.id,
            student_id=s.student_id,
            student_name=s.student.full_name,
            student_email=s.student.email,
            submitted_at=s.submitted_at,
            attempt_number=s.attempt_number,
            status=s.status.value,
            auto_score=s.test_score,
            final_score=s.final_score,
            plagiarism_flagged=s.plagiarism_flagged or False,
            ai_flagged=s.ai_flagged or False
        ) for s in submissions
    ]


@router.post("/submissions/{submission_id}/grade")
def grade_submission(
    submission_id: int,
    grade_request: GradeSubmissionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.FACULTY]))
):
    """Grade a submission manually"""
    submission = db.query(Submission).filter(Submission.id == submission_id).first()
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    
    if submission.assignment.course.instructor_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Update submission
    submission.final_score = grade_request.final_score
    submission.feedback = grade_request.feedback
    submission.graded_by = current_user.id
    submission.graded_at = datetime.utcnow()
    submission.status = SubmissionStatus.GRADED
    
    # Save rubric scores if provided
    if grade_request.rubric_scores:
        for item_id, score in grade_request.rubric_scores.items():
            rubric_score = db.query(RubricScore).filter(
                RubricScore.submission_id == submission_id,
                RubricScore.rubric_item_id == item_id
            ).first()
            
            if rubric_score:
                rubric_score.score = score
                rubric_score.graded_by = current_user.id
            else:
                rubric_score = RubricScore(
                    submission_id=submission_id,
                    rubric_item_id=item_id,
                    score=score,
                    graded_by=current_user.id
                )
                db.add(rubric_score)
    
    db.commit()
    
    # Update student's course grade
    _update_student_grade(db, submission.student_id, submission.assignment.course_id)
    
    # Audit log
    audit = AuditLog(
        user_id=current_user.id,
        event_type="submission_graded",
        description=f"Graded submission {submission_id} with score {grade_request.final_score}"
    )
    db.add(audit)
    db.commit()
    
    return {"message": "Submission graded successfully", "score": grade_request.final_score}


@router.post("/submissions/{submission_id}/regrade")
async def regrade_submission(
    submission_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.FACULTY]))
):
    """Re-run auto-grading for a submission"""
    from app.services.grading import GradingService
    
    submission = db.query(Submission).filter(Submission.id == submission_id).first()
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    
    if submission.assignment.course.instructor_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Clear old test results
    db.query(TestResult).filter(TestResult.submission_id == submission_id).delete()
    db.commit()
    
    # Re-grade
    grading_service = GradingService(db)
    result = await grading_service.grade_submission(submission_id)
    
    return result


# ============== Announcements ==============

@router.post("/courses/{course_id}/announcements", status_code=status.HTTP_201_CREATED)
def create_announcement(
    course_id: int,
    announcement: AnnouncementCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.FACULTY]))
):
    """Create a course announcement"""
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course or course.instructor_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    new_announcement = Announcement(
        course_id=course_id,
        author_id=current_user.id,
        title=announcement.title,
        content=announcement.content,
        is_pinned=announcement.is_pinned
    )
    db.add(new_announcement)
    db.commit()
    db.refresh(new_announcement)
    
    return {"id": new_announcement.id, "message": "Announcement created"}


@router.get("/courses/{course_id}/announcements")
def get_announcements(
    course_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.FACULTY]))
):
    """Get all announcements for a course"""
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course or course.instructor_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    announcements = db.query(Announcement).filter(
        Announcement.course_id == course_id
    ).order_by(desc(Announcement.is_pinned), desc(Announcement.created_at)).all()
    
    return [
        {
            "id": a.id,
            "title": a.title,
            "content": a.content,
            "is_pinned": a.is_pinned,
            "created_at": a.created_at
        } for a in announcements
    ]


# ============== Languages ==============

@router.get("/languages")
def get_available_languages(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.FACULTY]))
):
    """Get available programming languages"""
    languages = db.query(Language).filter(Language.is_active == True).all()
    
    return [
        {
            "id": lang.id,
            "name": lang.name,
            "display_name": lang.display_name,
            "version": lang.version,
            "file_extension": lang.file_extension
        } for lang in languages
    ]


# ============== Helper Functions ==============

def _update_student_grade(db: Session, student_id: int, course_id: int):
    """Update student's overall grade for a course"""
    # Get all assignments for the course
    assignments = db.query(Assignment).filter(Assignment.course_id == course_id).all()
    
    if not assignments:
        return
    
    # Get all graded submissions
    total_score = 0
    total_max = 0
    
    for assignment in assignments:
        submission = db.query(Submission).filter(
            Submission.student_id == student_id,
            Submission.assignment_id == assignment.id,
            Submission.final_score.isnot(None)
        ).order_by(desc(Submission.final_score)).first()
        
        if submission:
            total_score += submission.final_score
            total_max += (assignment.max_score or 100)
    
    if total_max > 0:
        grade = (total_score / total_max) * 100
        
        enrollment = db.query(Enrollment).filter(
            Enrollment.student_id == student_id,
            Enrollment.course_id == course_id
        ).first()
        
        if enrollment:
            enrollment.current_grade = grade
            enrollment.progress_percentage = (len([a for a in assignments if db.query(Submission).filter(
                Submission.student_id == student_id,
                Submission.assignment_id == a.id
            ).first()]) / len(assignments)) * 100
            db.commit()
