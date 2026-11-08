"""initial migration

Revision ID: f8cfdaade2fe
Revises:
Create Date: 2026-11-08 23:54:11.156143

"""
from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'f8cfdaade2fe'
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        'tags',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('tag_code', sa.String(50), unique=True, nullable=False, index=True),
        sa.Column('is_active', sa.Boolean, default=True, nullable=False),
        sa.Column('firmware_version', sa.String(20), nullable=True),
        sa.Column('hardware_revision', sa.String(20), nullable=True),
        sa.Column('last_seen_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
    )

    op.create_table(
        'baggage',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('passenger_name', sa.String(255), nullable=False),
        sa.Column('flight_number', sa.String(20), nullable=False, index=True),
        sa.Column('departure_airport', sa.String(3), nullable=False),
        sa.Column('arrival_airport', sa.String(3), nullable=False),
        sa.Column('departure_time', sa.DateTime(timezone=True), nullable=False),
        sa.Column('seat_number', sa.String(10), nullable=True),
        sa.Column('status', sa.String(50), default='checked_in', nullable=False),
        sa.Column('tag_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tags.id'), nullable=True, index=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
    )

    # Create index for common queries
    op.create_index('ix_baggage_flight_departure', 'baggage', ['flight_number', 'departure_time'])
    op.create_index('ix_baggage_tag_status', 'baggage', ['tag_id', 'status'])


def downgrade() -> None:
    op.drop_index('ix_baggage_tag_status', table_name='baggage')
    op.drop_index('ix_baggage_flight_departure', table_name='baggage')
    op.drop_table('baggage')
    op.drop_table('tags')
