from __future__ import annotations

import json
import os
import shutil
from collections.abc import Generator, Iterator
from contextlib import contextmanager
from datetime import date
from decimal import Decimal
from functools import cache
from io import StringIO
from pathlib import Path

import psycopg
import pytest
from alembic import command
from alembic.config import Config
from docker.errors import DockerException
from pglast import parse_sql
from pglast.parser import parse_plpgsql_json
from sqlalchemy import Connection, Engine, create_engine, inspect, text
from sqlalchemy.exc import IntegrityError
from testcontainers.community.postgres import PostgresContainer

API_ROOT = Path(__file__).parents[2]


def _alembic_config(database_url: str | None = None) -> Config:
    config = Config(str(API_ROOT / "alembic.ini"))
    if database_url is not None:
        config.set_main_option("sqlalchemy.url", database_url.replace("%", "%%"))
    return config


@cache
def _render_upgrade_ddl() -> str:
    output = StringIO()
    config = _alembic_config()
    config.output_buffer = output
    command.upgrade(config, "head", sql=True)
    return output.getvalue()


def test_expand_migration_renders_purchase_request_postgresql_schema() -> None:
    ddl = _render_upgrade_ddl()
    parse_sql(ddl)
    parse_plpgsql_json(ddl)

    expected_fragments = [
        "CREATE TABLE purchase_request_drafts",
        "CREATE TABLE purchase_requests",
        "CREATE TABLE purchase_request_items",
        "ck_purchase_request_drafts_content_v1",
        "uq_purchase_request_drafts_scope",
        "ck_purchase_requests_review_pending",
        "ix_purchase_requests_own_recent",
        "fk_purchase_request_items_request_scope",
        "uq_purchase_request_items_position",
        "ck_purchase_request_items_contract_v1",
        "TIMESTAMP WITH TIME ZONE",
    ]
    for fragment in expected_fragments:
        assert fragment in ddl

    upgrade_sql = ddl.upper()
    assert "DROP TABLE" not in upgrade_sql
    assert "DROP COLUMN" not in upgrade_sql
    assert "RENAME COLUMN" not in upgrade_sql


def test_expand_migration_prohibits_purchase_item_reparenting() -> None:
    ddl = _render_upgrade_ddl()

    expected_fragments = [
        "CREATE FUNCTION vada_purchase_request_item_r1_prevent_reparenting()",
        "OLD.organization_id IS DISTINCT FROM NEW.organization_id",
        "OLD.event_id IS DISTINCT FROM NEW.event_id",
        "OLD.request_id IS DISTINCT FROM NEW.request_id",
        "CONSTRAINT = 'ck_purchase_request_items_parent_immutable'",
        "CREATE TRIGGER purchase_request_items_prevent_reparenting",
    ]
    for fragment in expected_fragments:
        assert fragment in ddl


@pytest.fixture(scope="module")
def postgres_url() -> Iterator[str]:
    explicit_url = os.getenv("VADA_TEST_DATABASE_URL")
    if explicit_url:
        yield explicit_url
        return

    if shutil.which("docker") is None:
        pytest.skip(
            "PostgreSQL integration blocked: set VADA_TEST_DATABASE_URL to a "
            "disposable empty database or install Docker with a running daemon."
        )

    try:
        with PostgresContainer("postgres:17-alpine", driver="psycopg") as postgres:
            yield postgres.get_connection_url()
    except DockerException as error:
        pytest.skip(f"PostgreSQL integration blocked by Docker: {error}")


@pytest.fixture(scope="module")
def migrated_engine(postgres_url: str) -> Iterator[Engine]:
    engine = create_engine(postgres_url)
    existing_tables = set(inspect(engine).get_table_names())
    assert not existing_tables, (
        "VADA_TEST_DATABASE_URL must point to a disposable empty PostgreSQL database; "
        f"found {sorted(existing_tables)}"
    )

    command.upgrade(_alembic_config(postgres_url), "head")
    try:
        yield engine
    finally:
        engine.dispose()


@contextmanager
def _raises_constraint(constraint_name: str) -> Generator[None]:
    with pytest.raises(IntegrityError) as caught:
        yield

    original_error = caught.value.orig
    assert isinstance(original_error, psycopg.Error)
    assert original_error.diag.constraint_name == constraint_name


