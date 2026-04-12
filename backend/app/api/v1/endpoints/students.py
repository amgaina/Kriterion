"""
Student Endpoints - Dashboard, Progress, Achievements, Skills
"""
from datetime import datetime, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import and_, func, desc

from app.api.deps import get_db, get_current_user
from app.models import (
    User, UserRole, Enrollment, EnrollmentStatus, Course,
    Assignment, AssignmentStatus, Submission, SubmissionStatus,
    StudentProgress, Achievement, StudentAchievement, Skill, StudentSkill,
    Notification, NotificationType
)
from app.core.logging import logger
from pydantic import BaseModel

router = APIRouter()


# ============== Schemas ==============

class DashboardStats(BaseModel):
    total_courses: int
    active_assignments: int
    completed_assignments: int
    pending_submissions: int
    average_grade: Optional[float]
    current_streak: int
    total_points: int
    level: int

class CourseProgress(BaseModel):
    course_id: int
    course_code: str
    course_name: str
    progress_percentage: float
    current_grade: Optional[float]
    assignments_total: int
    assignments_completed: int

class AssignmentOverview(BaseModel):
    id: int
    title: str
    course_code: str
    course_name: str
    due_date: Optional[datetime]
    status: str  # pending, submitted, graded, late
    score: Optional[float]
    max_score: float

class AchievementResponse(BaseModel):
    id: int
    name: str
    title: str
    description: str
    icon: Optional[str]
    points: int
    earned: bool
    earned_at: Optional[datetime]

class SkillResponse(BaseModel):
    id: int
    name: str
    display_name: str
    category: Optional[str]
    proficiency_level: int
    xp: int

class LeaderboardEntry(BaseModel):
    rank: int
    student_id: int
    student_name: str
    total_points: int
    level: int
    achievements_count: int

class NotificationResponse(BaseModel):
    id: int
    type: str
    title: str
    message: str
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True


# ============== Dashboard ==============

@router.get("/dashboard", response_model=DashboardStats)
def get_student_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get student dashboard statistics"""
    if current_user.role != UserRole.STUDENT:
        raise HTTPException(status_code=403, detail="Students only")
    
    # Get enrolled courses
    enrollments = db.query(Enrollment).filter(
        Enrollment.student_id == current_user.id,
        Enrollment.status == EnrollmentStatus.ACTIVE
    ).all()
    
    course_ids = [e.course_id for e in enrollments]
    total_courses = len(course_ids)
    
    # Get assignments for enrolled courses
    assignments = db.query(Assignment).filter(
        Assignment.course_id.in_(course_ids),
        Assignment.is_published == True
    ).all()
    
    # Count active (due in future) and past assignments
    now = datetime.utcnow()
    active_assignments = sum(1 for a in assignments if a.due_date and a.due_date > now)
    
    # Get submissions
    submissions = db.query(Submission).filter(
        Submission.student_id == current_user.id
    ).all()
    
    submitted_assignment_ids = {s.assignment_id for s in submissions}
    completed_assignments = len(submitted_assignment_ids)
    
    # Pending = published assignments not yet submitted
    assignment_ids = {a.id for a in assignments}
    pending_submissions = len(assignment_ids - submitted_assignment_ids)
    
    # Calculate average grade
    graded_submissions = [s for s in submissions if s.final_score is not None]
    average_grade = None
    if graded_submissions:
        average_grade = sum(s.final_score for s in graded_submissions) / len(graded_submissions)
    
    # Get progress stats
    progress = db.query(StudentProgress).filter(
        StudentProgress.student_id == current_user.id
    ).first()
    
    current_streak = progress.current_streak if progress else 0
    total_points = progress.total_points if progress else 0
    level = progress.level if progress else 1
    
    return DashboardStats(
        total_courses=total_courses,
        active_assignments=active_assignments,
        completed_assignments=completed_assignments,
        pending_submissions=pending_submissions,
        average_grade=average_grade,
        current_streak=current_streak,
        total_points=total_points,
        level=level
    )


# ============== Courses & Progress ==============

@router.get("/courses", response_model=List[CourseProgress])
def get_student_courses(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get student's enrolled courses with progress"""
    if current_user.role != UserRole.STUDENT:
        raise HTTPException(status_code=403, detail="Students only")
    
    enrollments = db.query(Enrollment).filter(
        Enrollment.student_id == current_user.id,
        Enrollment.status == EnrollmentStatus.ACTIVE
    ).all()
    
    result = []
    for enrollment in enrollments:
        course = enrollment.course
        
        # Count assignments
        assignments = db.query(Assignment).filter(
            Assignment.course_id == course.id,
            Assignment.is_published == True
        ).all()
        
        # Count completed (submitted) assignments
        submitted = db.query(Submission).filter(
            Submission.student_id == current_user.id,
            Submission.assignment_id.in_([a.id for a in assignments])
        ).count()
        
        result.append(CourseProgress(
            course_id=course.id,
            course_code=course.code,
            course_name=course.name,
            progress_percentage=enrollment.progress_percentage or 0,
            current_grade=enrollment.current_grade,
            assignments_total=len(assignments),
            assignments_completed=submitted
        ))
    
    return result


