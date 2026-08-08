from __future__ import annotations

from functools import cache
from io import StringIO
from pathlib import Path

from alembic import command
from alembic.config import Config
from pglast import parse_sql

API_ROOT = Path(__file__).parents[2]

# PostgreSQL 식별자 한도. 넘으면 조용히 잘려 다른 이름과 부딪힌다.
IDENTIFIER_LIMIT = 63

TABLE = "purchase_request_item_revisions"


@cache
def _render_upgrade_ddl() -> str:
    output = StringIO()
    config = Config(str(API_ROOT / "alembic.ini"))
    config.output_buffer = output
    command.upgrade(config, "head", sql=True)
    return output.getvalue()


def test_expand_migration_creates_the_revision_submission_table() -> None:
    ddl = _render_upgrade_ddl()
    parse_sql(ddl)

    assert f"CREATE TABLE {TABLE}" in ddl
    assert "submission_number INTEGER NOT NULL" in ddl
    assert "content JSONB NOT NULL" in ddl
    assert "idempotency_key TEXT NOT NULL" in ddl


def test_a_revision_cannot_point_outside_its_organization_scope() -> None:
    # 다른 조직의 품목에 제출본을 붙일 수 없어야 한다. 복합 외래 키가 그것을 막는다.
    ddl = _render_upgrade_ddl()
    constraint = ddl.split("fk_pr_item_revision_item")[1][:400]

    for column in ("organization_id", "event_id", "request_id", "item_id"):
        assert column in constraint


def test_the_same_item_cannot_hold_two_submissions_with_one_number() -> None:
    # 동시 재제출이 겹치면 여기서 막힌다. 순번이 곧 순서다.
    ddl = _render_upgrade_ddl()

    assert "uq_pr_item_revision_item_submission_number" in ddl
    assert "submission_number >= 1" in ddl


def test_a_retry_with_the_same_key_cannot_stack_a_second_submission() -> None:
    # 재시도가 제출본을 두 벌 쌓으면 요청자가 낸 적 없는 제출본이 생긴다.
    ddl = _render_upgrade_ddl()

    assert "uq_pr_item_revision_item_idempotency_key" in ddl


def test_the_original_item_table_is_not_altered() -> None:
    # 제출된 품목은 불변 기록이다. 보완은 고쳐 쓰는 것이 아니라 쌓는 것이다.
    ddl = _render_upgrade_ddl()

    assert "ALTER TABLE purchase_request_items ADD COLUMN" not in ddl
    assert "ALTER TABLE purchase_request_items DROP COLUMN" not in ddl


def test_every_constraint_name_fits_postgresql_identifier_limit() -> None:
    ddl = _render_upgrade_ddl()

    prefixes = ("ck_", "ix_", "uq_", "fk_", "pk_")
    for line in ddl.splitlines():
        for raw in line.replace("(", " ").replace(")", " ").replace(",", " ").split():
            name = raw.strip('"')
            if name.startswith(prefixes):
                assert len(name) <= IDENTIFIER_LIMIT, name
