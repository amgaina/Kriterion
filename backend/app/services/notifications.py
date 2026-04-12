from typing import Iterable, List, Optional, Set

from sqlalchemy.orm import Session

from app.models import (
    Notification,
    NotificationType,
    Enrollment,
    EnrollmentStatus,
    CourseAssistant,
)


def create_notification(
    db: Session,
    *,
    user_id: int,
    notification_type: NotificationType,
    title: str,
    message: str,
    link: Optional[str] = None,
    course_id: Optional[int] = None,
    assignment_id: Optional[int] = None,
    submission_id: Optional[int] = None,
) -> Notification:
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


def notify_users(
    db: Session,
    *,
    user_ids: Iterable[int],
    notification_type: NotificationType,
    title: str,
    message: str,
    link: Optional[str] = None,
    course_id: Optional[int] = None,
    assignment_id: Optional[int] = None,
    submission_id: Optional[int] = None,
) -> int:
    unique_ids: Set[int] = {uid for uid in user_ids if uid}
    for uid in unique_ids:
        create_notification(
            db,
            user_id=uid,
            notification_type=notification_type,
            title=title,
            message=message,
            link=link,
            course_id=course_id,
            assignment_id=assignment_id,
            submission_id=submission_id,
        )
    return len(unique_ids)


def get_active_student_ids_for_course(db: Session, course_id: int) -> List[int]:
    rows = (
        db.query(Enrollment.student_id)
        .filter(
            Enrollment.course_id == course_id,
            Enrollment.status == EnrollmentStatus.ACTIVE,
        )
        .all()
    )
    return [student_id for (student_id,) in rows]


def get_assistant_ids_for_course(db: Session, course_id: int) -> List[int]:
    rows = (
        db.query(CourseAssistant.assistant_id)
        .filter(CourseAssistant.course_id == course_id)
        .all()
    )
    return [assistant_id for (assistant_id,) in rows]
