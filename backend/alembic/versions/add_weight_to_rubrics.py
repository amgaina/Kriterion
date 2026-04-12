"""Add weight column to rubrics table

Revision ID: a1b2c3d4e5f6
Revises: z9y8x7w6
Create Date: 2026-03-26 01:50:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'wt1rb2wt3rb4'
down_revision = 'y1x2w3v4'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add weight column to rubrics table if it doesn't exist
    with op.batch_alter_table('rubrics', schema=None) as batch_op:
        # Check if column doesn't exist before adding
        try:
            batch_op.add_column(sa.Column('weight', sa.Float(), nullable=False, server_default='0.0'))
        except Exception:
            # Column already exists
            pass


def downgrade() -> None:
    with op.batch_alter_table('rubrics', schema=None) as batch_op:
        batch_op.drop_column('weight')
