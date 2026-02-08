from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query, Body
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel, EmailStr

from app.api.deps import get_db, get_current_user, require_roles
from app.models import User, UserRole, Course, CourseStatus, Enrollment, EnrollmentStatus, Assignment, AuditLog
from app.schemas.course import Course as CourseSchema, CourseCreate, CourseUpdate, Enrollment as EnrollmentSchema

router = APIRouter()


# ============== Response Schemas ==============

class CourseWithStats(BaseModel):
    id: int
    code: str
    name: str
    description: Optional[str] = None
    section: Optional[str] = None
    semester: str
    year: int
    instructor_id: int
    is_active: bool
    status: str
    students_count: int
    assignments_count: int
    created_at: str

    class Config:
        from_attributes = True


class EnrollByEmailRequest(BaseModel):
    email: EmailStr


class BulkEnrollRequest(BaseModel):
    emails: List[EmailStr]


class BulkEnrollResponse(BaseModel):
    enrolled: int
    failed: int
    errors: List[str]


class StudentInCourse(BaseModel):
    id: int
    email: str
    full_name: str
    student_id: Optional[str] = None
    enrolled_at: str
    status: str


@router.post("/", response_model=CourseSchema, status_code=status.HTTP_201_CREATED)
def create_course(
    course_in: CourseCreate,
    current_user: User = Depends(require_roles(UserRole.FACULTY, UserRole.ADMIN)),
    db: Session = Depends(get_db)
):
    """Create a new course (Faculty/Admin only)"""
    # Check if course code already exists
    existing = db.query(Course).filter(Course.code == course_in.code).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Course code already exists"
        )
    
    course = Course(
        **course_in.dict(),
        instructor_id=current_user.id
    )
    
    db.add(course)
    db.commit()
    db.refresh(course)
    
    # Audit log
    audit = AuditLog(
        user_id=current_user.id,
        event_type="course_created",
        description=f"Course {course.code} created"
    )
    db.add(audit)
    db.commit()
    
    return course


@router.get("/", response_model=List[CourseWithStats])
def list_courses(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 100
):
    """List courses based on user role with stats"""
    if current_user.role == UserRole.STUDENT:
        # Get enrolled courses
        enrollments = db.query(Enrollment).filter(
            Enrollment.student_id == current_user.id,
            Enrollment.status == EnrollmentStatus.ACTIVE
        ).all()
        course_ids = [e.course_id for e in enrollments]
        courses = db.query(Course).filter(Course.id.in_(course_ids)).offset(skip).limit(limit).all()
    elif current_user.role == UserRole.FACULTY:
        # Get courses taught by faculty
        courses = db.query(Course).filter(Course.instructor_id == current_user.id).offset(skip).limit(limit).all()
    else:
        # Admin sees all courses
        courses = db.query(Course).offset(skip).limit(limit).all()
    
    # Build response with stats
    result = []
    for course in courses:
        # Count students
        students_count = db.query(func.count(Enrollment.id)).filter(
            Enrollment.course_id == course.id,
            Enrollment.status == EnrollmentStatus.ACTIVE
        ).scalar() or 0
        
        # Count assignments
        assignments_count = db.query(func.count(Assignment.id)).filter(
            Assignment.course_id == course.id
        ).scalar() or 0
        
        result.append(CourseWithStats(
            id=course.id,
            code=course.code,
            name=course.name,
            description=course.description,
            section=course.section,
            semester=course.semester,
            year=course.year,
            instructor_id=course.instructor_id,
            is_active=course.is_active,
            status=course.status.value if hasattr(course.status, 'value') else str(course.status),
            students_count=students_count,
            assignments_count=assignments_count,
            created_at=course.created_at.isoformat()
        ))
    
    return result


