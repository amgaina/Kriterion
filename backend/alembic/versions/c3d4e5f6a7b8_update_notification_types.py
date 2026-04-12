"""Update notification types enum for notification system

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-03-01 20:20:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c3d4e5f6a7b8'
down_revision: Union[str, None] = 'b2c3d4e5f6a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Drop the old enum constraint by recreating the type
    # First, we need to alter the column to use a text type temporarily
    op.execute('ALTER TABLE notifications ALTER COLUMN type TYPE VARCHAR')
    
    # Drop the old enum type
    op.execute('DROP TYPE notificationtype')
    
    # Create the new enum type with all notification types
    op.execute("""
        CREATE TYPE notificationtype AS ENUM (
            'ASSIGNMENT_NEW',
            'ASSIGNMENT_DUE',
            'ASSIGNMENT_GRADED',
            'SUBMISSION_RECEIVED',
            'COURSE_ANNOUNCEMENT',
            'ACHIEVEMENT_EARNED',
            'STREAK_REMINDER',
            'SYSTEM',
            'HOMEWORK_POSTED',
            'HOMEWORK_DUE',
            'GRADE_POSTED',
            'NEW_SUBMISSION_RECEIVED',
            'GRADING_PENDING',
            'NEW_USER_REGISTERED',
            'COURSE_APPROVAL_REQUIRED',
            'SYSTEM_ALERT'
        )
    """)
    
    # Convert the column back to the enum type
    op.execute('ALTER TABLE notifications ALTER COLUMN type TYPE notificationtype USING type::notificationtype')


def downgrade() -> None:
    # Reverse the changes
    op.execute('ALTER TABLE notifications ALTER COLUMN type TYPE VARCHAR')
    
    op.execute('DROP TYPE notificationtype')
    
    op.execute("""
        CREATE TYPE notificationtype AS ENUM (
            'ASSIGNMENT_NEW',
            'ASSIGNMENT_DUE',
            'ASSIGNMENT_GRADED',
            'SUBMISSION_RECEIVED',
            'COURSE_ANNOUNCEMENT',
            'ACHIEVEMENT_EARNED',
            'STREAK_REMINDER',
            'SYSTEM'
        )
    """)
    
    op.execute('ALTER TABLE notifications ALTER COLUMN type TYPE notificationtype USING type::notificationtype')
