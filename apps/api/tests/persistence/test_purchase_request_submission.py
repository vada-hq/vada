from __future__ import annotations

import json
from collections.abc import Generator
from concurrent.futures import ThreadPoolExecutor
from contextlib import contextmanager
from dataclasses import replace
from datetime import date
from decimal import Decimal
from threading import Barrier
from typing import Literal

import pytest
import sqlalchemy as sa
from sqlalchemy import Engine, inspect, text

from vada_api.finance.persistence.schema import (
    purchase_request_drafts,
    purchase_request_items,
    purchase_request_submission_events,
    purchase_request_submission_idempotency,
    purchase_requests,
)
from vada_api.finance.persistence.submission import (
    PostgreSQLPurchaseRequestSubmissionStore,
)
from vada_api.finance.submission import (
    DraftReference,
    PurchaseRequestContent,
    PurchaseRequestItemInput,
    PurchaseRequestRecord,
    SubmissionPersistenceError,
    SubmissionStateConflictError,
    ValidatedPurchaseRequestSubmission,
)


@pytest.fixture(autouse=True)
def clean_purchase_request_state(migrated_engine: Engine) -> Generator[None]:
    with migrated_engine.begin() as connection:
        connection.execute(
            text(
                """
                TRUNCATE TABLE
                    purchase_request_submission_events,
                    purchase_request_submission_idempotency,
                    purchase_request_items,
                    purchase_requests,
                    purchase_request_drafts
                CASCADE
                """
            )
        )
    yield
    with migrated_engine.begin() as connection:
        connection.execute(
            text(
                """
                TRUNCATE TABLE
                    purchase_request_submission_events,
                    purchase_request_submission_idempotency,
                    purchase_request_items,
                    purchase_requests,
                    purchase_request_drafts
                CASCADE
                """
            )
        )


def _content(*, title: str = "행사 운영 물품") -> PurchaseRequestContent:
    return PurchaseRequestContent(
        title=title,
        needed_date=date(2026, 8, 20),
        purpose="개강 행사 운영",
        priority="urgent",
        items=(
            PurchaseRequestItemInput(
                name="현수막",
                category="홍보물",
                budget_item="행사운영비",
                purchase_type="general",
                quantity=Decimal(2),
                unit="개",
                estimated_unit_price=Decimal(10000),
                price_evidence=(
                    {
                        "type": "product_url",
                        "url": "https://example.test/banner",
                    },
                ),
                details={"vendor": "공급처 A"},
            ),
            PurchaseRequestItemInput(
                name="진행 용역",
                category="용역",
                budget_item="행사운영비",
                purchase_type="service",
                quantity=Decimal(3),
                unit="시간",
                estimated_unit_price=Decimal(2500),
                price_evidence=({"type": "vendor_quote", "fileRef": "file-quote-a"},),
                details={"provider": "공급처 B"},
            ),
        ),
    )


def _submission(
    *,
    idempotency_key: str = "submit-key-a",
    content: PurchaseRequestContent | None = None,
    with_draft: bool = True,
) -> ValidatedPurchaseRequestSubmission:
    return ValidatedPurchaseRequestSubmission(
        organization_id="organization-a",
        event_id="event-a",
        requester_user_id="user-a",
        request_department_id="department-a",
        idempotency_key=idempotency_key,
        available_budget=Decimal(25000),
        content=content or _content(),
        draft_ref=DraftReference(draft_id="draft-a", version=7) if with_draft else None,
    )


