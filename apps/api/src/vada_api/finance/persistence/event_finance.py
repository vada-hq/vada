from __future__ import annotations

from decimal import ROUND_HALF_UP, Decimal
from typing import Protocol, cast

import sqlalchemy as sa
from sqlalchemy import Engine
from sqlalchemy.exc import SQLAlchemyError

from vada_api.finance.event_finance import EventBudgetSummary, EventItemFact
from vada_api.finance.persistence.schema import (
    purchase_request_item_review_events,
    purchase_request_items,
    purchase_requests,
)
from vada_api.finance.review import ItemReviewStatus
from vada_api.finance.submission import PurchaseRequestPersistenceError

ITEMS = purchase_request_items
REQUESTS = purchase_requests
REVIEWS = purchase_request_item_review_events


class EventFinanceNameReader(Protocol):
    """표시 이름만 돌려주는 조직 저장소 포트. 판정에 쓰지 않는다."""

    def find_member_display_names(
        self, *, organization_id: str, user_ids: frozenset[str]
    ) -> dict[str, str]: ...

    def find_department_names(
        self, *, organization_id: str, department_ids: frozenset[str]
    ) -> dict[str, str]: ...


class PostgreSQLEventFinanceReader:
    """행사 하나의 예산 요약과 활성 품목을 읽는다.

    모든 읽기에 조직 범위를 선두 조건으로 적용한다. 경로에서 온 행사 식별자만으로
    조회하지 않는다. 조직은 언제나 신뢰 맥락에서 온 값이다.
    """

    def __init__(self, engine: Engine, *, names: EventFinanceNameReader) -> None:
        self._engine = engine
        self._names = names

    def budget_summary(
        self, *, organization_id: str, event_id: str
    ) -> EventBudgetSummary:
        """배정과 승인 예약을 읽는다.

        배정을 만드는 흐름(총예산 편성)이 MVP 화면 묶음에 없어 배정은 0이다.
        0을 지어낸 값이 아니라 "아직 배정이 없다"는 사실로 다룬다. 계약
        DATA:event_budget.summary@R1의 의미 주석이 그렇게 정한다.
        """

        newest = self._newest_reviews(organization_id, event_id)
        statement = (
            sa.select(sa.func.coalesce(sa.func.sum(ITEMS.c.estimated_amount), 0))
            .select_from(ITEMS.join(newest, newest.c.item_id == ITEMS.c.item_id))
            .where(
                ITEMS.c.organization_id == organization_id,
                ITEMS.c.event_id == event_id,
                newest.c.review_status == ItemReviewStatus.APPROVED.value,
            )
        )
        try:
            with self._engine.connect() as connection:
                committed = connection.execute(statement).scalar_one()
        except SQLAlchemyError as error:
            raise PurchaseRequestPersistenceError from error

        return EventBudgetSummary(
            allocated_total=0,
            committed_total=_won(cast(Decimal | int, committed)),
        )

    def active_items(
        self, *, organization_id: str, event_id: str
    ) -> tuple[EventItemFact, ...]:
        """행사의 모든 품목을 최신 검토 상태와 함께 읽는다.

        아직 결정되지 않은 품목도 review_pending으로 존재하므로 품목 표를
        기준으로 왼쪽 결합한다. 어느 열에 놓을지는 여기서 정하지 않는다.
        """

        newest = self._newest_reviews(organization_id, event_id)
        statement = (
            sa.select(
                ITEMS.c.item_id,
                ITEMS.c.request_id,
                ITEMS.c.name,
                ITEMS.c.estimated_amount,
                REQUESTS.c.requester_user_id,
                REQUESTS.c.request_department_id,
                newest.c.review_status,
            )
            .select_from(
                ITEMS.join(
                    REQUESTS,
                    sa.and_(
                        REQUESTS.c.organization_id == ITEMS.c.organization_id,
                        REQUESTS.c.event_id == ITEMS.c.event_id,
                        REQUESTS.c.request_id == ITEMS.c.request_id,
                    ),
                ).outerjoin(newest, newest.c.item_id == ITEMS.c.item_id)
            )
            .where(
                ITEMS.c.organization_id == organization_id,
                ITEMS.c.event_id == event_id,
            )
            .order_by(ITEMS.c.request_id, ITEMS.c.item_position)
        )
        try:
            with self._engine.connect() as connection:
                rows = connection.execute(statement).mappings().all()
        except SQLAlchemyError as error:
            raise PurchaseRequestPersistenceError from error

        if not rows:
            return ()

        # 이름은 품목마다 묻지 않고 한 번에 읽는다. 같은 사람과 같은 부서가
        # 목록에 여러 번 나오기 때문이다.
        requester_names = self._names.find_member_display_names(
            organization_id=organization_id,
            user_ids=frozenset(cast(str, row["requester_user_id"]) for row in rows),
        )
        department_names = self._names.find_department_names(
            organization_id=organization_id,
            department_ids=frozenset(
                cast(str, row["request_department_id"]) for row in rows
            ),
        )

        facts: list[EventItemFact] = []
        for row in rows:
            requester_user_id = cast(str, row["requester_user_id"])
            department_id = cast(str, row["request_department_id"])
            requester_name = requester_names.get(requester_user_id)
            department_name = department_names.get(department_id)
            if not requester_name or not department_name:
                # 계약이 두 이름에 최소 길이 1을 요구한다. 빈 문자열을 채워
                # 내려보내면 화면이 "이름 없는 사람"을 사실처럼 그린다.
                raise PurchaseRequestPersistenceError

            facts.append(
                EventItemFact(
                    item_id=cast(str, row["item_id"]),
                    request_id=cast(str, row["request_id"]),
                    item_name=cast(str, row["name"]),
                    requester_user_id=requester_user_id,
                    requester_name=requester_name,
                    request_department_name=department_name,
                    estimated_total_price=_won(cast(Decimal, row["estimated_amount"])),
                    review_status=_review_status(row["review_status"]),
                )
            )
        return tuple(facts)

    def _newest_reviews(self, organization_id: str, event_id: str) -> sa.Subquery:
        """품목마다 가장 최근 검토 사건 하나.

        reviews.py의 current_states와 같은 방식이다. 그쪽은 요청 하나를, 여기는
        행사 하나를 본다. 순서를 확정하려고 review_event_id를 보조 정렬에 둔다.
        """

        ranked = (
            sa.select(
                REVIEWS.c.item_id,
                REVIEWS.c.review_status,
                sa.func.row_number()
                .over(
                    partition_by=REVIEWS.c.item_id,
                    order_by=[
                        REVIEWS.c.decided_at.desc(),
                        REVIEWS.c.review_event_id.desc(),
                    ],
                )
                .label("recency"),
            )
            .where(
                REVIEWS.c.organization_id == organization_id,
                REVIEWS.c.event_id == event_id,
            )
            .subquery()
        )
        return (
            sa.select(ranked.c.item_id, ranked.c.review_status)
            .where(ranked.c.recency == 1)
            .subquery()
        )


def _review_status(value: object) -> ItemReviewStatus:
    """결정 사건이 없는 품목은 검토 대기다. 제출이 그 상태를 만든다."""

    if value is None:
        return ItemReviewStatus.REVIEW_PENDING
    try:
        return ItemReviewStatus(cast(str, value))
    except ValueError as error:
        # 저장된 값이 계약의 상태가 아니면 화면이 그릴 수 있는 것이 없다.
        raise PurchaseRequestPersistenceError from error


def _won(amount: Decimal | int) -> int:
    """원 단위 정수로 맞춘다. 원 아래 단위는 통화에 존재하지 않는다."""

    return int(Decimal(amount).quantize(Decimal(1), rounding=ROUND_HALF_UP))
