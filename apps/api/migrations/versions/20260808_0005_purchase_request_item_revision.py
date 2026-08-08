"""보완 재제출본을 추가 전용 기록으로 쌓는다.

Revision ID: 20260808_0005
Revises: 20260807_0004
Create Date: 2026-08-08
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20260808_0005"
down_revision: str | None = "20260807_0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

phase: str = "expand"

TABLE = "purchase_request_item_revisions"
# 제약 이름 접두사. 표 이름을 그대로 쓰면 PostgreSQL의 63자 한도를 넘는다.
NAME = "pr_item_revision"


def _non_empty(column_name: str) -> sa.CheckConstraint:
    return sa.CheckConstraint(
        f"char_length({column_name}) > 0",
        name=op.f(f"ck_{NAME}_{column_name}_non_empty"),
    )


def upgrade() -> None:
    # 제출된 품목(purchase_request_items)은 불변 기록이라 고쳐 쓰지 않는다.
    # 보완 재제출은 같은 요청·품목 식별자를 유지한 채 새 제출본을 만든다
    # (VADA_FINANCE_SPEC.md §7). 검토 결정과 같은 방식으로 추가 전용 표에 쌓고
    # 가장 최근 제출본이 지금 값이다.
    #
    # 보완 전·후 내용을 모두 보존하라는 요구가 여기서 지켜진다. 화면이 지금은
    # 최근 것만 보여주지만(CB-FIN-004@R1/Q-001), 그것은 표시의 결정이지
    # 저장의 결정이 아니다. 나중에 이력을 보여주기로 바꿔도 데이터가 이미 있다.
    op.create_table(
        TABLE,
        sa.Column("revision_id", sa.Text(), nullable=False),
        sa.Column("organization_id", sa.Text(), nullable=False),
        sa.Column("event_id", sa.Text(), nullable=False),
        sa.Column("request_id", sa.Text(), nullable=False),
        sa.Column("item_id", sa.Text(), nullable=False),
        # 같은 품목에 여러 벌이 쌓인다. 1부터 세며 빈 자리를 두지 않는다.
        sa.Column("submission_number", sa.Integer(), nullable=False),
        sa.Column("content", postgresql.JSONB(), nullable=False),
        sa.Column("submitted_by_user_id", sa.Text(), nullable=False),
        sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=False),
        # 재시도가 제출본을 두 벌 쌓지 않게 한다. 요청 단위로 유일하다.
        sa.Column("idempotency_key", sa.Text(), nullable=False),
        _non_empty("revision_id"),
        _non_empty("organization_id"),
        _non_empty("event_id"),
        _non_empty("request_id"),
        _non_empty("item_id"),
        _non_empty("submitted_by_user_id"),
        _non_empty("idempotency_key"),
        sa.CheckConstraint(
            "submission_number >= 1",
            name=op.f(f"ck_{NAME}_submission_number_positive"),
        ),
        sa.CheckConstraint(
            "jsonb_typeof(content) = 'object'",
            name=op.f(f"ck_{NAME}_content_is_object"),
        ),
        sa.PrimaryKeyConstraint("revision_id", name=op.f(f"pk_{NAME}")),
        # 같은 품목에 같은 순번이 두 벌 들어갈 수 없다. 동시 재제출이 겹치면
        # 여기서 막힌다.
        sa.UniqueConstraint(
            "organization_id",
            "event_id",
            "request_id",
            "item_id",
            "submission_number",
            name=op.f(f"uq_{NAME}_item_submission_number"),
        ),
        # 같은 멱등성 키로 다시 들어오면 새로 쌓지 않는다. 요청 단위 범위다 —
        # 한 번의 재제출이 여러 품목을 함께 담기 때문이다.
        sa.UniqueConstraint(
            "organization_id",
            "event_id",
            "request_id",
            "item_id",
            "idempotency_key",
            name=op.f(f"uq_{NAME}_item_idempotency_key"),
        ),
        # 품목은 조직·행사 범위 안에서만 가리킨다. 다른 조직의 품목에 제출본을
        # 붙일 수 없게 복합 키로 묶는다. 0004가 만든 유니크 제약을 쓴다.
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

    # 품목의 가장 최근 제출본을 읽는 경로다.
    op.create_index(
        op.f(f"ix_{NAME}_item_submitted_at"),
        TABLE,
        ["organization_id", "event_id", "request_id", "item_id", "submitted_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f(f"ix_{NAME}_item_submitted_at"), table_name=TABLE)
    op.drop_table(TABLE)
