#!/usr/bin/env python3
"""
Seed database with realistic data for Kriterion @ ULM.

Usage:
    docker-compose exec backend python scripts/seed_data.py
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from datetime import datetime, timedelta
from app.core.database import SessionLocal
from app.core.security import get_password_hash
from app.core.config import settings
from app.models import (
    User,
    UserRole,
    Course,
    CourseStatus,
    CourseAssistant,
    Enrollment,
    EnrollmentStatus,
    Assignment,
    TestCase,
    Rubric,
    RubricItem,
    Language,
    DEFAULT_LANGUAGES,
    Achievement,
    Skill,
    StudentProgress,
    DEFAULT_ACHIEVEMENTS,
    DEFAULT_SKILLS,
    NotificationSettings,
    UserPreferences,
    FacultyLanguagePermission,
)

# ──────────────────────────────────────────────
# Seed data definitions
# ──────────────────────────────────────────────

ADMIN_USERS = [
    {
        "email": "admin@ulm.edu",
        "password": "Admin@123456",
        "full_name": "System Administrator",
    },
]

FACULTY_USERS = [
    {
        "email": "jsmith@ulm.edu",
        "password": "Faculty@123",
        "full_name": "Dr. Jane Smith",
    },
    {
        "email": "mwilson@ulm.edu",
        "password": "Faculty@123",
        "full_name": "Dr. Mark Wilson",
    },
]

ASSISTANT_USERS = [
    {
        "email": "assistant@ulm.edu",
        "password": "Assistant@123",
        "full_name": "Grading Assistant",
        "assistant_courses": ["CS1010", "CS2010"],
    },
]

STUDENT_USERS = [
    {"email": "aamgain@warhawks.ulm.edu",   "password": "Student@123", "full_name": "Abhishek Amgain",  "student_id": "S10001"},
    {"email": "amainali@warhawks.ulm.edu",   "password": "Student@123", "full_name": "Aryan Mainali",    "student_id": "S10002"},
    {"email": "sdhakal@warhawks.ulm.edu",    "password": "Student@123", "full_name": "Sulav Dhakal",     "student_id": "S10003"},
    {"email": "ntulachan@warhawks.ulm.edu",  "password": "Student@123", "full_name": "Niraj Tulachan",   "student_id": "S10004"},
    {"email": "jdoe@warhawks.ulm.edu",       "password": "Student@123", "full_name": "John Doe",         "student_id": "S10005"},
    {"email": "agarcia@warhawks.ulm.edu",    "password": "Student@123", "full_name": "Ana Garcia",       "student_id": "S10006"},
    {"email": "blee@warhawks.ulm.edu",       "password": "Student@123", "full_name": "Brian Lee",        "student_id": "S10007"},
    {"email": "cjohnson@warhawks.ulm.edu",   "password": "Student@123", "full_name": "Claire Johnson",   "student_id": "S10008"},
]

COURSES = [
    {
        "code": "CS1010",
        "name": "Computer Science I",
        "description": "Introduction to programming using Python. Covers variables, control structures, functions, and basic data structures.",
        "section": "A",
        "semester": "Spring",
        "year": 2026,
        "start_date": datetime(2026, 1, 12),
        "end_date": datetime(2026, 5, 8),
        "faculty_email": "jsmith@ulm.edu",
        "color": "#862733",
        "languages": ["python"],
    },
    {
        "code": "CS2010",
        "name": "Computer Science II",
        "description": "Continuation of CS I. Object-oriented programming, recursion, sorting algorithms, and linked lists using Java.",
        "section": "A",
        "semester": "Spring",
        "year": 2026,
        "start_date": datetime(2026, 1, 12),
        "end_date": datetime(2026, 5, 8),
        "faculty_email": "jsmith@ulm.edu",
        "color": "#1E40AF",
        "languages": ["java", "python"],
    },
    {
        "code": "CS3030",
        "name": "Data Structures & Algorithms",
        "description": "Trees, graphs, heaps, hash tables, and algorithm analysis. Implementations in Python and Java.",
        "section": "B",
        "semester": "Spring",
        "year": 2026,
        "start_date": datetime(2026, 1, 12),
        "end_date": datetime(2026, 5, 8),
        "faculty_email": "mwilson@ulm.edu",
        "color": "#065F46",
        "languages": ["python", "java"],
    },
]

# Which students enroll in which courses (by student email → list of course codes)
ENROLLMENTS = {
    "aamgain@warhawks.ulm.edu":   ["CS1010", "CS2010", "CS3030"],
    "amainali@warhawks.ulm.edu":  ["CS1010", "CS2010", "CS3030"],
    "sdhakal@warhawks.ulm.edu":   ["CS1010", "CS2010"],
    "ntulachan@warhawks.ulm.edu": ["CS1010", "CS2010"],
    "jdoe@warhawks.ulm.edu":      ["CS1010"],
    "agarcia@warhawks.ulm.edu":   ["CS1010", "CS3030"],
    "blee@warhawks.ulm.edu":      ["CS2010", "CS3030"],
    "cjohnson@warhawks.ulm.edu":  ["CS1010", "CS2010"],
}

ASSIGNMENTS = [
    # ── CS1010 ──
    {
        "course_code": "CS1010",
        "title": "Hello World",
        "description": "Write a Python program that prints 'Hello, World!' to the console.",
        "instructions": (
            "## Objective\n"
            "Write a Python program that prints a greeting message.\n\n"
            "## Requirements\n"
            "1. Create a file named `main.py`\n"
            "2. Print exactly: `Hello, World!`\n\n"
            "## Submission\n"
            "Submit your `main.py` file before the deadline."
        ),
        "language": "python",
        "starter_code": "# Write your code here\n\n",
        "solution_code": 'print("Hello, World!")\n',
        "max_score": 100.0,
        "passing_score": 60.0,
        "due_days": 7,
        "test_cases": [
            {"name": "Basic Output", "input_data": "", "expected_output": "Hello, World!", "points": 50.0, "is_hidden": False, "order": 1},
            {"name": "Exact Match", "input_data": "", "expected_output": "Hello, World!", "points": 30.0, "is_hidden": True, "order": 2},
            {"name": "No Extra Output", "input_data": "", "expected_output": "Hello, World!", "points": 20.0, "is_hidden": True, "ignore_whitespace": True, "order": 3},
        ],
        "rubric_categories": [
            {
                "name": "Code Quality",
                "description": "Code style and organization",
                "weight": 0.6,
                "items": [
                    {"name": "Proper indentation", "max_points": 5.0},
                    {"name": "No unnecessary code", "max_points": 5.0},
                ],
            },
            {
                "name": "Documentation",
                "description": "Comments and readability",
                "weight": 0.4,
                "items": [
                    {"name": "File header comment", "max_points": 5.0},
                    {"name": "Clear code structure", "max_points": 5.0},
                ],
            },
        ],
    },
    {
        "course_code": "CS1010",
        "title": "Fibonacci Sequence",
        "description": "Write a function that returns the nth Fibonacci number using iteration.",
        "instructions": (
            "## Objective\n"
            "Implement `fibonacci(n)` that returns the nth Fibonacci number.\n\n"
            "## Input\n"
            "A single integer `n` read from stdin.\n\n"
            "## Output\n"
            "Print the nth Fibonacci number.\n\n"
            "## Examples\n"
            "- Input: `0` → Output: `0`\n"
            "- Input: `5` → Output: `5`\n"
            "- Input: `10` → Output: `55`\n"
        ),
        "language": "python",
        "starter_code": "def fibonacci(n):\n    # Your code here\n    pass\n\nn = int(input())\nprint(fibonacci(n))\n",
        "solution_code": "def fibonacci(n):\n    if n <= 1:\n        return n\n    a, b = 0, 1\n    for _ in range(2, n + 1):\n        a, b = b, a + b\n    return b\n\nn = int(input())\nprint(fibonacci(n))\n",
        "max_score": 100.0,
        "passing_score": 60.0,
        "due_days": 14,
        "test_cases": [
            {"name": "fib(0)", "input_data": "0", "expected_output": "0", "points": 20.0, "is_hidden": False, "order": 1},
            {"name": "fib(1)", "input_data": "1", "expected_output": "1", "points": 20.0, "is_hidden": False, "order": 2},
            {"name": "fib(5)", "input_data": "5", "expected_output": "5", "points": 20.0, "is_hidden": True, "order": 3},
            {"name": "fib(10)", "input_data": "10", "expected_output": "55", "points": 20.0, "is_hidden": True, "order": 4},
            {"name": "fib(20)", "input_data": "20", "expected_output": "6765", "points": 20.0, "is_hidden": True, "order": 5},
        ],
        "rubric_categories": [
            {
                "name": "Correctness",
                "description": "Does the algorithm work for all cases?",
                "weight": 0.7,
                "items": [
                    {"name": "Handles base cases", "max_points": 10.0},
                    {"name": "Iterative approach (no stack overflow)", "max_points": 10.0},
                ],
            },
            {
                "name": "Style",
                "description": "Code readability",
                "weight": 0.3,
                "items": [
                    {"name": "Meaningful variable names", "max_points": 5.0},
                    {"name": "Clean loop structure", "max_points": 5.0},
                ],
            },
        ],
    },
    # ── CS2010 ──
    {
        "course_code": "CS2010",
        "title": "Stack Implementation",
        "description": "Implement a Stack class in Java with push, pop, peek, and isEmpty operations.",
        "instructions": (
            "## Objective\n"
            "Create a `Stack` class that uses an array internally.\n\n"
            "## Requirements\n"
            "- `push(int val)` - adds to top\n"
            "- `pop()` - removes and returns top\n"
            "- `peek()` - returns top without removing\n"
            "- `isEmpty()` - returns boolean\n\n"
            "## Input\n"
            "Read commands from stdin, one per line: `push X`, `pop`, `peek`, `isEmpty`.\n"
            "Print the result of each command that returns a value.\n"
        ),
        "language": "java",
        "starter_code": "import java.util.Scanner;\n\npublic class Main {\n    // Implement your Stack here\n\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        // Read commands and operate\n    }\n}\n",
        "solution_code": "",
        "max_score": 100.0,
        "passing_score": 60.0,
        "due_days": 14,
        "test_cases": [
            {"name": "Push & Peek", "input_data": "push 10\npeek\n", "expected_output": "10", "points": 25.0, "is_hidden": False, "order": 1},
            {"name": "Push & Pop", "input_data": "push 5\npush 10\npop\n", "expected_output": "10", "points": 25.0, "is_hidden": False, "order": 2},
            {"name": "isEmpty true", "input_data": "isEmpty\n", "expected_output": "true", "points": 25.0, "is_hidden": True, "order": 3},
            {"name": "Mixed ops", "input_data": "push 1\npush 2\npush 3\npop\npeek\n", "expected_output": "3\n2", "points": 25.0, "is_hidden": True, "order": 4},
        ],
        "rubric_categories": [
            {
                "name": "Implementation",
                "description": "Correct data structure implementation",
                "weight": 0.7,
                "items": [
                    {"name": "Array-backed storage", "max_points": 10.0},
                    {"name": "All four methods implemented", "max_points": 10.0},
                    {"name": "Edge case handling (empty stack)", "max_points": 10.0},
                ],
            },
            {
                "name": "Code Quality",
                "description": "Style and documentation",
                "weight": 0.3,
                "items": [
                    {"name": "Proper encapsulation", "max_points": 5.0},
                    {"name": "Comments and naming", "max_points": 5.0},
                ],
            },
        ],
    },
    # ── CS3030 ──
    # Removed legacy C++ seeded assignment; only Python and Java are supported.
]


# ──────────────────────────────────────────────
# Seed logic
# ──────────────────────────────────────────────

def _get_or_create_user(db, email, password, full_name, role, student_id=None):
    user = db.query(User).filter(User.email == email).first()
    if user:
        print(f"  [exists] {email}")
        return user
    user = User(
        email=email,
        hashed_password=get_password_hash(password),
        full_name=full_name,
        role=role,
        student_id=student_id,
        is_active=True,
        is_verified=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    print(f"  + {role.value}: {email}")
    return user


def seed_database():
    db = SessionLocal()

    try:
        print("=" * 56)
        print("  KRITERION - DATABASE SEED")
        print("=" * 56)

        # ── Languages ──
        print("\n[1/7] Languages")
        allowed_keys = {
            "name", "display_name", "file_extension",
            "compile_command", "run_command", "docker_image",
            "default_timeout_seconds", "default_memory_mb", "is_active",
        }
        for lang_data in DEFAULT_LANGUAGES:
            if not db.query(Language).filter(Language.name == lang_data["name"]).first():
                filtered = {k: v for k, v in lang_data.items() if k in allowed_keys}
                db.add(Language(**filtered))
                print(f"  + {filtered.get('display_name', lang_data['name'])}")
        db.commit()

        # ── Achievements & Skills ──
        print("\n[2/7] Achievements & Skills")
        for ach in DEFAULT_ACHIEVEMENTS:
            if not db.query(Achievement).filter(Achievement.name == ach["name"]).first():
                db.add(Achievement(**ach))
        for sk in DEFAULT_SKILLS:
            if not db.query(Skill).filter(Skill.name == sk["name"]).first():
                db.add(Skill(**sk))
        db.commit()
        print("  + seeded")

        # ── Admin Users ──
        print("\n[3/7] Admin Users")
        for u in ADMIN_USERS:
            _get_or_create_user(db, u["email"], u["password"], u["full_name"], UserRole.ADMIN)

        # ── Faculty Users ──
        print("\n[4/7] Faculty Users")
        faculty_map = {}
        for u in FACULTY_USERS:
            fac = _get_or_create_user(db, u["email"], u["password"], u["full_name"], UserRole.FACULTY)
            faculty_map[u["email"]] = fac
            if not db.query(NotificationSettings).filter(NotificationSettings.user_id == fac.id).first():
                db.add(NotificationSettings(user_id=fac.id))
                db.add(UserPreferences(user_id=fac.id))
                db.commit()

        # ── Assistant Users ──
        print("\n[4b/7] Assistant Users")
        assistant_map = {}
        for u in ASSISTANT_USERS:
            ast = _get_or_create_user(db, u["email"], u["password"], u["full_name"], UserRole.ASSISTANT)
            assistant_map[u["email"]] = ast
            if not db.query(NotificationSettings).filter(NotificationSettings.user_id == ast.id).first():
                db.add(NotificationSettings(user_id=ast.id))
                db.add(UserPreferences(user_id=ast.id))
            db.commit()

        # ── Student Users ──
        print("\n[5/7] Student Users")
        student_map = {}
        for u in STUDENT_USERS:
            stu = _get_or_create_user(db, u["email"], u["password"], u["full_name"], UserRole.STUDENT, u["student_id"])
            student_map[u["email"]] = stu
            if not db.query(StudentProgress).filter(StudentProgress.student_id == stu.id).first():
                db.add(StudentProgress(student_id=stu.id))
            if not db.query(NotificationSettings).filter(NotificationSettings.user_id == stu.id).first():
                db.add(NotificationSettings(user_id=stu.id))
                db.add(UserPreferences(user_id=stu.id))
            db.commit()

        # ── Courses + Enrollments + Language Permissions ──
        print("\n[6/7] Courses & Enrollments")
        course_map = {}
        for c in COURSES:
            course = db.query(Course).filter(Course.code == c["code"], Course.year == c["year"]).first()
            if not course:
                fac = faculty_map.get(c["faculty_email"])
                course = Course(
                    code=c["code"],
                    name=c["name"],
                    description=c["description"],
                    section=c["section"],
                    semester=c["semester"],
                    year=c["year"],
                    start_date=c.get("start_date"),
                    end_date=c.get("end_date"),
                    instructor_id=fac.id if fac else 1,
                    status=CourseStatus.ACTIVE,
                    is_active=True,
                    color=c.get("color"),
                )
                db.add(course)
                db.commit()
                db.refresh(course)
                print(f"  + Course: {course.code} - {course.name}")

                # Grant language permissions to the faculty for this course's languages
                for lang_name in c.get("languages", []):
                    lang = db.query(Language).filter(Language.name == lang_name).first()
                    if lang and fac:
                        exists = db.query(FacultyLanguagePermission).filter(
                            FacultyLanguagePermission.faculty_id == fac.id,
                            FacultyLanguagePermission.language_id == lang.id,
                        ).first()
                        if not exists:
                            db.add(FacultyLanguagePermission(faculty_id=fac.id, language_id=lang.id))
                db.commit()
            else:
                print(f"  [exists] {c['code']}")
            course_map[c["code"]] = course

        # Enrollments
        for stu_email, codes in ENROLLMENTS.items():
            stu = student_map.get(stu_email)
            if not stu:
                continue
            for code in codes:
                crs = course_map.get(code)
                if not crs:
                    continue
                if not db.query(Enrollment).filter(
                    Enrollment.student_id == stu.id, Enrollment.course_id == crs.id
                ).first():
                    db.add(Enrollment(
                        student_id=stu.id,
                        course_id=crs.id,
                        status=EnrollmentStatus.ACTIVE,
                        progress_percentage=0.0,
                    ))
        db.commit()
        print("  + Enrollments created")

        # Course Assistants (assign assistants to courses)
        for u in ASSISTANT_USERS:
            ast = assistant_map.get(u["email"])
            if not ast:
                continue
            for code in u.get("assistant_courses", []):
                crs = course_map.get(code)
                if not crs:
                    continue
                if not db.query(CourseAssistant).filter(
                    CourseAssistant.course_id == crs.id,
                    CourseAssistant.assistant_id == ast.id,
                ).first():
                    db.add(CourseAssistant(course_id=crs.id, assistant_id=ast.id))
        db.commit()
        print("  + Course assistants assigned")

        # ── Assignments + Test Cases + Rubrics ──
        print("\n[7/7] Assignments")
        for a in ASSIGNMENTS:
            crs = course_map.get(a["course_code"])
            if not crs:
                continue
            existing = db.query(Assignment).filter(
                Assignment.course_id == crs.id, Assignment.title == a["title"]
            ).first()
            if existing:
                print(f"  [exists] {a['title']}")
                continue

            lang = db.query(Language).filter(Language.name == a["language"]).first()
            asgn = Assignment(
                course_id=crs.id,
                title=a["title"],
                description=a["description"],
                instructions=a["instructions"],
                language_id=lang.id if lang else 1,
                max_score=a["max_score"],
                passing_score=a["passing_score"],
                due_date=datetime.utcnow() + timedelta(days=a["due_days"]),
                allow_late=True,
                late_penalty_per_day=10.0,
                max_late_days=3,
                max_attempts=5,
                enable_plagiarism_check=True,
                plagiarism_threshold=30.0,
                is_published=True,
            )
            db.add(asgn)
            db.commit()
            db.refresh(asgn)
            print(f"  + {crs.code}: {asgn.title}")

            # Test cases
            for tc in a.get("test_cases", []):
                db.add(TestCase(assignment_id=asgn.id, **tc))
            db.commit()

            # Rubric
            cats = a.get("rubric_categories", [])
            if cats:
                rubric_total = sum(
                    item["max_points"]
                    for cat in cats
                    for item in cat.get("items", [])
                )
                rubric = Rubric(assignment_id=asgn.id, total_points=rubric_total)
                db.add(rubric)
                db.commit()
                db.refresh(rubric)

                for ci, cat in enumerate(cats, 1):
                    rc = RubricCategory(
                        rubric_id=rubric.id,
                        name=cat["name"],
                        description=cat.get("description", ""),
                        weight=cat.get("weight", 1.0),
                        order=ci,
                    )
                    db.add(rc)
                    db.commit()
                    db.refresh(rc)
                    for ii, item in enumerate(cat.get("items", []), 1):
                        db.add(RubricItem(
                            category_id=rc.id,
                            name=item["name"],
                            max_points=item["max_points"],
                            order=ii,
                        ))
                db.commit()

        # ── Done ──
        print("\n" + "=" * 56)
        print("  SEED COMPLETE")
        print("=" * 56)
        print("\n  Credentials (password for all users below):")
        print(f"  Admin:   admin@ulm.edu / Admin@123456")
        print(f"  Faculty: jsmith@ulm.edu / Faculty@123")
        print(f"           mwilson@ulm.edu / Faculty@123")
        print(f"  Students (@warhawks.ulm.edu): Student@123")
        for s in STUDENT_USERS:
            print(f"    {s['student_id']}  {s['email']}")
        print()

    except Exception as e:
        print(f"\n  ERROR: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_database()
