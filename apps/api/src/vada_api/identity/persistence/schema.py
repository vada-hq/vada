"""Identity, organization and finance-context relationship tables."""

import sqlalchemy as sa

from vada_api.persistence.schema import metadata


def _non_empty(column_name: str) -> sa.CheckConstraint:
    return sa.CheckConstraint(
        f"char_length({column_name}) > 0",
        name=f"{column_name}_non_empty",
    )


vada_users = sa.Table(
    "vada_users",
    metadata,
    sa.Column("user_id", sa.Text(), primary_key=True),
    sa.Column("display_name", sa.Text(), nullable=False),
    _non_empty("user_id"),
    _non_empty("display_name"),
)


cognito_identities = sa.Table(
    "cognito_identities",
    metadata,
    sa.Column("issuer", sa.Text(), primary_key=True),
    sa.Column("subject", sa.Text(), primary_key=True),
    sa.Column("user_id", sa.Text(), nullable=False),
    _non_empty("issuer"),
    _non_empty("subject"),
    _non_empty("user_id"),
    sa.ForeignKeyConstraint(
        ["user_id"],
        ["vada_users.user_id"],
        name="fk_cognito_identities_user",
    ),
    sa.UniqueConstraint(
        "issuer",
        "user_id",
        name="uq_cognito_identities_issuer_user",
    ),
)


organizations = sa.Table(
    "organizations",
    metadata,
    sa.Column("organization_id", sa.Text(), primary_key=True),
    sa.Column("name", sa.Text(), nullable=False),
    _non_empty("organization_id"),
    _non_empty("name"),
)


organization_memberships = sa.Table(
    "organization_memberships",
    metadata,
    sa.Column("membership_id", sa.Text(), primary_key=True),
    sa.Column("organization_id", sa.Text(), nullable=False),
    sa.Column("user_id", sa.Text(), nullable=False),
    sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
    # 기본 직급. 마이그레이션 20260808_0006과 짝이다. 재정부는 여기 없다 —
    # 직급이 아니라 부서 조건이므로 부서 소속이 답한다.
    sa.Column("role", sa.Text(), nullable=False, server_default=sa.text("'member'")),
    _non_empty("membership_id"),
    _non_empty("organization_id"),
    _non_empty("user_id"),
    sa.ForeignKeyConstraint(
        ["organization_id"],
        ["organizations.organization_id"],
        name="fk_organization_memberships_organization",
    ),
    sa.ForeignKeyConstraint(
        ["user_id"],
        ["vada_users.user_id"],
        name="fk_organization_memberships_user",
    ),
    sa.UniqueConstraint(
        "organization_id",
        "user_id",
        name="uq_organization_memberships_user_scope",
    ),
    sa.UniqueConstraint(
        "organization_id",
        "membership_id",
        "user_id",
        name="uq_organization_memberships_relation_scope",
    ),
)


organization_events = sa.Table(
    "organization_events",
    metadata,
    sa.Column("organization_id", sa.Text(), primary_key=True),
    sa.Column("event_id", sa.Text(), primary_key=True),
    sa.Column("name", sa.Text(), nullable=False),
    _non_empty("organization_id"),
    _non_empty("event_id"),
    _non_empty("name"),
    sa.ForeignKeyConstraint(
        ["organization_id"],
        ["organizations.organization_id"],
        name="fk_organization_events_organization",
    ),
)


organization_departments = sa.Table(
    "organization_departments",
    metadata,
    sa.Column("organization_id", sa.Text(), primary_key=True),
    sa.Column("department_id", sa.Text(), primary_key=True),
    sa.Column("name", sa.Text(), nullable=False),
    _non_empty("organization_id"),
    _non_empty("department_id"),
    _non_empty("name"),
    sa.ForeignKeyConstraint(
        ["organization_id"],
        ["organizations.organization_id"],
        name="fk_organization_departments_organization",
    ),
)


department_memberships = sa.Table(
    "department_memberships",
    metadata,
    sa.Column("relationship_id", sa.Text(), primary_key=True),
    sa.Column("organization_id", sa.Text(), nullable=False),
    sa.Column("membership_id", sa.Text(), nullable=False),
    sa.Column("user_id", sa.Text(), nullable=False),
    sa.Column("department_id", sa.Text(), nullable=False),
    sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
    sa.Column(
        "is_department_head",
        sa.Boolean(),
        nullable=False,
        server_default=sa.false(),
    ),
    _non_empty("relationship_id"),
    _non_empty("organization_id"),
    _non_empty("membership_id"),
    _non_empty("user_id"),
    _non_empty("department_id"),
    sa.ForeignKeyConstraint(
        ["organization_id", "membership_id", "user_id"],
        [
            "organization_memberships.organization_id",
            "organization_memberships.membership_id",
            "organization_memberships.user_id",
        ],
        name="fk_department_memberships_membership_scope",
    ),
    sa.ForeignKeyConstraint(
        ["organization_id", "department_id"],
        [
            "organization_departments.organization_id",
            "organization_departments.department_id",
        ],
        name="fk_department_memberships_department_scope",
    ),
    sa.UniqueConstraint(
        "organization_id",
        "membership_id",
        "department_id",
        name="uq_department_memberships_scope",
    ),
)


organization_finance_memberships = sa.Table(
    "organization_finance_memberships",
    metadata,
    sa.Column("relationship_id", sa.Text(), primary_key=True),
    sa.Column("organization_id", sa.Text(), nullable=False),
    sa.Column("membership_id", sa.Text(), nullable=False),
    sa.Column("user_id", sa.Text(), nullable=False),
    sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
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
        name="fk_organization_finance_memberships_membership_scope",
    ),
    sa.UniqueConstraint(
        "organization_id",
        "membership_id",
        name="uq_organization_finance_memberships_scope",
    ),
)


event_finance_contexts = sa.Table(
    "event_finance_contexts",
    metadata,
    sa.Column("organization_id", sa.Text(), primary_key=True),
    sa.Column("event_id", sa.Text(), primary_key=True),
    sa.Column("available_budget", sa.Numeric(), nullable=False),
    _non_empty("organization_id"),
    _non_empty("event_id"),
    sa.CheckConstraint(
        "available_budget >= 0",
        name="available_budget_non_negative",
    ),
    sa.ForeignKeyConstraint(
        ["organization_id", "event_id"],
        [
            "organization_events.organization_id",
            "organization_events.event_id",
        ],
        name="fk_event_finance_contexts_event_scope",
    ),
)