def _insert_request(
    connection: Connection,
    suffix: str,
    *,
    estimated_total: int = 20000,
) -> None:
    connection.execute(
        text(
            """
            INSERT INTO purchase_requests (
                request_id,
                organization_id,
                event_id,
                requester_user_id,
                request_department_id,
                title,
                needed_date,
                purpose,
                priority,
                status,
                estimated_total,
                over_budget
            )
            VALUES (
                :request_id,
                'org-a',
                'event-a',
                'user-a',
                'department-a',
                '행사 물품 구매',
                :needed_date,
                '행사 운영',
                'normal',
                'review_pending',
                :estimated_total,
                false
            )
            """
        ),
        {
            "request_id": f"request-{suffix}",
            "needed_date": date(2026, 8, 10),
            "estimated_total": estimated_total,
        },
    )


def _insert_item(
    connection: Connection,
    suffix: str,
    *,
    request_suffix: str | None = None,
    organization_id: str = "org-a",
    item_position: int = 0,
    price_evidence: list[dict[str, str]] | None = None,
    details: dict[str, str] | None = None,
) -> None:
    evidence = (
        [{"type": "product_url", "url": "https://example.test/product"}]
        if price_evidence is None
        else price_evidence
    )
    details_value = {"vendor": "공급처"} if details is None else details
    connection.execute(
        text(
            """
            INSERT INTO purchase_request_items (
                item_id,
                organization_id,
                event_id,
                request_id,
                item_position,
                name,
                category,
                budget_item,
                purchase_type,
                quantity,
                unit,
                estimated_unit_price,
                price_evidence,
                details
            )
            VALUES (
                :item_id,
                :organization_id,
                'event-a',
                :request_id,
                :item_position,
                '현수막',
                '홍보물',
                '행사운영비',
                'general',
                2,
                '개',
                10000,
                CAST(:price_evidence AS jsonb),
                CAST(:details AS jsonb)
            )
            """
        ),
        {
            "item_id": f"item-{suffix}",
            "organization_id": organization_id,
            "request_id": f"request-{request_suffix or suffix}",
            "item_position": item_position,
            "price_evidence": json.dumps(evidence),
            "details": json.dumps(details_value),
        },
    )


