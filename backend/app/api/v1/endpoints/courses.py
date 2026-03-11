from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Query, Body
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_, or_
from sqlalchemy import func
from pydantic import BaseModel, EmailStr

from app.api.deps import get_db, get_current_user, require_roles
from app.models import User, UserRole, Course, CourseStatus, CourseAssistant, Enrollment, EnrollmentStatus, Assignment, TestCase, AuditLog
from app.models import NotificationType
from app.services.email import send_student_add_request_to_admin, send_bulk_student_add_request_to_admin
from app.services.notifications import create_notification, notify_users, get_active_student_ids_for_course, get_assistant_ids_for_course
from app.schemas.course import Course as CourseSchema, CourseCreate, CourseUpdate, Enrollment as EnrollmentSchema
from app.schemas.assignment import Assignment as AssignmentSchema

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
    instructor_name: Optional[str] = None
    instructor_email: Optional[str] = None
    is_active: bool
    status: str
    students_count: int
    assignments_count: int
    created_at: str
    color: Optional[str] = None

    class Config:
        from_attributes = True


class EnrollByEmailRequest(BaseModel):
    email: EmailStr


class AddAssistantRequest(BaseModel):
    email: EmailStr


class BulkEnrollRequest(BaseModel):
    emails: List[EmailStr]


class BulkEnrollResponse(BaseModel):
    enrolled: int
    failed: int
    errors: List[str]
    not_found: List[str] = []
    already_enrolled: List[str] = []


class StudentInCourse(BaseModel):
    id: int
    email: str
    full_name: str
    student_id: Optional[str] = None
    enrolled_at: str
    status: str
    current_grade: Optional[float] = None


