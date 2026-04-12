"""
Seed test cases for existing assignments
"""
import sys
from pathlib import Path

# Add parent directory to path to import app modules
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.models import Assignment, TestCase
from app.core.logging import logger


def create_sample_test_cases(db: Session):
    """Create sample test cases for existing assignments"""
    
    # Get all assignments
    assignments = db.query(Assignment).all()
    
    for assignment in assignments:
        # Check if assignment already has test cases
        existing_tests = db.query(TestCase).filter(
            TestCase.assignment_id == assignment.id
        ).count()
        
        if existing_tests > 0:
            logger.info(f"Assignment '{assignment.title}' already has test cases, skipping...")
            continue
        
        logger.info(f"Creating test cases for assignment '{assignment.title}'...")
        
        # Create sample test cases based on language
        language_name = assignment.language.name.lower() if assignment.language else "python"
        
        if language_name == "python":
            test_cases = create_python_test_cases(assignment.id)
        elif language_name == "java":
            test_cases = create_java_test_cases(assignment.id)
        else:
            # Only python/java are supported; fall back to generic tests if legacy data exists
            test_cases = create_generic_test_cases(assignment.id)
        
        for test_case in test_cases:
            db.add(test_case)
        
        logger.info(f"Created {len(test_cases)} test cases for '{assignment.title}'")
    
    db.commit()
    logger.info("Test case seeding complete!")


def create_python_test_cases(assignment_id: int):
    """Create sample Python test cases"""
    return [
        TestCase(
            assignment_id=assignment_id,
            name="Basic Output Test",
            description="Verify program produces correct output",
            input_data="",
            expected_output="Hello, World!",
            points=10.0,
            is_hidden=False,
            ignore_whitespace=True,
            ignore_case=False,
            order=1
        ),
        TestCase(
            assignment_id=assignment_id,
            name="Input/Output Test",
            description="Test input handling",
            input_data="5",
            expected_output="Result: 5",
            points=15.0,
            is_hidden=False,
            ignore_whitespace=True,
            ignore_case=False,
            order=2
        ),
        TestCase(
            assignment_id=assignment_id,
            name="Edge Case Test",
            description="Test edge cases",
            input_data="0",
            expected_output="Result: 0",
            points=15.0,
            is_hidden=True,
            ignore_whitespace=True,
            ignore_case=False,
            order=3
        )
    ]


def create_java_test_cases(assignment_id: int):
    """Create sample Java test cases"""
    return [
        TestCase(
            assignment_id=assignment_id,
            name="Basic Execution",
            description="Verify program compiles and runs",
            input_data="",
            expected_output="Hello World",
            points=10.0,
            is_hidden=False,
            ignore_whitespace=True,
            ignore_case=False,
            order=1
        ),
        TestCase(
            assignment_id=assignment_id,
            name="Input Test",
            description="Test with input",
            input_data="10",
            expected_output="Output: 10",
            points=15.0,
            is_hidden=False,
            ignore_whitespace=True,
            ignore_case=False,
            order=2
        )
    ]


def create_generic_test_cases(assignment_id: int):
    """Create generic test cases"""
    return [
        TestCase(
            assignment_id=assignment_id,
            name="Sample Test",
            description="Basic test case",
            input_data="",
            expected_output="Success",
            points=10.0,
            is_hidden=False,
            ignore_whitespace=True,
            ignore_case=False,
            order=1
        )
    ]


if __name__ == "__main__":
    print("=" * 60)
    print("Seeding Test Cases")
    print("=" * 60)
    
    db = SessionLocal()
    try:
        create_sample_test_cases(db)
        print("\n✓ Test cases seeded successfully!")
    except Exception as e:
        print(f"\n✗ Error seeding test cases: {str(e)}")
        db.rollback()
        raise
    finally:
        db.close()