@pytest.mark.postgres
def test_empty_postgresql_migration_enforces_purchase_request_contract(
    migrated_engine: Engine,
) -> None:
    inspector = inspect(migrated_engine)
    assert {
        "alembic_version",
        "purchase_request_drafts",
        "purchase_request_items",
        "purchase_requests",
    } <= set(inspector.get_table_names())

    with migrated_engine.connect() as connection:
        timestamp_columns = dict(
            connection.execute(
                text(
                    """
                    SELECT column_name, data_type
                    FROM information_schema.columns
                    WHERE table_schema = 'public'
                      AND table_name IN (
                          'purchase_request_drafts',
                          'purchase_requests'
                      )
                      AND column_name IN ('saved_at', 'created_at')
                    """
                )
            ).tuples()
        )
    assert timestamp_columns == {
        "saved_at": "TIMESTAMP WITH TIME ZONE",
        "created_at": "TIMESTAMP WITH TIME ZONE",
    }

    with migrated_engine.begin() as connection:
        connection.execute(
            text(
                """
                INSERT INTO purchase_request_drafts (
                    draft_id,
                    organization_id,
                    event_id,
                    owner_user_id,
                    version,
                    content
                )
                VALUES (
                    'draft-a',
                    'org-a',
                    'event-a',
                    'user-a',
                    1,
                    CAST(:content AS jsonb)
                )
                """
            ),
            {"content": json.dumps({"items": [{}]})},
        )
        connection.execute(
            text(
                """
                INSERT INTO purchase_request_drafts (
                    draft_id,
                    organization_id,
                    event_id,
                    owner_user_id,
                    version,
                    content
                )
                VALUES ('draft-b', 'org-b', 'event-a', 'user-a', 1, '{}'::jsonb)
                """
            )
        )

    with pytest.raises(IntegrityError), migrated_engine.begin() as connection:
        connection.execute(
            text(
                """
                INSERT INTO purchase_request_drafts (
                    draft_id,
                    organization_id,
                    event_id,
                    owner_user_id,
                    version,
                    content
                )
                VALUES (
                    'draft-duplicate',
                    'org-a',
                    'event-a',
                    'user-a',
                    1,
                    '{}'::jsonb
                )
                """
            )
        )

    invalid_drafts: list[tuple[str, int, object]] = [
        ("draft-bad-version", 0, {}),
        ("draft-bad-root", 1, []),
        ("draft-bad-field", 1, {"unknown": True}),
        ("draft-bad-item", 1, {"items": [{"unknown": True}]}),
    ]
    for draft_id, version, content in invalid_drafts:
        with pytest.raises(IntegrityError), migrated_engine.begin() as connection:
            connection.execute(
                text(
                    """
                    INSERT INTO purchase_request_drafts (
                        draft_id,
                        organization_id,
                        event_id,
                        owner_user_id,
                        version,
                        content
                    )
                    VALUES (
                        :draft_id,
                        'org-a',
                        :event_id,
                        'user-a',
                        :version,
                        CAST(:content AS jsonb)
                    )
                    """
                ),
                {
                    "draft_id": draft_id,
                    "event_id": draft_id,
                    "version": version,
                    "content": json.dumps(content),
                },
            )

    with migrated_engine.begin() as connection:
        _insert_request(connection, "valid")
        _insert_item(connection, "valid")

    with migrated_engine.connect() as connection:
        first_item_id = connection.scalar(
            text(
                """
                SELECT item_id
                FROM purchase_request_items
                WHERE organization_id = 'org-a'
                  AND event_id = 'event-a'
                  AND request_id = 'request-valid'
                  AND item_position = 0
                """
            )
        )
        second_item_id = connection.scalar(
            text(
                """
                SELECT item_id
                FROM purchase_request_items
                WHERE organization_id = 'org-a'
                  AND event_id = 'event-a'
                  AND request_id = 'request-valid'
                  AND item_position = 0
                """
            )
        )
        estimated_amount = connection.scalar(
            text(
                """
                SELECT estimated_amount
                FROM purchase_request_items
                WHERE item_id = 'item-valid'
                """
            )
        )

    assert first_item_id == second_item_id == "item-valid"
    assert estimated_amount == Decimal(20000)

    with pytest.raises(IntegrityError), migrated_engine.begin() as connection:
        _insert_request(connection, "without-item")

    with pytest.raises(IntegrityError), migrated_engine.begin() as connection:
        _insert_item(
            connection,
            "valid-cross-org",
            request_suffix="valid",
            organization_id="org-b",
            item_position=1,
        )

    with pytest.raises(IntegrityError), migrated_engine.begin() as connection:
        _insert_item(
            connection,
            "valid-duplicate-position",
            request_suffix="valid",
        )

    with (
        _raises_constraint("ck_purchase_request_items_contract_v1"),
        migrated_engine.begin() as connection,
    ):
        _insert_request(connection, "invalid-evidence")
        _insert_item(
            connection,
            "invalid-evidence",
            price_evidence=[{"type": "vendor_quote", "note": "견적"}],
        )

    with (
        _raises_constraint("ck_purchase_request_items_contract_v1"),
        migrated_engine.begin() as connection,
    ):
        _insert_request(connection, "invalid-details")
        _insert_item(
            connection,
            "invalid-details",
            details={"unknown": "not-approved"},
        )


@pytest.mark.postgres
def test_purchase_request_item_cannot_be_reparented_without_old_scope_validation(
    migrated_engine: Engine,
) -> None:
    with migrated_engine.begin() as connection:
        _insert_request(connection, "parent-a")
        _insert_item(connection, "parent-a")
        _insert_request(connection, "parent-b")
        _insert_item(connection, "parent-b")

    with (
        _raises_constraint("ck_purchase_request_items_parent_immutable"),
        migrated_engine.begin() as connection,
    ):
        connection.execute(
            text(
                """
                UPDATE purchase_requests
                SET estimated_total = 40000
                WHERE organization_id = 'org-a'
                  AND event_id = 'event-a'
                  AND request_id = 'request-parent-b'
                """
            )
        )
        connection.execute(
            text(
                """
                UPDATE purchase_request_items
                SET request_id = 'request-parent-b', item_position = 1
                WHERE organization_id = 'org-a'
                  AND event_id = 'event-a'
                  AND request_id = 'request-parent-a'
                  AND item_id = 'item-parent-a'
                """
            )
        )
