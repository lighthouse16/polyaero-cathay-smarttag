"""Persist dashboard risk and recovery data.

Revision ID: a6b7c8d9e0f1
Revises: f4a5b6c7d8e9
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "a6b7c8d9e0f1"
down_revision: str | None = "f4a5b6c7d8e9"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "baggage",
        sa.Column("operational_data", postgresql.JSONB(), nullable=False, server_default="{}"),
    )


def downgrade() -> None:
    op.drop_column("baggage", "operational_data")
