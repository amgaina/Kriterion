"""Add cascade delete to notifications user foreign key

Revision ID: f6a7b8c9d0e2
Revises: e5f6a7b8c9d0
Create Date: 2026-03-11

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'f6a7b8c9d0e2'
down_revision = 'e5f6a7b8c9d0'
branch_labels = None
depends_on = None


def upgrade():
    # Drop existing foreign key constraint
    op.drop_constraint('notifications_user_id_fkey', 'notifications', type_='foreignkey')
    
    # Recreate with CASCADE delete
    op.create_foreign_key(
        'notifications_user_id_fkey',
        'notifications', 'users',
        ['user_id'], ['id'],
        ondelete='CASCADE'
    )


def downgrade():
    # Drop the CASCADE constraint
    op.drop_constraint('notifications_user_id_fkey', 'notifications', type_='foreignkey')
    
    # Recreate without CASCADE
    op.create_foreign_key(
        'notifications_user_id_fkey',
        'notifications', 'users',
        ['user_id'], ['id']
    )
