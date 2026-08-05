"""사용자·조직 관계와 행사 재정 맥락을 확장한다.

Revision ID: 20260805_0003
Revises: 20260804_0002
Create Date: 2026-08-05
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260805_0003"
down_revision: str | None = "20260804_0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

phase: str = "expand"


def _non_empty(column_name: str) -> sa.CheckConstraint:
    return sa.CheckConstraint(
        f"char_length({column_name}) > 0",
        name=f"{column_name}_non_empty",
    )


def upgrade() -> None:
    op.create_table(
        "vada_users",
        sa.Column("user_id", sa.Text(), nullable=False),
        sa.Column("display_name", sa.Text(), nullable=False),
        _non_empty("user_id"),
        _non_empty("display_name"),
        sa.PrimaryKeyConstraint("user_id", name=op.f("pk_vada_users")),
    )
    op.create_table(
        "cognito_identities",
        sa.Column("issuer", sa.Text(), nullable=False),
        sa.Column("subject", sa.Text(), nullable=False),
        sa.Column("user_id", sa.Text(), nullable=False),
        _non_empty("issuer"),
        _non_empty("subject"),
        _non_empty("user_id"),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["vada_users.user_id"],
            name=op.f("fk_cognito_identities_user"),
        ),
        sa.PrimaryKeyConstraint(
            "issuer", "subject", name=op.f("pk_cognito_identities")
        ),
        sa.UniqueConstraint(
            "issuer",
            "user_id",
            name=op.f("uq_cognito_identities_issuer_user"),
        ),
    )
    op.create_table(
        "organizations",
        sa.Column("organization_id", sa.Text(), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        _non_empty("organization_id"),
        _non_empty("name"),
        sa.PrimaryKeyConstraint("organization_id", name=op.f("pk_organizations")),
    )
    op.create_table(
        "organization_memberships",
        sa.Column("membership_id", sa.Text(), nullable=False),
        sa.Column("organization_id", sa.Text(), nullable=False),
        sa.Column("user_id", sa.Text(), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.true(), nullable=False),
        _non_empty("membership_id"),
        _non_empty("organization_id"),
        _non_empty("user_id"),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.organization_id"],
            name=op.f("fk_organization_memberships_organization"),
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["vada_users.user_id"],
            name=op.f("fk_organization_memberships_user"),
        ),
        sa.PrimaryKeyConstraint(
            "membership_id", name=op.f("pk_organization_memberships")
        ),
        sa.UniqueConstraint(
            "organization_id",
            "user_id",
            name=op.f("uq_organization_memberships_user_scope"),
        ),
        sa.UniqueConstraint(
            "organization_id",
            "membership_id",
            "user_id",
            name=op.f("uq_organization_memberships_relation_scope"),
        ),
    )
    op.create_table(
        "organization_events",
        sa.Column("organization_id", sa.Text(), nullable=False),
        sa.Column("event_id", sa.Text(), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        _non_empty("organization_id"),
        _non_empty("event_id"),
        _non_empty("name"),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.organization_id"],
            name=op.f("fk_organization_events_organization"),
        ),
        sa.PrimaryKeyConstraint(
            "organization_id",
            "event_id",
            name=op.f("pk_organization_events"),
        ),
    )
    op.create_table(
        "organization_departments",
        sa.Column("organization_id", sa.Text(), nullable=False),
        sa.Column("department_id", sa.Text(), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        _non_empty("organization_id"),
        _non_empty("department_id"),
        _non_empty("name"),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.organization_id"],
            name=op.f("fk_organization_departments_organization"),
        ),
        sa.PrimaryKeyConstraint(
            "organization_id",
            "department_id",
            name=op.f("pk_organization_departments"),
        ),
    )
    op.create_table(
        "department_memberships",
        sa.Column("relationship_id", sa.Text(), nullable=False),
        sa.Column("organization_id", sa.Text(), nullable=False),
        sa.Column("membership_id", sa.Text(), nullable=False),
        sa.Column("user_id", sa.Text(), nullable=False),
        sa.Column("department_id", sa.Text(), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column(
            "is_department_head",
            sa.Boolean(),
            server_default=sa.false(),
            nullable=False,
        ),
        _non_empty("relationship_id"),
        _non_empty("organization_id"),
        _non_empty("membership_id"),
        _non_empty("user_id"),
        _non_empty("department_id"),
        sa.ForeignKeyConstraint(
            ["organization_id", "department_id"],
            [
                "organization_departments.organization_id",
                "organization_departments.department_id",
            ],
            name=op.f("fk_department_memberships_department_scope"),
        ),
        sa.ForeignKeyConstraint(
            ["organization_id", "membership_id", "user_id"],
            [
                "organization_memberships.organization_id",
                "organization_memberships.membership_id",
                "organization_memberships.user_id",
            ],
            name=op.f("fk_department_memberships_membership_scope"),
        ),
        sa.PrimaryKeyConstraint(
            "relationship_id", name=op.f("pk_department_memberships")
        ),
        sa.UniqueConstraint(
            "organization_id",
            "membership_id",
            "department_id",
            name=op.f("uq_department_memberships_scope"),
        ),
    )
    op.create_table(
        "organization_finance_memberships",
        sa.Column("relationship_id", sa.Text(), nullable=False),
        sa.Column("organization_id", sa.Text(), nullable=False),
        sa.Column("membership_id", sa.Text(), nullable=False),
        sa.Column("user_id", sa.Text(), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.true(), nullable=False),
        _non_empty("relationship_id"),
        _non_empty("organization_id"),
        _non_empty("membership_id"),
        _non_empty("user_id"),
        sa.ForeignKeyConstraint(
            ["organization_id", "membership_id", "user_id"],
            [
                "organization_memberships.organization_id",
                "organization_memberships.membership_id",
                "organization_memberships.user_id",
            ],
            name=op.f("fk_organization_finance_memberships_membership_scope"),
        ),
        sa.PrimaryKeyConstraint(
            "relationship_id",
            name=op.f("pk_organization_finance_memberships"),
        ),
        sa.UniqueConstraint(
            "organization_id",
            "membership_id",
            name=op.f("uq_organization_finance_memberships_scope"),
        ),
    )
    op.create_table(
        "event_finance_contexts",
        sa.Column("organization_id", sa.Text(), nullable=False),
        sa.Column("event_id", sa.Text(), nullable=False),
        sa.Column("available_budget", sa.Numeric(), nullable=False),
        _non_empty("organization_id"),
        _non_empty("event_id"),
        sa.CheckConstraint(
            "available_budget >= 0",
            name=op.f("ck_event_finance_contexts_available_budget_non_negative"),
        ),
        sa.ForeignKeyConstraint(
            ["organization_id", "event_id"],
            [
                "organization_events.organization_id",
                "organization_events.event_id",
            ],
            name=op.f("fk_event_finance_contexts_event_scope"),
        ),
        sa.PrimaryKeyConstraint(
            "organization_id",
            "event_id",
            name=op.f("pk_event_finance_contexts"),
        ),
    )


def downgrade() -> None:
    op.drop_table("event_finance_contexts")
    op.drop_table("organization_finance_memberships")
    op.drop_table("department_memberships")
    op.drop_table("organization_departments")
    op.drop_table("organization_events")
    op.drop_table("organization_memberships")
    op.drop_table("organizations")
    op.drop_table("cognito_identities")
    op.drop_table("vada_users")
