"""구매 요청 제출 멱등성과 최소 이벤트 기록 구조를 확장한다.

Revision ID: 20260804_0002
Revises: 20260803_0001
Create Date: 2026-08-04
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260804_0002"
down_revision: str | None = "20260803_0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# 기존 R1 테이블을 변경하지 않고 제출 저장 경계에 필요한 구조만 추가한다.
phase: str = "expand"


def upgrade() -> None:
    op.create_table(
        "purchase_request_submission_idempotency",
        sa.Column("organization_id", sa.Text(), nullable=False),
        sa.Column("event_id", sa.Text(), nullable=False),
        sa.Column("requester_user_id", sa.Text(), nullable=False),
        sa.Column("idempotency_key_hash", sa.Text(), nullable=False),
        sa.Column("payload_hash", sa.Text(), nullable=False),
        sa.Column("request_id", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "char_length(organization_id) > 0",
            name=op.f(
                "ck_purchase_request_submission_idempotency_organization_id_non_empty"
            ),
        ),
        sa.CheckConstraint(
            "char_length(event_id) > 0",
            name=op.f("ck_purchase_request_submission_idempotency_event_id_non_empty"),
        ),
        sa.CheckConstraint(
            "char_length(requester_user_id) > 0",
            name=op.f(
                "ck_purchase_request_submission_idempotency_requester_user_id_non_empty"
            ),
        ),
        sa.CheckConstraint(
            "idempotency_key_hash ~ '^[0-9a-f]{64}$'",
            name=op.f(
                "ck_purchase_request_submission_idempotency_idempotency_key_hash_sha256"
            ),
        ),
        sa.CheckConstraint(
            "payload_hash ~ '^[0-9a-f]{64}$'",
            name=op.f("ck_purchase_request_submission_idempotency_payload_hash_sha256"),
        ),
        sa.CheckConstraint(
            "char_length(request_id) > 0",
            name=op.f(
                "ck_purchase_request_submission_idempotency_request_id_non_empty"
            ),
        ),
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
        sa.PrimaryKeyConstraint(
            "organization_id",
            "event_id",
            "requester_user_id",
            "idempotency_key_hash",
            name="pk_purchase_request_submission_idempotency",
        ),
        sa.UniqueConstraint(
            "request_id",
            name="uq_purchase_request_submission_idempotency_request_id",
        ),
    )

    op.create_table(
        "purchase_request_submission_events",
        sa.Column("request_id", sa.Text(), nullable=False),
        sa.Column("organization_id", sa.Text(), nullable=False),
        sa.Column("event_id", sa.Text(), nullable=False),
        sa.Column("requester_user_id", sa.Text(), nullable=False),
        sa.Column("request_department_id", sa.Text(), nullable=False),
        sa.Column("estimated_total", sa.Numeric(), nullable=False),
        sa.Column("over_budget", sa.Boolean(), nullable=False),
        sa.Column(
            "submitted_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "char_length(request_id) > 0",
            name=op.f("ck_purchase_request_submission_events_request_id_non_empty"),
        ),
        sa.CheckConstraint(
            "char_length(organization_id) > 0",
            name=op.f(
                "ck_purchase_request_submission_events_organization_id_non_empty"
            ),
        ),
        sa.CheckConstraint(
            "char_length(event_id) > 0",
            name=op.f("ck_purchase_request_submission_events_event_id_non_empty"),
        ),
        sa.CheckConstraint(
            "char_length(requester_user_id) > 0",
            name=op.f(
                "ck_purchase_request_submission_events_requester_user_id_non_empty"
            ),
        ),
        sa.CheckConstraint(
            "char_length(request_department_id) > 0",
            name=op.f(
                "ck_purchase_request_submission_events_request_department_id_non_empty"
            ),
        ),
        sa.CheckConstraint(
            "estimated_total > 0",
            name=op.f("ck_purchase_request_submission_events_estimated_total_positive"),
        ),
        sa.ForeignKeyConstraint(
            ["organization_id", "event_id", "request_id"],
            [
                "purchase_requests.organization_id",
                "purchase_requests.event_id",
                "purchase_requests.request_id",
            ],
            name="fk_purchase_request_submission_events_request_scope",
        ),
        sa.PrimaryKeyConstraint(
            "request_id",
            name="pk_purchase_request_submission_events",
        ),
    )


def downgrade() -> None:
    op.drop_table("purchase_request_submission_events")
    op.drop_table("purchase_request_submission_idempotency")
