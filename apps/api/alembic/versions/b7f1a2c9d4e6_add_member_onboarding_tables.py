"""add member onboarding and passkey tables

Revision ID: b7f1a2c9d4e6
Revises: db3e006cc294
Create Date: 2026-11-10 22:05:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "b7f1a2c9d4e6"
down_revision: str | None = "db3e006cc294"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # --- users: Cathay member profile -------------------------------------
    op.add_column("users", sa.Column("membership_number", sa.String(length=20), nullable=True))
    op.add_column("users", sa.Column("family_name", sa.String(length=100), nullable=True))
    op.add_column("users", sa.Column("given_names", sa.String(length=100), nullable=True))
    op.add_column("users", sa.Column("country_code", sa.String(length=10), nullable=True))
    op.add_column("users", sa.Column("phone_number", sa.String(length=30), nullable=True))
    op.add_column(
        "users",
        sa.Column("membership_tier", sa.String(length=20), nullable=False, server_default="GREEN"),
    )
    op.add_column(
        "users", sa.Column("status_points", sa.Integer(), nullable=False, server_default="0")
    )
    op.add_column(
        "users",
        sa.Column(
            "communication_prefs",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
    )

    # Carry existing rows over before the legacy columns go away.
    op.execute("UPDATE users SET family_name = last_name WHERE family_name IS NULL")
    op.execute("UPDATE users SET given_names = first_name WHERE given_names IS NULL")
    op.execute("UPDATE users SET phone_number = phone WHERE phone_number IS NULL")

    op.drop_column("users", "first_name")
    op.drop_column("users", "last_name")
    op.drop_column("users", "phone")
    op.drop_column("users", "phone_verified")
    op.drop_column("users", "country")
    op.drop_column("users", "marketing_opt_in")

    op.alter_column("users", "password_hash", existing_type=sa.String(length=255), nullable=True)
    op.create_index(
        op.f("ix_users_membership_number"), "users", ["membership_number"], unique=True
    )
    op.create_index(op.f("ix_users_phone_number"), "users", ["phone_number"], unique=False)

    # --- verification codes ------------------------------------------------
    op.create_table(
        "verification_codes",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("identifier", sa.String(length=255), nullable=False),
        sa.Column("channel", sa.String(length=20), nullable=False),
        sa.Column("purpose", sa.String(length=20), nullable=False),
        sa.Column("code_hash", sa.String(length=255), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("consumed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_verification_codes_identifier"),
        "verification_codes",
        ["identifier"],
        unique=False,
    )
    op.create_index(
        op.f("ix_verification_codes_user_id"), "verification_codes", ["user_id"], unique=False
    )

    # --- passkeys ----------------------------------------------------------
    op.create_table(
        "webauthn_credentials",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("credential_id", sa.String(length=512), nullable=False),
        sa.Column("public_key", sa.String(), nullable=False),
        sa.Column("sign_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("transports", sa.String(length=255), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_webauthn_credentials_credential_id"),
        "webauthn_credentials",
        ["credential_id"],
        unique=True,
    )
    op.create_index(
        op.f("ix_webauthn_credentials_user_id"),
        "webauthn_credentials",
        ["user_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_webauthn_credentials_user_id"), table_name="webauthn_credentials")
    op.drop_index(op.f("ix_webauthn_credentials_credential_id"), table_name="webauthn_credentials")
    op.drop_table("webauthn_credentials")

    op.drop_index(op.f("ix_verification_codes_user_id"), table_name="verification_codes")
    op.drop_index(op.f("ix_verification_codes_identifier"), table_name="verification_codes")
    op.drop_table("verification_codes")

    op.drop_index(op.f("ix_users_phone_number"), table_name="users")
    op.drop_index(op.f("ix_users_membership_number"), table_name="users")
    op.alter_column("users", "password_hash", existing_type=sa.String(length=255), nullable=False)

    op.add_column("users", sa.Column("first_name", sa.String(length=100), nullable=True))
    op.add_column("users", sa.Column("last_name", sa.String(length=100), nullable=True))
    op.add_column("users", sa.Column("phone", sa.String(length=30), nullable=True))
    op.add_column(
        "users", sa.Column("phone_verified", sa.Boolean(), nullable=False, server_default="false")
    )
    op.add_column("users", sa.Column("country", sa.String(length=100), nullable=True))
    op.add_column(
        "users",
        sa.Column("marketing_opt_in", sa.Boolean(), nullable=False, server_default="false"),
    )

    op.execute("UPDATE users SET first_name = given_names WHERE first_name IS NULL")
    op.execute("UPDATE users SET last_name = family_name WHERE last_name IS NULL")
    op.execute("UPDATE users SET phone = phone_number WHERE phone IS NULL")

    op.alter_column("users", "first_name", existing_type=sa.String(length=100), nullable=False)
    op.alter_column("users", "last_name", existing_type=sa.String(length=100), nullable=False)

    op.drop_column("users", "communication_prefs")
    op.drop_column("users", "status_points")
    op.drop_column("users", "membership_tier")
    op.drop_column("users", "phone_number")
    op.drop_column("users", "country_code")
    op.drop_column("users", "given_names")
    op.drop_column("users", "family_name")
    op.drop_column("users", "membership_number")
