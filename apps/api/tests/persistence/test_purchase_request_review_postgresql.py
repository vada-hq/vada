from __future__ import annotations

from datetime import UTC, date, datetime
from itertools import count

import pytest
import sqlalchemy as sa
from sqlalchemy import Engine
from sqlalchemy.exc import IntegrityError

from vada_api.finance.persistence.reviews import PostgreSQLPurchaseRequestReviewStore
from vada_api.finance.persistence.schema import (
    purchase_request_item_review_events,
    purchase_request_items,
    purchase_requests,
)
from vada_api.finance.review import ItemReviewState, ItemReviewStatus

REVIEWS = purchase_request_item_review_events
ITEMS = purchase_request_items
REQUESTS = purchase_requests

ORGANIZATION = "organization-a"
EVENT = "event-a"
REQUEST = "request-a"


@pytest.fixture
def clean_reviews(migrated_engine: Engine) -> None:
    with migrated_engine.begin() as connection:
        connection.execute(sa.delete(REVIEWS))
        connection.execute(sa.delete(ITEMS))
        connection.execute(sa.delete(REQUESTS))


ITEM_AMOUNT = 10_000  # 수량 5에 단가 2000. 지연 제약이 요청 합계와 일치를 요구한다.


def _seed_items(engine: Engine, *item_ids: str) -> None:
    """검토 대상 품목과 그 부모 요청을 넣는다.

    검토 저장소는 요청 표를 보지 않지만 DB는 본다. 지연 제약 트리거
    vada_purchase_request_r1_assert_item_aggregate가 요청의 estimated_total과
    품목 금액 합계가 같기를 요구하므로 부모 없이 품목만 넣을 수 없다.
    """

    with engine.begin() as connection:
        connection.execute(
            sa.text(
                """
                INSERT INTO purchase_requests (
                    request_id, organization_id, event_id, requester_user_id,
                    request_department_id, title, needed_date, purpose, priority,
                    status, estimated_total, over_budget
                ) VALUES (
                    :request_id, :organization_id, :event_id, 'user-requester',
                    'department-a', '체육대회 운영 물품', DATE '2026-08-21',
                    '행사 운영', 'normal', 'review_pending', :estimated_total, false
                )
                """
            ),
            {
                "request_id": REQUEST,
                "organization_id": ORGANIZATION,
                "event_id": EVENT,
                "estimated_total": ITEM_AMOUNT * len(item_ids),
            },
        )
        for position, item_id in enumerate(item_ids, start=1):
            connection.execute(
                sa.text(
                    """
                    INSERT INTO purchase_request_items (
                        item_id, organization_id, event_id, request_id,
                        item_position, name, category, budget_item, purchase_type,
                        quantity, unit, estimated_unit_price, price_evidence, details
                    ) VALUES (
                        :item_id, :organization_id, :event_id, :request_id,
                        :position, '박스테이프', '운영 물품', '행사 운영비',
                        'general', 5, '개', 2000,
                        '[{"type": "product_url", "url": "https://example.test/tape"}]'::jsonb,
                        '{}'::jsonb
                    )
                    """
                ),
                {
                    "item_id": item_id,
                    "organization_id": ORGANIZATION,
                    "event_id": EVENT,
                    "request_id": REQUEST,
                    "position": position,
                },
            )


def _store(engine: Engine) -> PostgreSQLPurchaseRequestReviewStore:
    identifiers = count(1)
    moments = count(0)
    return PostgreSQLPurchaseRequestReviewStore(
        engine,
        identifier_factory=lambda: f"review-{next(identifiers):03d}",
        clock=lambda: datetime(2026, 8, 7, 12, next(moments), tzinfo=UTC),
    )


def _scope() -> dict[str, str]:
    return {
        "organization_id": ORGANIZATION,
        "event_id": EVENT,
        "request_id": REQUEST,
        "decided_by_user_id": "user-finance",
    }


@pytest.mark.postgres
@pytest.mark.usefixtures("clean_reviews")
def test_undecided_items_read_as_review_pending(migrated_engine: Engine) -> None:
    # 계약은 detail의 품목마다 상태가 정확히 하나씩 있기를 요구한다.
    _seed_items(migrated_engine, "item-a", "item-b")

    states = _store(migrated_engine).current_states(
        organization_id=ORGANIZATION, event_id=EVENT, request_id=REQUEST
    )

    assert [state.item_id for state in states] == ["item-a", "item-b"]
    assert all(
        state.review_status is ItemReviewStatus.REVIEW_PENDING for state in states
    )


