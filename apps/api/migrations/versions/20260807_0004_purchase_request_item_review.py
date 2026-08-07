"""품목별 검토 결정을 추가 전용 기록으로 남긴다.

Revision ID: 20260807_0004
Revises: 20260805_0003
Create Date: 2026-08-07
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260807_0004"
down_revision: str | None = "20260805_0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

phase: str = "expand"

TABLE = "purchase_request_item_review_events"
# 제약 이름 접두사. 표 이름을 그대로 쓰면 PostgreSQL의 63자 한도를 넘는다.
NAME = "pr_item_review"


def _non_empty(column_name: str) -> sa.CheckConstraint:
    return sa.CheckConstraint(
        f"char_length({column_name}) > 0",
        name=op.f(f"ck_{NAME}_{column_name}_non_empty"),
    )


def upgrade() -> None:
    # 품목의 기본 키는 item_id 하나뿐이고 기존 유니크 제약은 item_position 기준이다.
    # 검토 결정이 조직·행사 범위를 벗어난 품목을 가리키지 못하게 하려면 복합 키로
    # 참조해야 하므로 그 대상을 먼저 만든다. item_id가 이미 유일하므로 기존
    # 데이터에 안전하다.
    op.create_unique_constraint(
        "uq_purchase_request_items_scope_item",
        "purchase_request_items",
        ["organization_id", "event_id", "request_id", "item_id"],
    )

    # 제출된 품목(purchase_request_items)은 불변 기록이라 상태 열을 붙이지 않는다.
    # 검토 결정은 시간에 따라 쌓이는 별개의 사실이므로 추가 전용 표로 둔다.
    # 현재 상태는 품목마다 가장 최근 사건이며 따로 저장하지 않는다.
    op.create_table(
        TABLE,
        sa.Column("review_event_id", sa.Text(), nullable=False),
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
        _non_empty("review_event_id"),
        _non_empty("organization_id"),
        _non_empty("event_id"),
        _non_empty("request_id"),
        _non_empty("item_id"),
        _non_empty("decided_by_user_id"),
        # 계약 DATA:purchase_request.item_review_state@R1의 상태만 저장한다.
        sa.CheckConstraint(
            "review_status IN ('approved', 'revision_requested', 'rejected')",
            name=op.f(f"ck_{NAME}_review_status_allowed"),
        ),
        # 결정마다 필요한 값이 다르다. 승인에 보완 사유가 딸려 오는 것은
        # 어딘가 잘못됐다는 뜻이므로 DB에서도 막는다.
        sa.CheckConstraint(
            "(review_status = 'revision_requested')"
            " = (revision_reason IS NOT NULL AND revision_due_date IS NOT NULL)",
            name=op.f(f"ck_{NAME}_revision_fields_match_status"),
        ),
        sa.CheckConstraint(
            "(review_status = 'rejected') = (rejection_reason IS NOT NULL)",
            name=op.f(f"ck_{NAME}_rejection_reason_matches_status"),
        ),
        sa.CheckConstraint(
            "revision_reason IS NULL OR char_length(btrim(revision_reason)) > 0",
            name=op.f(f"ck_{NAME}_revision_reason_not_blank"),
        ),
        sa.CheckConstraint(
            "rejection_reason IS NULL OR char_length(btrim(rejection_reason)) > 0",
            name=op.f(f"ck_{NAME}_rejection_reason_not_blank"),
        ),
        sa.PrimaryKeyConstraint("review_event_id", name=op.f(f"pk_{NAME}")),
        # 품목은 조직·행사 범위 안에서만 가리킨다. 다른 조직의 품목에 결정을
        # 붙일 수 없게 복합 키로 묶는다.
        sa.ForeignKeyConstraint(
            ["organization_id", "event_id", "request_id", "item_id"],
            [
                "purchase_request_items.organization_id",
                "purchase_request_items.event_id",
                "purchase_request_items.request_id",
                "purchase_request_items.item_id",
            ],
            name=op.f(f"fk_{NAME}_item"),
            ondelete="RESTRICT",
        ),
    )

    # 품목의 현재 상태를 읽는 경로다. 최신 사건 하나만 필요하다.
    op.create_index(
        op.f(f"ix_{NAME}_item_decided_at"),
        TABLE,
        ["organization_id", "event_id", "request_id", "item_id", "decided_at"],
        unique=False,
    )
    # 처리 기록은 요청 단위로 시간순 조회한다.
    op.create_index(
        op.f(f"ix_{NAME}_request_decided_at"),
        TABLE,
        ["organization_id", "event_id", "request_id", "decided_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f(f"ix_{NAME}_request_decided_at"), table_name=TABLE)
    op.drop_index(op.f(f"ix_{NAME}_item_decided_at"), table_name=TABLE)
    op.drop_table(TABLE)
    op.drop_constraint(
        "uq_purchase_request_items_scope_item",
        "purchase_request_items",
        type_="unique",
    )
