"""구매 요청 R1의 SQLAlchemy 데이터 구조.

마이그레이션은 불변 이력이어야 하므로 이 모듈을 import하지 않고 같은 R1 구조를
자체적으로 고정한다. 애플리케이션 쿼리는 조직 식별자를 선두 조건으로 사용한다.
"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from vada_api.persistence.schema import metadata


def _non_empty(column_name: str) -> sa.CheckConstraint:
    return sa.CheckConstraint(
        f"char_length({column_name}) > 0",
        name=f"{column_name}_non_empty",
    )


purchase_request_drafts = sa.Table(
    "purchase_request_drafts",
    metadata,
    sa.Column("draft_id", sa.Text(), primary_key=True),
    sa.Column("organization_id", sa.Text(), nullable=False),
    sa.Column("event_id", sa.Text(), nullable=False),
    sa.Column("owner_user_id", sa.Text(), nullable=False),
    sa.Column("version", sa.Integer(), nullable=False),
    sa.Column("content", postgresql.JSONB(), nullable=False),
    sa.Column(
        "saved_at",
        sa.DateTime(timezone=True),
        nullable=False,
        server_default=sa.text("CURRENT_TIMESTAMP"),
    ),
    _non_empty("draft_id"),
    _non_empty("organization_id"),
    _non_empty("event_id"),
    _non_empty("owner_user_id"),
    sa.CheckConstraint("version >= 1", name="version_positive"),
    sa.CheckConstraint(
        "vada_purchase_request_draft_content_r1_is_valid(content)",
        name="content_v1",
    ),
    sa.UniqueConstraint(
        "organization_id",
        "event_id",
        "owner_user_id",
        name="uq_purchase_request_drafts_scope",
    ),
)


purchase_requests = sa.Table(
    "purchase_requests",
    metadata,
    sa.Column("request_id", sa.Text(), primary_key=True),
    sa.Column("organization_id", sa.Text(), nullable=False),
    sa.Column("event_id", sa.Text(), nullable=False),
    sa.Column("requester_user_id", sa.Text(), nullable=False),
    sa.Column("request_department_id", sa.Text(), nullable=False),
    sa.Column("title", sa.Text(), nullable=False),
    sa.Column("needed_date", sa.Date(), nullable=False),
    sa.Column("purpose", sa.Text(), nullable=False),
    sa.Column("priority", sa.Text(), nullable=False),
    sa.Column(
        "status",
        sa.Text(),
        nullable=False,
        server_default=sa.text("'review_pending'"),
    ),
    sa.Column("estimated_total", sa.Numeric(), nullable=False),
    sa.Column("over_budget", sa.Boolean(), nullable=False),
    sa.Column(
        "created_at",
        sa.DateTime(timezone=True),
        nullable=False,
        server_default=sa.text("CURRENT_TIMESTAMP"),
    ),
    _non_empty("request_id"),
    _non_empty("organization_id"),
    _non_empty("event_id"),
    _non_empty("requester_user_id"),
    _non_empty("request_department_id"),
    _non_empty("title"),
    _non_empty("purpose"),
    sa.CheckConstraint("priority IN ('normal', 'urgent')", name="priority_allowed"),
    sa.CheckConstraint("status = 'review_pending'", name="review_pending"),
    sa.CheckConstraint("estimated_total > 0", name="estimated_total_positive"),
    sa.UniqueConstraint(
        "organization_id",
        "event_id",
        "request_id",
        name="uq_purchase_requests_scope_identity",
    ),
)

sa.Index(
    "ix_purchase_requests_own_recent",
    purchase_requests.c.organization_id,
    purchase_requests.c.event_id,
    purchase_requests.c.requester_user_id,
    purchase_requests.c.created_at.desc(),
)


purchase_request_items = sa.Table(
    "purchase_request_items",
    metadata,
    sa.Column("item_id", sa.Text(), primary_key=True),
    sa.Column("organization_id", sa.Text(), nullable=False),
    sa.Column("event_id", sa.Text(), nullable=False),
    sa.Column("request_id", sa.Text(), nullable=False),
    sa.Column("item_position", sa.Integer(), nullable=False),
    sa.Column("name", sa.Text(), nullable=False),
    sa.Column("category", sa.Text(), nullable=False),
    sa.Column("budget_item", sa.Text(), nullable=False),
    sa.Column("purchase_type", sa.Text(), nullable=False),
    sa.Column("quantity", sa.Numeric(), nullable=False),
    sa.Column("unit", sa.Text(), nullable=False),
    sa.Column("estimated_unit_price", sa.Numeric(), nullable=False),
    sa.Column(
        "estimated_amount",
        sa.Numeric(),
        sa.Computed("quantity * estimated_unit_price", persisted=True),
        nullable=False,
    ),
    sa.Column("price_evidence", postgresql.JSONB(), nullable=False),
    sa.Column("details", postgresql.JSONB(), nullable=False),
    _non_empty("item_id"),
    _non_empty("organization_id"),
    _non_empty("event_id"),
    _non_empty("request_id"),
    _non_empty("name"),
    _non_empty("category"),
    _non_empty("budget_item"),
    _non_empty("unit"),
    sa.CheckConstraint("item_position >= 0", name="position_non_negative"),
    sa.CheckConstraint(
        "purchase_type IN ('general', 'manufacturing_printing', 'rental', 'service')",
        name="purchase_type_allowed",
    ),
    sa.CheckConstraint("quantity > 0", name="quantity_positive"),
    sa.CheckConstraint(
        "estimated_unit_price > 0 AND "
        "estimated_unit_price = trunc(estimated_unit_price)",
        name="unit_price_positive_integer",
    ),
    sa.CheckConstraint(
        "vada_purchase_request_item_r1_is_valid("
        "purchase_type, price_evidence, details)",
        name="contract_v1",
    ),
    sa.ForeignKeyConstraint(
        ["organization_id", "event_id", "request_id"],
        [
            "purchase_requests.organization_id",
            "purchase_requests.event_id",
            "purchase_requests.request_id",
        ],
        name="fk_purchase_request_items_request_scope",
        ondelete="CASCADE",
        onupdate="CASCADE",
    ),
    sa.UniqueConstraint(
        "organization_id",
        "event_id",
        "request_id",
        "item_position",
        name="uq_purchase_request_items_position",
    ),
)

sa.Index(
    "ix_purchase_request_items_request_scope",
    purchase_request_items.c.organization_id,
    purchase_request_items.c.event_id,
    purchase_request_items.c.request_id,
)


purchase_request_submission_idempotency = sa.Table(
    "purchase_request_submission_idempotency",
    metadata,
    sa.Column("organization_id", sa.Text(), primary_key=True),
    sa.Column("event_id", sa.Text(), primary_key=True),
    sa.Column("requester_user_id", sa.Text(), primary_key=True),
    sa.Column("idempotency_key_hash", sa.Text(), primary_key=True),
    sa.Column("payload_hash", sa.Text(), nullable=False),
    sa.Column("request_id", sa.Text(), nullable=False),
    sa.Column(
        "created_at",
        sa.DateTime(timezone=True),
        nullable=False,
        server_default=sa.text("CURRENT_TIMESTAMP"),
    ),
    _non_empty("organization_id"),
    _non_empty("event_id"),
    _non_empty("requester_user_id"),
    sa.CheckConstraint(
        "idempotency_key_hash ~ '^[0-9a-f]{64}$'",
        name="idempotency_key_hash_sha256",
    ),
    sa.CheckConstraint(
        "payload_hash ~ '^[0-9a-f]{64}$'",
        name="payload_hash_sha256",
    ),
    _non_empty("request_id"),
    sa.ForeignKeyConstraint(
        ["organization_id", "event_id", "request_id"],
        [
            "purchase_requests.organization_id",
            "purchase_requests.event_id",
            "purchase_requests.request_id",
        ],
        name="fk_purchase_request_submission_idempotency_request_scope",
        deferrable=True,
        initially="DEFERRED",
    ),
    sa.UniqueConstraint(
        "request_id",
        name="uq_purchase_request_submission_idempotency_request_id",
    ),
)


purchase_request_submission_events = sa.Table(
    "purchase_request_submission_events",
    metadata,
    sa.Column("request_id", sa.Text(), primary_key=True),
    sa.Column("organization_id", sa.Text(), nullable=False),
    sa.Column("event_id", sa.Text(), nullable=False),
    sa.Column("requester_user_id", sa.Text(), nullable=False),
    sa.Column("request_department_id", sa.Text(), nullable=False),
    sa.Column("estimated_total", sa.Numeric(), nullable=False),
    sa.Column("over_budget", sa.Boolean(), nullable=False),
    sa.Column(
        "submitted_at",
        sa.DateTime(timezone=True),
        nullable=False,
        server_default=sa.text("CURRENT_TIMESTAMP"),
    ),
    _non_empty("request_id"),
    _non_empty("organization_id"),
    _non_empty("event_id"),
    _non_empty("requester_user_id"),
    _non_empty("request_department_id"),
    sa.CheckConstraint("estimated_total > 0", name="estimated_total_positive"),
    sa.ForeignKeyConstraint(
        ["organization_id", "event_id", "request_id"],
        [
            "purchase_requests.organization_id",
            "purchase_requests.event_id",
            "purchase_requests.request_id",
        ],
        name="fk_purchase_request_submission_events_request_scope",
    ),
)


# 검토 결정은 추가 전용이다. 품목의 현재 상태는 가장 최근 사건이며 따로 저장하지
# 않는다. 마이그레이션 20260807_0004와 짝이다.
purchase_request_item_review_events = sa.Table(
    "purchase_request_item_review_events",
    metadata,
    sa.Column("review_event_id", sa.Text(), primary_key=True),
    sa.Column("organization_id", sa.Text(), nullable=False),
    sa.Column("event_id", sa.Text(), nullable=False),
    sa.Column("request_id", sa.Text(), nullable=False),
    sa.Column("item_id", sa.Text(), nullable=False),
    sa.Column("review_status", sa.Text(), nullable=False),
    sa.Column("revision_reason", sa.Text(), nullable=True),
    sa.Column("revision_due_date", sa.Date(), nullable=True),
    sa.Column("rejection_reason", sa.Text(), nullable=True),
    sa.Column("decided_by_user_id", sa.Text(), nullable=False),
    sa.Column("decided_at", sa.DateTime(timezone=True), nullable=False),
)
