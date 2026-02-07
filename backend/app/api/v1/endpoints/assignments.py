from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import and_, inspect

from app.api.deps import get_db, get_current_user, require_role
from app.models import (
    User, UserRole, Assignment, Course, Enrollment, EnrollmentStatus,
    Rubric, RubricCategory, RubricItem, TestCase, AuditLog, Language
)
from app.schemas.assignment import (
    AssignmentCreate,
    AssignmentUpdate,
    Assignment as AssignmentSchema,
    AssignmentDetail,
    RubricCreate,
    RubricUpdate
)
from app.core.logging import logger

router = APIRouter()


@router.get("", response_model=List[AssignmentSchema])
def list_assignments(
    course_id: Optional[int] = None,
    published_only: bool = True,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List assignments - students see published only, faculty see all their course assignments"""
    query = db.query(Assignment)
    
    if course_id:
        query = query.filter(Assignment.course_id == course_id)
        
        # Verify student is enrolled or faculty owns course
        if current_user.role == UserRole.STUDENT:
            enrollment = db.query(Enrollment).filter(
                and_(
                    Enrollment.student_id == current_user.id,
                    Enrollment.course_id == course_id,
                    Enrollment.status == EnrollmentStatus.ACTIVE
                )
            ).first()
            if not enrollment:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Not enrolled in this course"
                )
    
    # Students only see published assignments from enrolled courses
    if current_user.role == UserRole.STUDENT:
        if published_only:
            query = query.filter(Assignment.is_published == True)
        
        # Filter by enrolled courses
        enrolled_course_ids = [e.course_id for e in current_user.enrollments if e.status == EnrollmentStatus.ACTIVE]
        query = query.filter(Assignment.course_id.in_(enrolled_course_ids))
    
    assignments = query.all()
    return assignments


@router.get("/{assignment_id}", response_model=AssignmentDetail)
def get_assignment(
    assignment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get assignment details including rubric and test cases"""
    assignment = db.query(Assignment).filter(Assignment.id == assignment_id).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    
    # Check access
    if current_user.role == UserRole.STUDENT:
        enrollment = db.query(Enrollment).filter(
            and_(
                Enrollment.student_id == current_user.id,
                Enrollment.course_id == assignment.course_id,
                Enrollment.status == EnrollmentStatus.ACTIVE
            )
        ).first()
        if not enrollment or not assignment.is_published:
            raise HTTPException(status_code=403, detail="Access denied")
    
    return assignment


@router.post("", response_model=AssignmentSchema, status_code=status.HTTP_201_CREATED)
def create_assignment(
    assignment_in: AssignmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.FACULTY, UserRole.ADMIN]))
):
    """Create a new assignment (faculty only)"""
    try:
        # Verify course ownership
        course = db.query(Course).filter(Course.id == assignment_in.course_id).first()
        if not course:
            raise HTTPException(status_code=404, detail="Course not found")
        
        if current_user.role == UserRole.FACULTY and course.instructor_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not authorized for this course")
        
        # Verify language exists
        language_obj = db.query(Language).filter(Language.id == assignment_in.language_id).first()
        if not language_obj:
            raise HTTPException(status_code=422, detail="Language not found")

        # Introspect the 'assignments' table to get actual column names
        inspector = inspect(db.bind)
        available_columns = {c['name'] for c in inspector.get_columns('assignments')}

        # Prepare assignment data from the input schema
        assignment_data_in = assignment_in.model_dump(exclude={"rubric", "test_suites"})
        
        # Filter the data to only include columns that exist in the database table
        assignment_data = {
            key: value for key, value in assignment_data_in.items() if key in available_columns
        }
        
        if 'difficulty' in assignment_data:
            assignment_data['difficulty'] = str(assignment_data['difficulty']).upper()

        # Create assignment
        assignment = Assignment(
            **assignment_data,
            created_at=datetime.utcnow()
        )
        
        db.add(assignment)
        db.flush()  # Get assignment.id
        
        # Create default rubric if provided
        if assignment_in.rubric:
            rubric_data = assignment_in.rubric
            rubric = Rubric(
                assignment_id=assignment.id,
                total_points=rubric_data.total_points
            )
            db.add(rubric)
            db.flush()
            
            # Create categories and items
            for cat_data in rubric_data.categories:
                category = RubricCategory(
                    rubric_id=rubric.id,
                    name=cat_data.name,
                    weight=cat_data.weight,
                    order=cat_data.order
                )
                db.add(category)
                db.flush()
                
                for item_data in cat_data.items:
                    item = RubricItem(
                        category_id=category.id,
                        name=item_data.name,
                        max_points=item_data.max_points,
                        description=item_data.description,
                        order=item_data.order
                    )
                    db.add(item)
        
        db.commit()
        db.refresh(assignment)
        
        # Audit log
        audit = AuditLog(
            user_id=current_user.id,
            event_type="assignment_created",
            description=f"Assignment '{assignment.title}' created",
            created_at=datetime.utcnow()
        )
        db.add(audit)
        db.commit()
        
        logger.info(f"Assignment {assignment.id} created by user {current_user.id}")
        return assignment
    
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error creating assignment: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500, 
            detail=f"Failed to create assignment: {str(e)}"
        )


