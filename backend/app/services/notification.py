"""
Notification Service - Creates notifications when events occur
Decoupled from other services for modularity
"""
from datetime import datetime
from typing import Optional
from sqlalchemy.orm import Session
from app.models.notification import Notification, NotificationType
from app.models import Enrollment, EnrollmentStatus, CourseAssistant
from app.core.logging import logger


def create_notification(
    db: Session,
    user_id: int,
    notification_type: NotificationType,
    title: str,
    message: str,
    link: Optional[str] = None,
    course_id: Optional[int] = None,
    assignment_id: Optional[int] = None,
    submission_id: Optional[int] = None,
) -> Notification:
    """Create a single notification"""
    notification = Notification(
        user_id=user_id,
        type=notification_type,
        title=title,
        message=message,
        link=link,
        course_id=course_id,
        assignment_id=assignment_id,
        submission_id=submission_id,
        is_read=False,
    )
    db.add(notification)
    return notification


def notify_course_students_assignment_posted(
    db: Session,
    course_id: int,
    assignment_id: int,
    assignment_title: str,
    course_code: str,
) -> int:
    """Create assignment posted notifications for all students in course"""
    try:
        enrollments = (
            db.query(Enrollment)
            .filter(
                Enrollment.course_id == course_id,
                Enrollment.status == EnrollmentStatus.ACTIVE,
            )
            .all()
        )

        count = 0
        for enrollment in enrollments:
            create_notification(
                db=db,
                user_id=enrollment.student_id,
                notification_type=NotificationType.ASSIGNMENT_NEW,
                title=f"New assignment posted in {course_code}",
                message=(
                    f"A new assignment, '{assignment_title}', has been posted in {course_code}."
                ),
                link=f"/student/assignments/{assignment_id}",
                course_id=course_id,
                assignment_id=assignment_id,
            )
            count += 1

        db.flush()  # Flush to prepare for commit
        logger.info(f"Created {count} assignment posted notifications for course {course_id}")
        return count

    except Exception as e:
        logger.error(f"Failed to create assignment notifications: {str(e)}")
        raise


def notify_course_assistants_assignment_posted(
    db: Session,
    course_id: int,
    assignment_id: int,
    assignment_title: str,
    course_code: str,
) -> int:
    """Create assignment posted notifications for all assistants assigned to course"""
    try:
        course_assistants = (
            db.query(CourseAssistant)
            .filter(CourseAssistant.course_id == course_id)
            .all()
        )

        count = 0
        for ca in course_assistants:
            create_notification(
                db=db,
                user_id=ca.assistant_id,
                notification_type=NotificationType.ASSIGNMENT_NEW,
                title=f"New assignment to grade in {course_code}",
                message=f"'{assignment_title}' was published in {course_code}.",
                link=f"/assistant/courses/{course_id}/assignments",
                course_id=course_id,
                assignment_id=assignment_id,
            )
            count += 1

        db.flush()  # Flush to prepare for commit
        logger.info(f"Created {count} assignment posted notifications for assistants in course {course_id}")
        return count

    except Exception as e:
        logger.error(f"Failed to create assignment notifications for assistants: {str(e)}")
        raise


def notify_faculty_submission_received(
    db: Session,
    course_id: int,
    assignment_id: int,
    student_name: str,
    course_code: str,
    faculty_id: int,
) -> Optional[Notification]:
    """Create submission received notification for faculty"""
    try:
        notification = create_notification(
            db=db,
            user_id=faculty_id,
            notification_type=NotificationType.NEW_SUBMISSION_RECEIVED,
            title=f"New submission in {course_code}",
            message=f"{student_name} submitted assignment #{assignment_id} in {course_code}.",
            link=f"/faculty/courses/{course_id}",
            course_id=course_id,
            assignment_id=assignment_id,
        )
        logger.info(f"Created submission notification for faculty {faculty_id}")
        return notification

    except Exception as e:
        logger.error(f"Failed to create submission notification: {str(e)}")
        return None


def notify_student_grade_posted(
    db: Session,
    student_id: int,
    course_code: str,
    assignment_title: str,
    score: float,
    max_score: float,
    course_id: int,
    assignment_id: int,
) -> Optional[Notification]:
    """Create grade posted notification for student"""
    try:
        percentage = (score / max_score * 100) if max_score > 0 else 0
        notification = create_notification(
            db=db,
            user_id=student_id,
            notification_type=NotificationType.GRADE_POSTED,
            title=f"Grade posted: {assignment_title}",
            message=f"Your grade for '{assignment_title}' in {course_code}: {score}/{max_score} ({percentage:.1f}%).",
            link=f"/student/grades",
            course_id=course_id,
            assignment_id=assignment_id,
        )
        logger.info(f"Created grade notification for student {student_id}")
        return notification

    except Exception as e:
        logger.error(f"Failed to create grade notification: {str(e)}")
        return None