@router.get("/{course_id}")
def get_course(
    course_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get course details"""
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Course not found"
        )
    
    # Check access
    if current_user.role == UserRole.STUDENT:
        enrollment = db.query(Enrollment).filter(
            Enrollment.student_id == current_user.id,
            Enrollment.course_id == course_id,
            Enrollment.status == EnrollmentStatus.ACTIVE
        ).first()
        if not enrollment:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not enrolled in this course"
            )
    elif current_user.role == UserRole.FACULTY and course.instructor_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access this course"
        )
    
    # Calculate counts
    students_count = db.query(Enrollment).filter(
        Enrollment.course_id == course_id,
        Enrollment.status == EnrollmentStatus.ACTIVE
    ).count()
    
    assignments_count = db.query(Assignment).filter(
        Assignment.course_id == course_id
    ).count()
    
    # Build response dict
    return {
        'id': course.id,
        'code': course.code,
        'name': course.name,
        'description': course.description,
        'section': course.section,
        'semester': course.semester,
        'year': course.year,
        'instructor_id': course.instructor_id,
        'status': course.status.value if hasattr(course.status, 'value') else str(course.status),
        'is_active': course.is_active,
        'allow_late_submissions': course.allow_late_submissions,
        'default_late_penalty': course.default_late_penalty,
        'created_at': course.created_at,
        'updated_at': course.updated_at,
        'students_count': students_count,
        'assignments_count': assignments_count,
    }


@router.patch("/{course_id}", response_model=CourseSchema)
def update_course(
    course_id: int,
    course_update: CourseUpdate,
    current_user: User = Depends(require_roles(UserRole.FACULTY, UserRole.ADMIN)),
    db: Session = Depends(get_db)
):
    """Update course (Faculty/Admin only)"""
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Course not found"
        )
    
    # Check authorization
    if current_user.role == UserRole.FACULTY and course.instructor_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to update this course"
        )
    
    # Update fields
    update_data = course_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(course, field, value)
    
    db.commit()
    db.refresh(course)
    
    # Audit log
    audit = AuditLog(
        user_id=current_user.id,
        event_type="course_updated",
        description=f"Course {course.code} updated"
    )
    db.add(audit)
    db.commit()
    
    return course


@router.delete("/{course_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_course(
    course_id: int,
    current_user: User = Depends(require_roles(UserRole.FACULTY, UserRole.ADMIN)),
    db: Session = Depends(get_db)
):
    """Delete a course (Admin or owning Faculty)"""
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Course not found"
        )

    # Only admin or the faculty who owns the course may delete
    if current_user.role == UserRole.FACULTY and course.instructor_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to delete this course"
        )

    # Audit before deletion
    audit = AuditLog(
        user_id=current_user.id,
        event_type="course_deleted",
        description=f"Course {course.code} deleted"
    )
    db.add(audit)

    # Remove course (cascades depend on DB schema)
    db.delete(course)
    db.commit()

    return None
@router.post("/{course_id}/enroll", response_model=EnrollmentSchema)
def enroll_student(
    course_id: int,
    student_id: int,
    current_user: User = Depends(require_roles(UserRole.FACULTY, UserRole.ADMIN)),
    db: Session = Depends(get_db)
):
    """Enroll a student in a course"""
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Course not found"
        )
    
    student = db.query(User).filter(User.id == student_id, User.role == UserRole.STUDENT).first()
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student not found"
        )
    
    # Check if already enrolled
    existing = db.query(Enrollment).filter(
        Enrollment.student_id == student_id,
        Enrollment.course_id == course_id
    ).first()
    
    if existing:
        if existing.status == EnrollmentStatus.ACTIVE:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Student already enrolled"
            )
        else:
            # Reactivate enrollment
            existing.status = EnrollmentStatus.ACTIVE
            db.commit()
            return existing
    
    enrollment = Enrollment(
        student_id=student_id,
        course_id=course_id,
        status=EnrollmentStatus.ACTIVE
    )
    
    db.add(enrollment)
    db.commit()
    db.refresh(enrollment)
    
    # Audit log
    audit = AuditLog(
        user_id=current_user.id,
        event_type="student_enrolled",
        description=f"Student {student.email} enrolled in {course.code}"
    )
    db.add(audit)
    db.commit()
    
    return enrollment


@router.post("/{course_id}/enroll-by-email")
def enroll_student_by_email(
    course_id: int,
    request: EnrollByEmailRequest,
    current_user: User = Depends(require_roles(UserRole.FACULTY, UserRole.ADMIN)),
    db: Session = Depends(get_db)
):
    """Enroll a student by email address"""
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Course not found"
        )
    
    # Check authorization for faculty
    if current_user.role == UserRole.FACULTY and course.instructor_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to enroll students in this course"
        )
    
    # Find student by email
    student = db.query(User).filter(
        User.email == request.email,
        User.role == UserRole.STUDENT
    ).first()
    
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Student with email {request.email} not found"
        )
    
    # Check if already enrolled
    existing = db.query(Enrollment).filter(
        Enrollment.student_id == student.id,
        Enrollment.course_id == course_id
    ).first()
    
    if existing:
        if existing.status == EnrollmentStatus.ACTIVE:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Student already enrolled"
            )
        else:
            existing.status = EnrollmentStatus.ACTIVE
            db.commit()
            return {"message": "Student re-enrolled successfully", "student_id": student.id}
    
    enrollment = Enrollment(
        student_id=student.id,
        course_id=course_id,
        status=EnrollmentStatus.ACTIVE
    )
    
    db.add(enrollment)
    db.commit()
    
    # Audit log
    audit = AuditLog(
        user_id=current_user.id,
        event_type="student_enrolled",
        description=f"Student {student.email} enrolled in {course.code}"
    )
    db.add(audit)
    db.commit()
    
    return {"message": "Student enrolled successfully", "student_id": student.id}


@router.post("/{course_id}/bulk-enroll", response_model=BulkEnrollResponse)
def bulk_enroll_students(
    course_id: int,
    request: BulkEnrollRequest,
    current_user: User = Depends(require_roles(UserRole.FACULTY, UserRole.ADMIN)),
    db: Session = Depends(get_db)
):
    """Bulk enroll students by email addresses"""
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Course not found"
        )
    
    # Check authorization for faculty
    if current_user.role == UserRole.FACULTY and course.instructor_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to enroll students in this course"
        )
    
    enrolled = 0
    failed = 0
    errors = []
    
    for email in request.emails:
        try:
            # Find student by email
            student = db.query(User).filter(
                User.email == email,
                User.role == UserRole.STUDENT
            ).first()
            
            if not student:
                failed += 1
                errors.append(f"Student {email} not found")
                continue
            
            # Check if already enrolled
            existing = db.query(Enrollment).filter(
                Enrollment.student_id == student.id,
                Enrollment.course_id == course_id
            ).first()
            
            if existing:
                if existing.status == EnrollmentStatus.ACTIVE:
                    errors.append(f"{email} already enrolled")
                    continue
                else:
                    existing.status = EnrollmentStatus.ACTIVE
                    enrolled += 1
                    continue
            
            # Create enrollment
            enrollment = Enrollment(
                student_id=student.id,
                course_id=course_id,
                status=EnrollmentStatus.ACTIVE
            )
            db.add(enrollment)
            enrolled += 1
            
        except Exception as e:
            failed += 1
            errors.append(f"Error enrolling {email}: {str(e)}")
    
    db.commit()
    
    # Audit log
    audit = AuditLog(
        user_id=current_user.id,
        event_type="bulk_enrollment",
        description=f"Bulk enrolled {enrolled} students in {course.code}"
    )
    db.add(audit)
    db.commit()
    
    return BulkEnrollResponse(enrolled=enrolled, failed=failed, errors=errors)


@router.get("/{course_id}/students", response_model=List[StudentInCourse])
def get_course_students(
    course_id: int,
    current_user: User = Depends(require_roles(UserRole.FACULTY, UserRole.ADMIN)),
    db: Session = Depends(get_db)
):
    """Get list of students enrolled in a course"""
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Course not found"
        )
    
    # Check authorization for faculty
    if current_user.role == UserRole.FACULTY and course.instructor_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view students in this course"
        )
    
    enrollments = db.query(Enrollment).filter(
        Enrollment.course_id == course_id
    ).all()
    
    students = []
    for enrollment in enrollments:
        student = db.query(User).filter(User.id == enrollment.student_id).first()
        if student:
            students.append(StudentInCourse(
                id=student.id,
                email=student.email,
                full_name=student.full_name,
                student_id=student.student_id,
                enrolled_at=enrollment.enrolled_at.isoformat(),
                status=enrollment.status.value if hasattr(enrollment.status, 'value') else str(enrollment.status)
            ))
    
    return students


@router.delete("/{course_id}/students/{student_id}")
def unenroll_student(
    course_id: int,
    student_id: int,
    current_user: User = Depends(require_roles(UserRole.FACULTY, UserRole.ADMIN)),
    db: Session = Depends(get_db)
):
    """Remove a student from a course"""
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Course not found"
        )
    
    # Check authorization for faculty
    if current_user.role == UserRole.FACULTY and course.instructor_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to unenroll students from this course"
        )
    
    enrollment = db.query(Enrollment).filter(
        Enrollment.course_id == course_id,
        Enrollment.student_id == student_id
    ).first()
    
    if not enrollment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student not enrolled in this course"
        )
    
    enrollment.status = EnrollmentStatus.DROPPED
    db.commit()
    
    # Audit log
    student = db.query(User).filter(User.id == student_id).first()
    audit = AuditLog(
        user_id=current_user.id,
        event_type="student_unenrolled",
        description=f"Student {student.email if student else student_id} unenrolled from {course.code}"
    )
    db.add(audit)
    db.commit()
    
    return {"message": "Student unenrolled successfully"}
