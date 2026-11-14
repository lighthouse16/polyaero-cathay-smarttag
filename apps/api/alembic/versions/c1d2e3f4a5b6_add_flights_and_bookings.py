"""add flights and bookings

Revision ID: c1d2e3f4a5b6
Revises: b7f1a2c9d4e6
Create Date: 2026-11-10 23:20:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "c1d2e3f4a5b6"
down_revision: str | None = "b7f1a2c9d4e6"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "flights",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("flight_number", sa.String(length=10), nullable=False),
        sa.Column("origin", sa.String(length=3), nullable=False),
        sa.Column("destination", sa.String(length=3), nullable=False),
        sa.Column("departure_time", sa.DateTime(timezone=True), nullable=False),
        sa.Column("arrival_time", sa.DateTime(timezone=True), nullable=False),
        sa.Column("aircraft", sa.String(length=30), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_flights_flight_number"), "flights", ["flight_number"], unique=False)
    op.create_index(op.f("ix_flights_origin"), "flights", ["origin"], unique=False)
    op.create_index(op.f("ix_flights_destination"), "flights", ["destination"], unique=False)

    op.create_table(
        "bookings",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("pnr", sa.String(length=10), nullable=False),
        sa.Column("flight_number", sa.String(length=10), nullable=False),
        sa.Column("origin", sa.String(length=3), nullable=False),
        sa.Column("destination", sa.String(length=3), nullable=False),
        sa.Column("departure_date", sa.DateTime(timezone=True), nullable=False),
        sa.Column("return_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cabin_class", sa.String(length=30), server_default="Economy", nullable=False),
        sa.Column("passenger_count", sa.Integer(), server_default="1", nullable=False),
        sa.Column(
            "booking_status", sa.String(length=30), server_default="CONFIRMED", nullable=False
        ),
        sa.Column("tag_id", sa.UUID(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["tag_id"], ["tags.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_bookings_pnr"), "bookings", ["pnr"], unique=True)
    op.create_index(op.f("ix_bookings_tag_id"), "bookings", ["tag_id"], unique=False)
    op.create_index(op.f("ix_bookings_user_id"), "bookings", ["user_id"], unique=False)

    # Demo schedule so /flights/search has something to return.
    op.execute(
        """
        INSERT INTO flights (id, flight_number, origin, destination, departure_time, arrival_time, aircraft) VALUES
        ('a0000000-0000-0000-0000-000000000001', 'CX255', 'HKG', 'NKG', now() + interval '7 days',  now() + interval '7 days 2 hours 30 minutes', 'Airbus A330-300'),
        ('a0000000-0000-0000-0000-000000000002', 'CX256', 'NKG', 'HKG', now() + interval '11 days', now() + interval '11 days 2 hours 30 minutes', 'Airbus A330-300'),
        ('a0000000-0000-0000-0000-000000000003', 'CX520', 'HKG', 'NRT', now() + interval '7 days',  now() + interval '7 days 4 hours 5 minutes', 'Boeing 777-300ER'),
        ('a0000000-0000-0000-0000-000000000004', 'CX521', 'NRT', 'HKG', now() + interval '14 days', now() + interval '14 days 4 hours 40 minutes', 'Boeing 777-300ER')
        """
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_bookings_user_id"), table_name="bookings")
    op.drop_index(op.f("ix_bookings_tag_id"), table_name="bookings")
    op.drop_index(op.f("ix_bookings_pnr"), table_name="bookings")
    op.drop_table("bookings")
    op.drop_index(op.f("ix_flights_destination"), table_name="flights")
    op.drop_index(op.f("ix_flights_origin"), table_name="flights")
    op.drop_index(op.f("ix_flights_flight_number"), table_name="flights")
    op.drop_table("flights")