def _seed_draft(engine: Engine) -> None:
    content: dict[str, object] = {
        "title": "행사 운영 물품",
        "neededDate": "2026-08-20",
        "purpose": "개강 행사 운영",
        "priority": "urgent",
        "items": [],
    }
    with engine.begin() as connection:
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
                    'organization-a',
                    'event-a',
                    'user-a',
                    7,
                    CAST(:content AS jsonb)
                )
                """
            ),
            {"content": json.dumps(content)},
        )


_TABLES: dict[str, sa.Table] = {
    purchase_request_drafts.name: purchase_request_drafts,
    purchase_requests.name: purchase_requests,
    purchase_request_items.name: purchase_request_items,
    purchase_request_submission_idempotency.name: (
        purchase_request_submission_idempotency
    ),
    purchase_request_submission_events.name: purchase_request_submission_events,
}


def _table_count(engine: Engine, table_name: str) -> int:
    table = _TABLES[table_name]
    with engine.connect() as connection:
        count = connection.scalar(sa.select(sa.func.count()).select_from(table))
        return int(count or 0)


@pytest.mark.postgres
def test_submission_is_atomic_and_records_server_results(
    migrated_engine: Engine,
) -> None:
    _seed_draft(migrated_engine)

    record = PostgreSQLPurchaseRequestSubmissionStore(migrated_engine).submit(
        _submission()
    )

    assert record.status == "review_pending"
    assert record.estimated_total == Decimal(27500)
    assert record.over_budget is True
    assert [item.estimated_amount for item in record.item_results] == [
        Decimal(20000),
        Decimal(7500),
    ]
    assert _table_count(migrated_engine, "purchase_requests") == 1
    assert _table_count(migrated_engine, "purchase_request_items") == 2
    assert _table_count(migrated_engine, "purchase_request_drafts") == 0
    assert _table_count(migrated_engine, "purchase_request_submission_idempotency") == 1
    assert _table_count(migrated_engine, "purchase_request_submission_events") == 1

    with migrated_engine.connect() as connection:
        event = (
            connection.execute(
                text(
                    """
                SELECT
                    request_id,
                    organization_id,
                    event_id,
                    requester_user_id,
                    request_department_id,
                    estimated_total,
                    over_budget,
                    submitted_at
                FROM purchase_request_submission_events
                """
                )
            )
            .mappings()
            .one()
        )
        idempotency = connection.execute(
            sa.select(
                purchase_request_submission_idempotency.c.idempotency_key_hash,
                purchase_request_submission_idempotency.c.payload_hash,
            )
        ).one()

    assert event["request_id"] == record.request_id
    assert event["organization_id"] == "organization-a"
    assert event["event_id"] == "event-a"
    assert event["requester_user_id"] == "user-a"
    assert event["request_department_id"] == "department-a"
    assert event["estimated_total"] == Decimal(27500)
    assert event["over_budget"] is True
    assert event["submitted_at"].utcoffset() is not None
    assert {
        column["name"]
        for column in inspect(migrated_engine).get_columns(
            "purchase_request_submission_events"
        )
    } == {
        "request_id",
        "organization_id",
        "event_id",
        "requester_user_id",
        "request_department_id",
        "estimated_total",
        "over_budget",
        "submitted_at",
    }
    assert {
        column["name"]
        for column in inspect(migrated_engine).get_columns(
            "purchase_request_submission_idempotency"
        )
    } == {
        "organization_id",
        "event_id",
        "requester_user_id",
        "idempotency_key_hash",
        "payload_hash",
        "request_id",
        "created_at",
    }
    assert "submit-key-a" not in idempotency
    assert len(idempotency.idempotency_key_hash) == 64
    assert len(idempotency.payload_hash) == 64


@pytest.mark.postgres
def test_same_key_concurrent_retries_return_one_request_and_one_event(
    migrated_engine: Engine,
) -> None:
    command = _submission(with_draft=False)
    barrier = Barrier(2)

    def submit_once() -> PurchaseRequestRecord:
        barrier.wait()
        return PostgreSQLPurchaseRequestSubmissionStore(migrated_engine).submit(command)

    with ThreadPoolExecutor(max_workers=2) as executor:
        futures = (executor.submit(submit_once), executor.submit(submit_once))
        records = [future.result() for future in futures]

    assert records[0] == records[1]
    assert _table_count(migrated_engine, "purchase_requests") == 1
    assert _table_count(migrated_engine, "purchase_request_items") == 2
    assert _table_count(migrated_engine, "purchase_request_submission_idempotency") == 1
    assert _table_count(migrated_engine, "purchase_request_submission_events") == 1


@pytest.mark.postgres
def test_same_key_with_different_content_is_a_state_conflict_without_new_state(
    migrated_engine: Engine,
) -> None:
    store = PostgreSQLPurchaseRequestSubmissionStore(migrated_engine)
    first = _submission(with_draft=False)
    store.submit(first)

    changed_content = replace(first.content, title="다른 제출 내용")
    with pytest.raises(SubmissionStateConflictError):
        store.submit(_submission(content=changed_content, with_draft=False))

    assert _table_count(migrated_engine, "purchase_requests") == 1
    assert _table_count(migrated_engine, "purchase_request_items") == 2
    assert _table_count(migrated_engine, "purchase_request_submission_idempotency") == 1
    assert _table_count(migrated_engine, "purchase_request_submission_events") == 1


@pytest.mark.postgres
def test_same_scoped_key_with_different_server_department_is_a_state_conflict(
    migrated_engine: Engine,
) -> None:
    store = PostgreSQLPurchaseRequestSubmissionStore(migrated_engine)
    first = _submission(with_draft=False)
    store.submit(first)

    with pytest.raises(SubmissionStateConflictError):
        store.submit(replace(first, request_department_id="department-b"))

    assert _table_count(migrated_engine, "purchase_requests") == 1
    assert _table_count(migrated_engine, "purchase_request_submission_idempotency") == 1
    assert _table_count(migrated_engine, "purchase_request_submission_events") == 1


@pytest.mark.postgres
def test_same_raw_key_is_independent_across_organization_event_and_requester_scopes(
    migrated_engine: Engine,
) -> None:
    store = PostgreSQLPurchaseRequestSubmissionStore(migrated_engine)
    first = _submission(with_draft=False)
    scoped_submissions = (
        first,
        replace(first, organization_id="organization-b"),
        replace(first, event_id="event-b"),
        replace(first, requester_user_id="user-b"),
    )

    records = tuple(store.submit(submission) for submission in scoped_submissions)

    assert len({record.request_id for record in records}) == 4
    assert _table_count(migrated_engine, "purchase_requests") == 4
    assert _table_count(migrated_engine, "purchase_request_items") == 8
    assert _table_count(migrated_engine, "purchase_request_submission_idempotency") == 4
    assert _table_count(migrated_engine, "purchase_request_submission_events") == 4


FailureStage = Literal["request", "item", "draft", "event"]

_FAILURE_TRIGGER_SQL: dict[FailureStage, str] = {
    "request": """
        CREATE TRIGGER vada_test_fail_submission_request
        AFTER INSERT ON purchase_requests
        FOR EACH ROW EXECUTE FUNCTION vada_test_raise_submission_failure()
    """,
    "item": """
        CREATE TRIGGER vada_test_fail_submission_item
        BEFORE INSERT ON purchase_request_items
        FOR EACH ROW WHEN (NEW.item_position = 1)
        EXECUTE FUNCTION vada_test_raise_submission_failure()
    """,
    "draft": """
        CREATE TRIGGER vada_test_fail_submission_draft
        AFTER DELETE ON purchase_request_drafts
        FOR EACH ROW EXECUTE FUNCTION vada_test_raise_submission_failure()
    """,
    "event": """
        CREATE TRIGGER vada_test_fail_submission_event
        AFTER INSERT ON purchase_request_submission_events
        FOR EACH ROW EXECUTE FUNCTION vada_test_raise_submission_failure()
    """,
}

_FAILURE_TRIGGER_DROP_SQL: dict[FailureStage, str] = {
    "request": "DROP TRIGGER vada_test_fail_submission_request ON purchase_requests",
    "item": "DROP TRIGGER vada_test_fail_submission_item ON purchase_request_items",
    "draft": "DROP TRIGGER vada_test_fail_submission_draft ON purchase_request_drafts",
    "event": (
        "DROP TRIGGER vada_test_fail_submission_event "
        "ON purchase_request_submission_events"
    ),
}


@contextmanager
def _inject_failure(engine: Engine, stage: FailureStage) -> Generator[None]:
    with engine.begin() as connection:
        connection.execute(
            text(
                """
                CREATE FUNCTION vada_test_raise_submission_failure()
                RETURNS trigger
                LANGUAGE plpgsql
                AS $$
                BEGIN
                    RAISE EXCEPTION 'injected submission failure';
                END
                $$
                """
            )
        )
        connection.execute(text(_FAILURE_TRIGGER_SQL[stage]))
    try:
        yield
    finally:
        with engine.begin() as connection:
            connection.execute(text(_FAILURE_TRIGGER_DROP_SQL[stage]))
            connection.execute(
                text("DROP FUNCTION vada_test_raise_submission_failure()")
            )


@pytest.mark.postgres
@pytest.mark.parametrize("stage", ["request", "item", "draft", "event"])
def test_failure_at_each_storage_stage_leaves_no_partial_state_or_early_draft_delete(
    migrated_engine: Engine,
    stage: FailureStage,
) -> None:
    _seed_draft(migrated_engine)

    with (
        _inject_failure(migrated_engine, stage),
        pytest.raises(SubmissionPersistenceError),
    ):
        PostgreSQLPurchaseRequestSubmissionStore(migrated_engine).submit(_submission())

    assert _table_count(migrated_engine, "purchase_request_drafts") == 1
    assert _table_count(migrated_engine, "purchase_requests") == 0
    assert _table_count(migrated_engine, "purchase_request_items") == 0
    assert _table_count(migrated_engine, "purchase_request_submission_idempotency") == 0
    assert _table_count(migrated_engine, "purchase_request_submission_events") == 0


@pytest.mark.postgres
def test_draft_version_conflict_rolls_back_request_items_and_idempotency_claim(
    migrated_engine: Engine,
) -> None:
    _seed_draft(migrated_engine)
    stale_command = replace(
        _submission(),
        draft_ref=DraftReference(draft_id="draft-a", version=6),
    )

    with pytest.raises(SubmissionStateConflictError):
        PostgreSQLPurchaseRequestSubmissionStore(migrated_engine).submit(stale_command)

    assert _table_count(migrated_engine, "purchase_request_drafts") == 1
    assert _table_count(migrated_engine, "purchase_requests") == 0
    assert _table_count(migrated_engine, "purchase_request_items") == 0
    assert _table_count(migrated_engine, "purchase_request_submission_idempotency") == 0
    assert _table_count(migrated_engine, "purchase_request_submission_events") == 0