@pytest.mark.postgres
@pytest.mark.usefixtures("clean_reviews")
def test_current_state_is_the_latest_event_and_earlier_ones_survive(
    migrated_engine: Engine,
) -> None:
    _seed_items(migrated_engine, "item-a")
    store = _store(migrated_engine)
    scope = _scope()

    store.record(
        ItemReviewState(
            "item-a",
            ItemReviewStatus.REVISION_REQUESTED,
            revision_reason="가격 근거가 없습니다.",
            revision_due_date=date(2026, 8, 20),
        ),
        **scope,
    )
    store.record(ItemReviewState("item-a", ItemReviewStatus.APPROVED), **scope)

    (state,) = store.current_states(
        organization_id=ORGANIZATION, event_id=EVENT, request_id=REQUEST
    )
    assert state.review_status is ItemReviewStatus.APPROVED
    assert state.revision_reason is None

    # 추가 전용이다. 앞선 결정을 지우거나 고치지 않는다.
    with migrated_engine.connect() as connection:
        stored = connection.scalar(sa.select(sa.func.count()).select_from(REVIEWS))
    assert stored == 2


@pytest.mark.postgres
@pytest.mark.usefixtures("clean_reviews")
def test_another_organization_cannot_see_or_touch_the_decision(
    migrated_engine: Engine,
) -> None:
    _seed_items(migrated_engine, "item-a")
    store = _store(migrated_engine)
    store.record(ItemReviewState("item-a", ItemReviewStatus.APPROVED), **_scope())

    # 다른 조직으로 읽으면 아무것도 보이지 않는다. 품목의 존재조차 드러나지 않는다.
    assert (
        store.current_states(
            organization_id="organization-b", event_id=EVENT, request_id=REQUEST
        )
        == ()
    )

    # 다른 조직으로 쓰면 외래 키가 막는다. 조직 격리는 DB가 보장한다.
    with pytest.raises(Exception) as failure:
        store.record(
            ItemReviewState(
                "item-a", ItemReviewStatus.REJECTED, rejection_reason="불가"
            ),
            organization_id="organization-b",
            event_id=EVENT,
            request_id=REQUEST,
            decided_by_user_id="user-other",
        )
    assert failure.value.__cause__ is not None


@pytest.mark.postgres
@pytest.mark.usefixtures("clean_reviews")
def test_database_refuses_a_decision_whose_fields_do_not_match(
    migrated_engine: Engine,
) -> None:
    # review.py가 이미 막지만 DB도 막아야 한다. 승인 행에 보완 사유가 들어간
    # 데이터는 애초에 존재하면 안 된다.
    _seed_items(migrated_engine, "item-a")

    with pytest.raises(IntegrityError), migrated_engine.begin() as connection:
        connection.execute(
            REVIEWS.insert().values(
                review_event_id="review-bad",
                organization_id=ORGANIZATION,
                event_id=EVENT,
                request_id=REQUEST,
                item_id="item-a",
                review_status="approved",
                revision_reason="딸려 온 사유",
                revision_due_date=date(2026, 8, 20),
                decided_by_user_id="user-finance",
                decided_at=datetime(2026, 8, 7, 12, 0, tzinfo=UTC),
            )
        )


@pytest.mark.postgres
@pytest.mark.usefixtures("clean_reviews")
def test_database_refuses_a_status_outside_the_contract(
    migrated_engine: Engine,
) -> None:
    _seed_items(migrated_engine, "item-a")

    with pytest.raises(IntegrityError), migrated_engine.begin() as connection:
        connection.execute(
            REVIEWS.insert().values(
                review_event_id="review-bad",
                organization_id=ORGANIZATION,
                event_id=EVENT,
                request_id=REQUEST,
                item_id="item-a",
                review_status="partially_approved",
                decided_by_user_id="user-finance",
                decided_at=datetime(2026, 8, 7, 12, 0, tzinfo=UTC),
            )
        )