@router.get("/assignments", response_model=List[AssignmentOverview])
def get_student_assignments(
    status_filter: Optional[str] = Query(None, description="Filter: pending, submitted, graded, late"),
    course_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all assignments for student with submission status"""
    if current_user.role != UserRole.STUDENT:
        raise HTTPException(status_code=403, detail="Students only")
    
    # Get enrolled course IDs
    enrollments = db.query(Enrollment).filter(
        Enrollment.student_id == current_user.id,
        Enrollment.status == EnrollmentStatus.ACTIVE
    ).all()
    course_ids = [e.course_id for e in enrollments]
    
    if course_id:
        if course_id not in course_ids:
            raise HTTPException(status_code=403, detail="Not enrolled in this course")
        course_ids = [course_id]
    
    # Get assignments
    assignments = db.query(Assignment).filter(
        Assignment.course_id.in_(course_ids),
        Assignment.is_published == True
    ).order_by(Assignment.due_date.asc()).all()
    
    # Get submissions
    submissions = {
        s.assignment_id: s for s in db.query(Submission).filter(
            Submission.student_id == current_user.id,
            Submission.assignment_id.in_([a.id for a in assignments])
        ).all()
    }
    
    now = datetime.utcnow()
    result = []
    
    for assignment in assignments:
        submission = submissions.get(assignment.id)
        
        grades_visible = getattr(assignment, "grades_published", False)

        # Determine status
        if submission:
            if submission.final_score is not None and grades_visible:
                assign_status = "graded"
            else:
                assign_status = "submitted"
        elif assignment.due_date and assignment.due_date < now:
            assign_status = "late"
        else:
            assign_status = "pending"

        # Apply filter
        if status_filter and assign_status != status_filter:
            continue

        result.append(AssignmentOverview(
            id=assignment.id,
            title=assignment.title,
            course_code=assignment.course.code,
            course_name=assignment.course.name,
            due_date=assignment.due_date,
            status=assign_status,
            score=submission.final_score if submission and grades_visible else None,
            max_score=assignment.max_score or 100
        ))
    
    return result


# ============== Achievements & Skills ==============

@router.get("/achievements", response_model=List[AchievementResponse])
def get_student_achievements(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all achievements with earned status"""
    if current_user.role != UserRole.STUDENT:
        raise HTTPException(status_code=403, detail="Students only")
    
    # Get all achievements
    achievements = db.query(Achievement).filter(Achievement.is_active == True).all()
    
    # Get earned achievements
    earned = {
        sa.achievement_id: sa for sa in db.query(StudentAchievement).filter(
            StudentAchievement.student_id == current_user.id
        ).all()
    }
    
    result = []
    for achievement in achievements:
        student_ach = earned.get(achievement.id)
        result.append(AchievementResponse(
            id=achievement.id,
            name=achievement.name,
            title=achievement.title,
            description=achievement.description,
            icon=achievement.icon,
            points=achievement.points,
            earned=student_ach is not None,
            earned_at=student_ach.earned_at if student_ach else None
        ))
    
    return result


@router.get("/skills", response_model=List[SkillResponse])
def get_student_skills(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get student's skill levels"""
    if current_user.role != UserRole.STUDENT:
        raise HTTPException(status_code=403, detail="Students only")
    
    # Get all skills
    skills = db.query(Skill).filter(Skill.is_active == True).all()
    
    # Get student's skill levels
    student_skills = {
        ss.skill_id: ss for ss in db.query(StudentSkill).filter(
            StudentSkill.student_id == current_user.id
        ).all()
    }
    
    result = []
    for skill in skills:
        student_skill = student_skills.get(skill.id)
        result.append(SkillResponse(
            id=skill.id,
            name=skill.name,
            display_name=skill.display_name,
            category=skill.category,
            proficiency_level=student_skill.proficiency_level if student_skill else 0,
            xp=student_skill.xp if student_skill else 0
        ))
    
    return result


@router.get("/progress")
def get_student_progress(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get detailed student progress including streaks"""
    if current_user.role != UserRole.STUDENT:
        raise HTTPException(status_code=403, detail="Students only")
    
    progress = db.query(StudentProgress).filter(
        StudentProgress.student_id == current_user.id
    ).first()
    
    if not progress:
        # Create progress record if not exists
        progress = StudentProgress(student_id=current_user.id)
        db.add(progress)
        db.commit()
        db.refresh(progress)
    
    # Get achievement count
    achievement_count = db.query(StudentAchievement).filter(
        StudentAchievement.student_id == current_user.id
    ).count()
    
    return {
        "current_streak": progress.current_streak,
        "longest_streak": progress.longest_streak,
        "total_points": progress.total_points,
        "level": progress.level,
        "xp_to_next_level": progress.xp_to_next_level,
        "total_submissions": progress.total_submissions,
        "total_assignments_completed": progress.total_assignments_completed,
        "last_activity_date": progress.last_activity_date,
        "achievement_count": achievement_count
    }


# ============== Leaderboard ==============

@router.get("/leaderboard", response_model=List[LeaderboardEntry])
def get_leaderboard(
    course_id: Optional[int] = None,
    limit: int = Query(10, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get leaderboard - optionally filtered by course"""
    if current_user.role != UserRole.STUDENT:
        raise HTTPException(status_code=403, detail="Students only")
    
    # Base query for student progress
    query = db.query(
        StudentProgress,
        User,
        func.count(StudentAchievement.id).label('achievement_count')
    ).join(
        User, StudentProgress.student_id == User.id
    ).outerjoin(
        StudentAchievement, StudentProgress.student_id == StudentAchievement.student_id
    )
    
    if course_id:
        # Filter to students in specific course
        query = query.join(
            Enrollment, User.id == Enrollment.student_id
        ).filter(
            Enrollment.course_id == course_id,
            Enrollment.status == EnrollmentStatus.ACTIVE
        )
    
    query = query.group_by(
        StudentProgress.id, User.id
    ).order_by(
        desc(StudentProgress.total_points)
    ).limit(limit)
    
    results = query.all()
    
    leaderboard = []
    for rank, (progress, user, ach_count) in enumerate(results, 1):
        leaderboard.append(LeaderboardEntry(
            rank=rank,
            student_id=user.id,
            student_name=user.full_name,
            total_points=progress.total_points,
            level=progress.level,
            achievements_count=ach_count or 0
        ))
    
    return leaderboard


# ============== Notifications ==============

@router.get("/notifications", response_model=List[NotificationResponse])
def get_notifications(
    unread_only: bool = False,
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get user notifications"""
    query = db.query(Notification).filter(
        Notification.user_id == current_user.id
    )
    
    if unread_only:
        query = query.filter(Notification.is_read == False)
    
    notifications = query.order_by(desc(Notification.created_at)).limit(limit).all()
    
    return [
        NotificationResponse(
            id=n.id,
            type=n.type.value if isinstance(n.type, NotificationType) else n.type,
            title=n.title,
            message=n.message,
            is_read=n.is_read,
            created_at=n.created_at
        ) for n in notifications
    ]


@router.put("/notifications/{notification_id}/read")
def mark_notification_read(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Mark notification as read"""
    notification = db.query(Notification).filter(
        Notification.id == notification_id,
        Notification.user_id == current_user.id
    ).first()
    
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    notification.is_read = True
    notification.read_at = datetime.utcnow()
    db.commit()
    
    return {"message": "Notification marked as read"}


@router.put("/notifications/read-all")
def mark_all_notifications_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Mark all notifications as read"""
    db.query(Notification).filter(
        Notification.user_id == current_user.id,
        Notification.is_read == False
    ).update({
        "is_read": True,
        "read_at": datetime.utcnow()
    })
    db.commit()
    
    return {"message": "All notifications marked as read"}
