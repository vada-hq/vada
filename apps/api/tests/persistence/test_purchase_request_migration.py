from __future__ import annotations

import json
import os
import shutil
from collections.abc import Iterator
from datetime import date
from decimal import Decimal
from io import StringIO
from pathlib import Path

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


def _insert_request(connection: Connection, suffix: str) -> None:
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
                20000,
                false
            )
            """
        ),
        {"request_id": f"request-{suffix}", "needed_date": date(2026, 8, 10)},
    )


def _insert_item(
    connection: Connection,
    suffix: str,
    *,
    organization_id: str = "org-a",
    item_position: int = 0,
    price_evidence: list[dict[str, str]] | None = None,
    details: dict[str, str] | None = None,
) -> None:
    evidence = price_evidence or [
        {"type": "product_url", "url": "https://example.test/product"}
    ]
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
            "request_id": f"request-{suffix.split('-')[0]}",
            "item_position": item_position,
            "price_evidence": json.dumps(evidence),
            "details": json.dumps(details or {"vendor": "공급처"}),
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
            organization_id="org-b",
            item_position=1,
        )

    with pytest.raises(IntegrityError), migrated_engine.begin() as connection:
        _insert_item(connection, "valid-duplicate-position")

    with pytest.raises(IntegrityError), migrated_engine.begin() as connection:
        _insert_item(
            connection,
            "valid-invalid-evidence",
            item_position=1,
            price_evidence=[{"type": "vendor_quote", "note": "견적"}],
        )

    with pytest.raises(IntegrityError), migrated_engine.begin() as connection:
        _insert_item(
            connection,
            "valid-invalid-details",
            item_position=1,
            details={"unknown": "not-approved"},
        )
