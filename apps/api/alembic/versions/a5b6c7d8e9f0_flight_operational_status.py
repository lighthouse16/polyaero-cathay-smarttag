"""Persist staff-reported flight operations without guessing status from the clock."""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "a5b6c7d8e9f0"
down_revision: str | None = "f4a5b6c7d8e9"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "flights",
        sa.Column("operational_status", sa.String(20), server_default="UNKNOWN", nullable=False),
    )
    for name in (
        "estimated_departure_time",
        "estimated_arrival_time",
        "actual_departure_time",
        "actual_arrival_time",
        "status_reported_at",
    ):
        op.add_column("flights", sa.Column(name, sa.DateTime(timezone=True), nullable=True))
    op.create_check_constraint(
        "ck_flights_operational_status",
        "flights",
        "operational_status IN ('UNKNOWN', 'SCHEDULED', 'DELAYED', 'BOARDING', "
        "'DEPARTED', 'ARRIVED', 'CANCELLED')",
    )
    op.create_check_constraint(
        "ck_flights_estimated_times",
        "flights",
        "estimated_arrival_time > estimated_departure_time",
    )
    op.create_check_constraint(
        "ck_flights_actual_times",
        "flights",
        "actual_arrival_time > actual_departure_time",
    )


def downgrade() -> None:
    for name in (
        "ck_flights_operational_status",
        "ck_flights_estimated_times",
        "ck_flights_actual_times",
    ):
        op.drop_constraint(name, "flights", type_="check")
    for name in (
        "operational_status",
        "estimated_departure_time",
        "estimated_arrival_time",
        "actual_departure_time",
        "actual_arrival_time",
        "status_reported_at",
    ):
        op.drop_column("flights", name)