@router.put("/{assignment_id}", response_model=AssignmentSchema)
def update_assignment(
    assignment_id: int,
    assignment_in: AssignmentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.FACULTY, UserRole.ADMIN]))
):
    """Update an assignment"""
    assignment = db.query(Assignment).filter(Assignment.id == assignment_id).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    
    # Check ownership
    if current_user.role == UserRole.FACULTY and assignment.course.instructor_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Introspect the 'assignments' table to get actual column names
    inspector = inspect(db.bind)
    available_columns = {c['name'] for c in inspector.get_columns('assignments')}

    # Update fields
    update_data_in = assignment_in.model_dump(exclude_unset=True)
    
    # Filter to only include columns that exist in the database
    update_data = {
        key: value for key, value in update_data_in.items() if key in available_columns
    }
    
    if "difficulty" in update_data and isinstance(update_data["difficulty"], str):
        update_data["difficulty"] = update_data["difficulty"].upper()
        
    for field, value in update_data.items():
        setattr(assignment, field, value)
    
    assignment.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(assignment)
    
    # Audit log
    audit = AuditLog(
        user_id=current_user.id,
        event_type="assignment_updated",
        description=f"Assignment '{assignment.title}' updated",
        created_at=datetime.utcnow()
    )
    db.add(audit)
    db.commit()
    
    return assignment


@router.delete("/{assignment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_assignment(
    assignment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.FACULTY, UserRole.ADMIN]))
):
    """Delete an assignment"""
    assignment = db.query(Assignment).filter(Assignment.id == assignment_id).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    
    # Check ownership
    if current_user.role == UserRole.FACULTY and assignment.course.instructor_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Audit log before deletion
    audit = AuditLog(
        user_id=current_user.id,
        event_type="assignment_deleted",
        description=f"Assignment '{assignment.title}' deleted",
        created_at=datetime.utcnow()
    )
    db.add(audit)
    
    db.delete(assignment)
    db.commit()
    
    return None


@router.post("/{assignment_id}/publish")
def publish_assignment(
    assignment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.FACULTY, UserRole.ADMIN]))
):
    """Publish an assignment to make it visible to students"""
    assignment = db.query(Assignment).filter(Assignment.id == assignment_id).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    
    # Check ownership
    if current_user.role == UserRole.FACULTY and assignment.course.instructor_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    assignment.is_published = True
    assignment.updated_at = datetime.utcnow()
    db.commit()
    
    # Audit log
    audit = AuditLog(
        user_id=current_user.id,
        event_type="assignment_published",
        description=f"Assignment '{assignment.title}' published",
        created_at=datetime.utcnow()
    )
    db.add(audit)
    db.commit()
    
    return {"message": "Assignment published successfully"}


@router.post("/{assignment_id}/unpublish")
def unpublish_assignment(
    assignment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.FACULTY, UserRole.ADMIN]))
):
    """Unpublish an assignment"""
    assignment = db.query(Assignment).filter(Assignment.id == assignment_id).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    
    # Check ownership
    if current_user.role == UserRole.FACULTY and assignment.course.instructor_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    assignment.is_published = False
    assignment.updated_at = datetime.utcnow()
    db.commit()
    
    # Audit log
    audit = AuditLog(
        user_id=current_user.id,
        event_type="assignment_unpublished",
        description=f"Assignment '{assignment.title}' unpublished",
        created_at=datetime.utcnow()
    )
    db.add(audit)
    db.commit()
    
    return {"message": "Assignment unpublished successfully"}