@router.post("/", response_model=CourseSchema, status_code=status.HTTP_201_CREATED)
def create_course(
    course_in: CourseCreate,
    current_user: User = Depends(require_roles(UserRole.FACULTY, UserRole.ADMIN)),
    db: Session = Depends(get_db)
):
    """Create a new course. Faculty creates for themselves; Admin can assign instructor."""
    # Check if course code already exists
    existing = db.query(Course).filter(Course.code == course_in.code).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Course code already exists"
        )
    
    course_data = course_in.model_dump()
    course_data.setdefault('section', None)

    # Remove instructor_id from payload - we set it explicitly
    instructor_id = course_data.pop('instructor_id', None)
    if not instructor_id:
        instructor_id = current_user.id

    # Status: draft, published (active), or archived
    status_val = course_data.pop('status', 'draft')
    if status_val == 'active':
        status = CourseStatus.ACTIVE
        is_active = True
    elif status_val == 'archived':
        status = CourseStatus.ARCHIVED
        is_active = False
    else:
        status = CourseStatus.DRAFT
        is_active = False

    course = Course(
        **course_data,
        instructor_id=instructor_id,
        status=status,
        is_active=is_active,
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
    elif current_user.role == UserRole.ASSISTANT:
        # Get courses where user is assigned as assistant
        ca_list = db.query(CourseAssistant).filter(CourseAssistant.assistant_id == current_user.id).all()
        course_ids = [ca.course_id for ca in ca_list]
        courses = db.query(Course).filter(Course.id.in_(course_ids)).offset(skip).limit(limit).all() if course_ids else []
    else:
        # Admin sees all courses
        courses = db.query(Course).offset(skip).limit(limit).all()
    
    # Build response with stats
    result = []
    for course in courses:
        # Count students
        students_count = db.query(Enrollment).filter(
            Enrollment.course_id == course.id,
            Enrollment.status == EnrollmentStatus.ACTIVE
        ).count()
        
        # Count assignments
        assignments_count = db.query(Assignment).filter(
            Assignment.course_id == course.id
        ).count()
        
        result.append(CourseWithStats(
            id=course.id,
            code=course.code,
            name=course.name,
            description=course.description,
            section=course.section,
            semester=course.semester,
            year=course.year,
            instructor_id=course.instructor_id,
            instructor_name=None,
            instructor_email=None,
            is_active=course.is_active,
            status=course.status.value if hasattr(course.status, 'value') else str(course.status),
            students_count=students_count,
            assignments_count=assignments_count,
            created_at=course.created_at.isoformat(),
            color=course.color,
        ))
    
    return result


@router.get("/{course_id}", response_model=CourseWithStats)
def get_course(
    course_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get course details"""
    course = db.query(Course).options(joinedload(Course.instructor)).filter(Course.id == course_id).first()
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
    elif current_user.role == UserRole.ASSISTANT:
        ca = db.query(CourseAssistant).filter(
            CourseAssistant.course_id == course_id,
            CourseAssistant.assistant_id == current_user.id
        ).first()
        if not ca:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not assigned as assistant for this course"
            )
    
    # Calculate counts
    students_count = db.query(Enrollment).filter(
        Enrollment.course_id == course_id,
        Enrollment.status == EnrollmentStatus.ACTIVE
    ).with_entities(func.count(Enrollment.id)).scalar() or 0
    
    assignments_count = db.query(Assignment).filter(
        Assignment.course_id == course_id
    ).with_entities(func.count(Assignment.id)).scalar() or 0
    
    # Build response
    return CourseWithStats(
        id=course.id,
        code=course.code,
        name=course.name,
        description=course.description,
        section=course.section,
        semester=course.semester,
        year=course.year,
        instructor_id=course.instructor_id,
        instructor_name=course.instructor.full_name if course.instructor else None,
        instructor_email=course.instructor.email if course.instructor else None,
        is_active=course.is_active,
        status=course.status.value if hasattr(course.status, 'value') else str(course.status),
        students_count=students_count,
        assignments_count=assignments_count,
        created_at=course.created_at.isoformat(),
        color=course.color,
    )


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
    
    old_status = course.status.value if hasattr(course.status, "value") else str(course.status)

    # Update fields
    update_data = course_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(course, field, value)
    
    db.commit()
    db.refresh(course)

    new_status = course.status.value if hasattr(course.status, "value") else str(course.status)
    if old_status != "archived" and new_status == "archived":
        recipient_ids = set(get_active_student_ids_for_course(db, course.id) + get_assistant_ids_for_course(db, course.id))
        if recipient_ids:
            notify_users(
                db,
                user_ids=recipient_ids,
                notification_type=NotificationType.ASSIGNMENT_DUE,
                title=f"Course archived: {course.code}",
                message=f"{course.code} - {course.name} has been archived. Contact your instructor if you need access details.",
                course_id=course.id,
            )
    
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
    current_user: User = Depends(require_roles(UserRole.ADMIN)),
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
            create_notification(
                db,
                user_id=student.id,
                notification_type=NotificationType.ASSIGNMENT_NEW,
                title=f"Enrolled in {course.code}",
                message=f"You were enrolled in {course.code} - {course.name}.",
                course_id=course.id,
            )
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
    create_notification(
        db,
        user_id=student.id,
        notification_type=NotificationType.ASSIGNMENT_NEW,
        title=f"Enrolled in {course.code}",
        message=f"You were enrolled in {course.code} - {course.name}.",
        course_id=course.id,
    )
    db.commit()
    
    return enrollment


class AssistantInCourse(BaseModel):
    id: int
    email: str
    full_name: Optional[str] = None
    assigned_at: str


@router.get("/{course_id}/assistants", response_model=List[AssistantInCourse])
def list_course_assistants(
    course_id: int,
    current_user: User = Depends(require_roles(UserRole.FACULTY, UserRole.ADMIN)),
    db: Session = Depends(get_db)
):
    """List grading assistants assigned to a course"""
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")
    if current_user.role == UserRole.FACULTY and course.instructor_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    cas = db.query(CourseAssistant).filter(CourseAssistant.course_id == course_id).all()
    result = []
    for ca in cas:
        u = db.query(User).filter(User.id == ca.assistant_id).first()
        if u:
            result.append(AssistantInCourse(
                id=u.id,
                email=u.email,
                full_name=u.full_name,
                assigned_at=ca.assigned_at.isoformat(),
            ))
    return result


@router.post("/{course_id}/assistants")
def add_course_assistant(
    course_id: int,
    request: AddAssistantRequest,
    current_user: User = Depends(require_roles(UserRole.FACULTY, UserRole.ADMIN)),
    db: Session = Depends(get_db)
):
    """Add a grading assistant to a course (Faculty/Admin only)"""
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Course not found"
        )
    
    if current_user.role == UserRole.FACULTY and course.instructor_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to manage assistants for this course"
        )
    
    assistant = db.query(User).filter(
        User.email == request.email,
        User.role == UserRole.ASSISTANT
    ).first()
    
    if not assistant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with email {request.email} not found or is not an assistant"
        )
    
    existing = db.query(CourseAssistant).filter(
        CourseAssistant.course_id == course_id,
        CourseAssistant.assistant_id == assistant.id
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Assistant already assigned to this course"
        )
    
    ca = CourseAssistant(course_id=course_id, assistant_id=assistant.id)
    db.add(ca)
    db.commit()
    
    audit = AuditLog(
        user_id=current_user.id,
        event_type="assistant_added",
        description=f"Assistant {assistant.email} added to course {course.code}"
    )
    db.add(audit)
    create_notification(
        db,
        user_id=assistant.id,
        notification_type=NotificationType.ASSIGNMENT_NEW,
        title=f"Assigned as assistant: {course.code}",
        message=f"You were assigned as a grading assistant for {course.code} - {course.name}.",
        course_id=course.id,
    )
    db.commit()
    
    return {"message": "Assistant added successfully", "assistant_id": assistant.id}


@router.delete("/{course_id}/assistants/{assistant_id}")
def remove_course_assistant(
    course_id: int,
    assistant_id: int,
    current_user: User = Depends(require_roles(UserRole.FACULTY, UserRole.ADMIN)),
    db: Session = Depends(get_db)
):
    """Remove a grading assistant from a course"""
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Course not found"
        )
    
    if current_user.role == UserRole.FACULTY and course.instructor_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to manage assistants for this course"
        )
    
    ca = db.query(CourseAssistant).filter(
        CourseAssistant.course_id == course_id,
        CourseAssistant.assistant_id == assistant_id
    ).first()
    
    if not ca:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assistant not assigned to this course"
        )
    
    db.delete(ca)
    db.commit()
    
    assistant = db.query(User).filter(User.id == assistant_id).first()
    audit = AuditLog(
        user_id=current_user.id,
        event_type="assistant_removed",
        description=f"Assistant {assistant.email if assistant else assistant_id} removed from course {course.code}"
    )
    db.add(audit)
    if assistant:
        create_notification(
            db,
            user_id=assistant.id,
            notification_type=NotificationType.ASSIGNMENT_DUE,
            title=f"Assistant role removed: {course.code}",
            message=f"You were removed as a grading assistant from {course.code}.",
            course_id=course.id,
        )
    db.commit()
    
    return {"message": "Assistant removed successfully"}


@router.post("/{course_id}/enroll-by-email")
def enroll_student_by_email(
    course_id: int,
    request: EnrollByEmailRequest,
    current_user: User = Depends(require_roles(UserRole.FACULTY, UserRole.ADMIN)),
    db: Session = Depends(get_db)
):
    """Enroll a student by email address. If student not in system, notifies admin."""
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

    # Find student by email (normalize to lowercase for lookup)
    email_lower = request.email.strip().lower()
    student = db.query(User).filter(
        User.email == email_lower,
        User.role == UserRole.STUDENT
    ).first()

    if not student:
        # Record request and notify admin
        audit = AuditLog(
            user_id=current_user.id,
            event_type="student_add_requested",
            description=f"Faculty requested to add student {email_lower} for {course.code}. Student not in system."
        )
        db.add(audit)
        db.commit()

        admin_notified = send_student_add_request_to_admin(
            student_email=email_lower,
            course_code=course.code,
            course_name=course.name,
            faculty_name=current_user.full_name or current_user.email,
            faculty_email=current_user.email,
        )
        return {
            "enrolled": False,
            "student_not_found": True,
            "message": "Student is not in the system. Request has been sent to the admin to add this student." if admin_notified else "Student is not in the system. Request has been logged. Admin will be notified.",
            "admin_notified": admin_notified,
        }

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
            create_notification(
                db,
                user_id=student.id,
                notification_type=NotificationType.ASSIGNMENT_NEW,
                title=f"Enrolled in {course.code}",
                message=f"You were enrolled in {course.code} - {course.name}.",
                course_id=course.id,
            )
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
    create_notification(
        db,
        user_id=student.id,
        notification_type=NotificationType.ASSIGNMENT_NEW,
        title=f"Enrolled in {course.code}",
        message=f"You were enrolled in {course.code} - {course.name}.",
        course_id=course.id,
    )
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
    not_found: List[str] = []
    already_enrolled_list: List[str] = []
    notified_student_ids: List[int] = []

    for email in request.emails:
        email_clean = email.strip().lower()
        try:
            # Find student by email (normalize)
            student = db.query(User).filter(
                User.email == email_clean,
                User.role == UserRole.STUDENT
            ).first()

            if not student:
                failed += 1
                not_found.append(email_clean)
                errors.append(f"{email_clean}: not in system")
                continue

            # Check if already enrolled
            existing = db.query(Enrollment).filter(
                Enrollment.student_id == student.id,
                Enrollment.course_id == course_id
            ).first()

            if existing:
                if existing.status == EnrollmentStatus.ACTIVE:
                    already_enrolled_list.append(email_clean)
                    errors.append(f"{email_clean}: already enrolled")
                    continue
                else:
                    existing.status = EnrollmentStatus.ACTIVE
                    enrolled += 1
                    notified_student_ids.append(student.id)
                    continue

            # Create enrollment
            enrollment = Enrollment(
                student_id=student.id,
                course_id=course_id,
                status=EnrollmentStatus.ACTIVE
            )
            db.add(enrollment)
            enrolled += 1
            notified_student_ids.append(student.id)

        except Exception as e:
            failed += 1
            errors.append(f"{email_clean}: {str(e)}")
    
    db.commit()

    # Notify admin about students not in system
    if not_found:
        send_bulk_student_add_request_to_admin(
            not_found_emails=not_found,
            course_code=course.code,
            course_name=course.name,
            faculty_name=current_user.full_name or current_user.email,
            faculty_email=current_user.email,
        )

    # Audit log
    audit = AuditLog(
        user_id=current_user.id,
        event_type="bulk_enrollment",
        description=f"Bulk enrolled {enrolled} students in {course.code}"
    )
    db.add(audit)
    if notified_student_ids:
        notify_users(
            db,
            user_ids=notified_student_ids,
            notification_type=NotificationType.ASSIGNMENT_NEW,
            title=f"Enrolled in {course.code}",
            message=f"You were added to {course.code} - {course.name}.",
            course_id=course.id,
        )
    db.commit()

    return BulkEnrollResponse(
        enrolled=enrolled,
        failed=failed,
        errors=errors,
        not_found=not_found,
        already_enrolled=already_enrolled_list,
    )


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
                status=enrollment.status.value if hasattr(enrollment.status, 'value') else str(enrollment.status),
                current_grade=enrollment.current_grade,
            ))
    
    return students


@router.get("/{course_id}/assignments", response_model=List[AssignmentSchema])
def get_course_assignments(
    course_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    include_unpublished: bool = False
):
    """Get all assignments for a course with test cases eager-loaded"""
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
    elif current_user.role == UserRole.ASSISTANT:
        ca = db.query(CourseAssistant).filter(
            CourseAssistant.course_id == course_id,
            CourseAssistant.assistant_id == current_user.id
        ).first()
        if not ca:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not assigned as assistant for this course"
            )
    
    # Query assignments with test_cases eager-loaded to avoid lazy loading issues
    query = db.query(Assignment).options(
        joinedload(Assignment.test_cases),
        joinedload(Assignment.course)
    ).filter(Assignment.course_id == course_id)

    # Students only see published assignments
    if current_user.role == UserRole.STUDENT or not include_unpublished:
        query = query.filter(Assignment.is_published == True)
    elif status and status != "all":
        now = datetime.utcnow()
        if status == "published":
            query = query.filter(
                and_(Assignment.is_published == True, or_(Assignment.due_date.is_(None), Assignment.due_date >= now))
            )
        elif status == "draft":
            query = query.filter(Assignment.is_published == False)
        elif status == "closed":
            query = query.filter(and_(Assignment.is_published == True, Assignment.due_date < now))

    assignments = query.order_by(Assignment.due_date).all()
    
    return assignments


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
