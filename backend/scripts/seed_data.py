#!/usr/bin/env python3
"""
Seed database with initial data for Kriterion
"""
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from datetime import datetime, timedelta
from app.core.database import SessionLocal
from app.core.security import get_password_hash
from app.core.config import settings

# Import all models
from app.models import (
    User, UserRole,
    Course, CourseStatus, Enrollment, EnrollmentStatus,
    Assignment, AssignmentStatus, DifficultyLevel, TestCase,
    Rubric, RubricCategory, RubricItem,
    Language, DEFAULT_LANGUAGES,
    Achievement, Skill, StudentProgress,
    DEFAULT_ACHIEVEMENTS, DEFAULT_SKILLS,
    NotificationSettings, UserPreferences
)


def seed_database():
    """Seed database with initial data"""
    db = SessionLocal()
    
    try:
        print("🌱 Seeding database...")
        
        # ========== 1. Create Languages ==========
        print("\n📝 Creating programming languages...")
        allowed_lang_keys = {
            "name", "display_name", "version", "file_extension",
            "compile_command", "run_command", "docker_image",
            "default_timeout_seconds", "default_memory_mb", "is_active"
        }
        for lang_data in DEFAULT_LANGUAGES:
            lang = db.query(Language).filter(Language.name == lang_data["name"]).first()
            if not lang:
                filtered = {k: v for k, v in lang_data.items() if k in allowed_lang_keys}
                lang = Language(**filtered)
                db.add(lang)
                print(f"  ✅ Created language: {filtered.get('display_name', lang_data['name'])}")
            else:
                print(f"  ℹ️  Language already exists: {lang_data['display_name']}")
        db.commit()
        
        # Get Python language for assignments
        python_lang = db.query(Language).filter(Language.name == "python").first()
        
        # (Removed) System settings seeding – no SystemSettings model in current schema
        
        # ========== 3. Create Achievements ==========
        print("\n🏆 Creating achievements...")
        for ach_data in DEFAULT_ACHIEVEMENTS:
            ach = db.query(Achievement).filter(Achievement.name == ach_data["name"]).first()
            if not ach:
                ach = Achievement(**ach_data)
                db.add(ach)
                print(f"  ✅ Created achievement: {ach_data['title']}")
        db.commit()
        
        # ========== 4. Create Skills ==========
        print("\n💡 Creating skills...")
        for skill_data in DEFAULT_SKILLS:
            skill = db.query(Skill).filter(Skill.name == skill_data["name"]).first()
            if not skill:
                skill = Skill(**skill_data)
                db.add(skill)
        db.commit()
        print("  ✅ Skills created")
        
        # ========== 5. Create Admin User ==========
        print("\n👤 Creating users...")
        admin = db.query(User).filter(User.email == settings.INITIAL_ADMIN_EMAIL).first()
        if not admin:
            admin = User(
                email=settings.INITIAL_ADMIN_EMAIL,
                hashed_password=get_password_hash(settings.INITIAL_ADMIN_PASSWORD),
                full_name="System Administrator",
                role=UserRole.ADMIN,
                is_active=True,
                is_verified=True
            )
            db.add(admin)
            db.commit()
            print(f"  ✅ Created admin: {admin.email}")
        else:
            print(f"  ℹ️  Admin already exists: {admin.email}")
        
        # ========== 6. Create Faculty User ==========
        faculty = db.query(User).filter(User.email == "faculty@kriterion.edu").first()
        if not faculty:
            faculty = User(
                email="faculty@kriterion.edu",
                hashed_password=get_password_hash("Faculty@123"),
                full_name="Dr. Jane Smith",
                role=UserRole.FACULTY,
                is_active=True,
                is_verified=True
            )
            db.add(faculty)
            db.commit()
            print(f"  ✅ Created faculty: {faculty.email}")
            
            # Create notification settings and preferences for faculty
            faculty_notif = NotificationSettings(user_id=faculty.id)
            faculty_pref = UserPreferences(user_id=faculty.id)
            db.add(faculty_notif)
            db.add(faculty_pref)
            db.commit()
        else:
            print(f"  ℹ️  Faculty already exists: {faculty.email}")
        
        # ========== 7. Create Student Users ==========
        students = []
        for i in range(1, 6):
            email = f"student{i}@kriterion.edu"
            student = db.query(User).filter(User.email == email).first()
            if not student:
                student = User(
                    email=email,
                    hashed_password=get_password_hash(f"Student{i}@123"),
                    full_name=f"Student {i}",
                    role=UserRole.STUDENT,
                    student_id=f"S{1000 + i}",
                    is_active=True,
                    is_verified=True
                )
                db.add(student)
                db.commit()
                print(f"  ✅ Created student: {student.email}")
                
                # Create progress tracking
                progress = StudentProgress(student_id=student.id)
                db.add(progress)
                
                # Create notification settings and preferences
                notif = NotificationSettings(user_id=student.id)
                pref = UserPreferences(user_id=student.id)
                db.add(notif)
                db.add(pref)
                db.commit()
            else:
                print(f"  ℹ️  Student already exists: {student.email}")
            students.append(student)
        
        # ========== 8. Create Sample Course ==========
        print("\n📚 Creating courses...")
        course = db.query(Course).filter(Course.code == "CS101").first()
        if not course:
            course = Course(
                code="CS101",
                name="Introduction to Computer Science",
                description="Foundational course in computer science covering programming basics, data structures, and algorithms.",
                section="A",
                semester="Spring",
                year=2026,
                instructor_id=faculty.id,
                status=CourseStatus.ACTIVE,
                is_active=True,
                color="#862733"
            )
            db.add(course)
            db.commit()
            print(f"  ✅ Created course: {course.code} - {course.name}")
            
            # Enroll students
            for student in students:
                enrollment = Enrollment(
                    student_id=student.id,
                    course_id=course.id,
                    status=EnrollmentStatus.ACTIVE,
                    progress_percentage=0.0
                )
                db.add(enrollment)
            db.commit()
            print(f"  ✅ Enrolled {len(students)} students in {course.code}")
        else:
            print(f"  ℹ️  Course already exists: {course.code}")
        
        # ========== 9. Create Sample Assignment ==========
        print("\n📝 Creating assignments...")
        assignment = db.query(Assignment).filter(
            Assignment.course_id == course.id,
            Assignment.title == "Hello World"
        ).first()
        
        if not assignment:
            assignment = Assignment(
                course_id=course.id,
                title="Hello World",
                description="Write a simple Python program that prints 'Hello, World!' to the console.",
                instructions="""## Objective
Write a Python program that prints the greeting message.

## Requirements
1. Create a file named `main.py`
2. The program should print exactly: `Hello, World!`
3. Use the `print()` function

## Example Output
```
Hello, World!
```

## Submission
Submit your `main.py` file before the deadline.
""",
                language_id=python_lang.id if python_lang else 1,
                starter_code='# Write your code here\n\n',
                solution_code='print("Hello, World!")\n',
                max_score=100.0,
                passing_score=60.0,
                difficulty=DifficultyLevel.EASY,
                due_date=datetime.utcnow() + timedelta(days=7),
                allow_late=True,
                late_penalty_per_day=10.0,
                max_late_days=3,
                max_attempts=5,
                enable_plagiarism_check=True,
                plagiarism_threshold=30.0,
                enable_ai_detection=True,
                ai_detection_threshold=50.0,
                test_weight=70.0,
                rubric_weight=30.0,
                status=AssignmentStatus.PUBLISHED,
                is_published=True,
                published_at=datetime.utcnow()
            )
            db.add(assignment)
            db.commit()
            print(f"  ✅ Created assignment: {assignment.title}")
            
            # Create test cases
            test_cases = [
                TestCase(
                    assignment_id=assignment.id,
                    name="Basic Output Test",
                    description="Check if program outputs 'Hello, World!'",
                    input_data="",
                    expected_output="Hello, World!",
                    points=50.0,
                    is_hidden=False,
                    is_sample=True,
                    order=1
                ),
                TestCase(
                    assignment_id=assignment.id,
                    name="Exact Match Test",
                    description="Verify exact string match",
                    input_data="",
                    expected_output="Hello, World!",
                    points=30.0,
                    is_hidden=True,
                    is_sample=False,
                    order=2
                ),
                TestCase(
                    assignment_id=assignment.id,
                    name="No Extra Output",
                    description="Ensure no additional output",
                    input_data="",
                    expected_output="Hello, World!",
                    points=20.0,
                    is_hidden=True,
                    is_sample=False,
                    ignore_whitespace=True,
                    order=3
                )
            ]
            for tc in test_cases:
                db.add(tc)
            db.commit()
            print(f"  ✅ Created {len(test_cases)} test cases")
            
            # Create rubric
            rubric = Rubric(
                assignment_id=assignment.id,
                total_points=30.0
            )
            db.add(rubric)
            db.commit()
            
            # Create rubric categories and items
            category1 = RubricCategory(
                rubric_id=rubric.id,
                name="Code Quality",
                description="Code style and organization",
                weight=0.5,
                order=1
            )
            db.add(category1)
            db.commit()
            
            items1 = [
                RubricItem(category_id=category1.id, name="Proper indentation", max_points=5.0, order=1),
                RubricItem(category_id=category1.id, name="Meaningful variable names", max_points=5.0, order=2),
                RubricItem(category_id=category1.id, name="No unnecessary code", max_points=5.0, order=3)
            ]
            for item in items1:
                db.add(item)
            
            category2 = RubricCategory(
                rubric_id=rubric.id,
                name="Documentation",
                description="Code comments and documentation",
                weight=0.5,
                order=2
            )
            db.add(category2)
            db.commit()
            
            items2 = [
                RubricItem(category_id=category2.id, name="File header comment", max_points=5.0, order=1),
                RubricItem(category_id=category2.id, name="Inline comments where needed", max_points=5.0, order=2),
                RubricItem(category_id=category2.id, name="Clear code structure", max_points=5.0, order=3)
            ]
            for item in items2:
                db.add(item)
            db.commit()
            print("  ✅ Created rubric with categories")
        else:
            print(f"  ℹ️  Assignment already exists: {assignment.title}")
        
        print("\n" + "="*50)
        print("✨ Database seeding complete!")
        print("="*50)
        
        print("\n📋 Default Credentials:")
        print(f"   Admin: {settings.INITIAL_ADMIN_EMAIL} / {settings.INITIAL_ADMIN_PASSWORD}")
        print("   Faculty: faculty@kriterion.edu / Faculty@123")
        for i in range(1, 6):
            print(f"   Student {i}: student{i}@kriterion.edu / Student{i}@123")
        
        print("\n⚠️  Change these passwords in production!")
        
    except Exception as e:
        print(f"\n❌ Error seeding database: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_database()
