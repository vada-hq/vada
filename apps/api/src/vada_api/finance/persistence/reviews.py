from __future__ import annotations

import uuid
from collections.abc import Callable, Mapping
from datetime import UTC, date, datetime
from typing import cast

import sqlalchemy as sa
from sqlalchemy import Engine
from sqlalchemy.exc import SQLAlchemyError

from vada_api.finance.application import ItemReviewEvent
from vada_api.finance.persistence.schema import (
    purchase_request_item_review_events,
    purchase_request_items,
)
from vada_api.finance.review import ItemReviewState, ItemReviewStatus
from vada_api.finance.submission import PurchaseRequestPersistenceError

REVIEWS = purchase_request_item_review_events
ITEMS = purchase_request_items


class PostgreSQLPurchaseRequestReviewStore:
    """품목 검토 결정을 추가 전용으로 쌓고 최신 사건으로 현재 상태를 읽는다.

    모든 읽기·쓰기에 조직 범위를 선두 조건으로 적용한다. 외래 키가 조직·행사·요청·
    품목을 복합으로 묶고 있어 범위를 벗어난 품목에는 애초에 쓸 수 없지만,
    조회에서도 범위를 빼지 않는다.
    """

    def __init__(
        self,
        engine: Engine,
        *,
        identifier_factory: Callable[[], str] | None = None,
        clock: Callable[[], datetime] | None = None,
    ) -> None:
        self._engine = engine
        self._identifier_factory = identifier_factory or _new_identifier
        self._clock = clock or _utc_now

    def current_states(
        self, *, organization_id: str, event_id: str, request_id: str
    ) -> tuple[ItemReviewState, ...]:
        """요청의 모든 품목에 대해 현재 상태를 돌려준다.

        아직 결정되지 않은 품목도 review_pending으로 존재한다. 계약
        DATA:purchase_request.review_view@R1이 "detail의 품목마다 정확히 하나씩"을
        요구하므로 품목 표를 기준으로 왼쪽 결합한다.
        """

        scope = sa.and_(
            REVIEWS.c.organization_id == organization_id,
            REVIEWS.c.event_id == event_id,
            REVIEWS.c.request_id == request_id,
        )
        # 품목마다 가장 최근 사건 하나. 같은 순간에 두 건이 들어가는 것은 낙관적
        # 잠금이 막지만, 순서를 확정하려고 review_event_id를 보조 정렬에 둔다.
        latest = (
            sa.select(
                REVIEWS.c.item_id,
                REVIEWS.c.review_status,
                REVIEWS.c.revision_reason,
                REVIEWS.c.revision_due_date,
                REVIEWS.c.rejection_reason,
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
            .where(scope)
            .subquery()
        )
        statement = (
            sa.select(
                ITEMS.c.item_id,
                latest.c.review_status,
                latest.c.revision_reason,
                latest.c.revision_due_date,
                latest.c.rejection_reason,
            )
            .select_from(
                ITEMS.outerjoin(
                    latest,
                    sa.and_(latest.c.item_id == ITEMS.c.item_id, latest.c.recency == 1),
                )
            )
            .where(
                ITEMS.c.organization_id == organization_id,
                ITEMS.c.event_id == event_id,
                ITEMS.c.request_id == request_id,
            )
            .order_by(ITEMS.c.item_position)
        )

        try:
            with self._engine.connect() as connection:
                rows = connection.execute(statement).mappings().all()
        except SQLAlchemyError as error:
            raise PurchaseRequestPersistenceError from error

        return tuple(_state_from_row(cast(Mapping[str, object], row)) for row in rows)

    def events(
        self, *, organization_id: str, event_id: str, request_id: str
    ) -> tuple[ItemReviewEvent, ...]:
        """이 요청의 검토 사건을 오래된 것부터 돌려준다. 처리 기록의 재료다."""

        statement = (
            sa.select(
                REVIEWS.c.item_id,
                REVIEWS.c.review_status,
                REVIEWS.c.revision_reason,
                REVIEWS.c.rejection_reason,
                REVIEWS.c.decided_by_user_id,
                REVIEWS.c.decided_at,
            )
            .where(
                REVIEWS.c.organization_id == organization_id,
                REVIEWS.c.event_id == event_id,
                REVIEWS.c.request_id == request_id,
            )
            .order_by(REVIEWS.c.decided_at, REVIEWS.c.review_event_id)
        )

        try:
            with self._engine.connect() as connection:
                rows = connection.execute(statement).mappings().all()
        except SQLAlchemyError as error:
            raise PurchaseRequestPersistenceError from error

        return tuple(_event_from_row(cast(Mapping[str, object], row)) for row in rows)

    def record(
        self,
        state: ItemReviewState,
        *,
        organization_id: str,
        event_id: str,
        request_id: str,
        decided_by_user_id: str,
    ) -> None:
        """결정 하나를 사건으로 남긴다. 이전 사건을 지우거나 고치지 않는다."""

        statement = REVIEWS.insert().values(
            review_event_id=self._identifier_factory(),
            organization_id=organization_id,
            event_id=event_id,
            request_id=request_id,
            item_id=state.item_id,
            review_status=str(state.review_status),
            revision_reason=state.revision_reason,
            revision_due_date=state.revision_due_date,
            rejection_reason=state.rejection_reason,
            decided_by_user_id=decided_by_user_id,
            decided_at=self._clock(),
        )

        try:
            with self._engine.begin() as connection:
                connection.execute(statement)
        except SQLAlchemyError as error:
            raise PurchaseRequestPersistenceError from error


def _state_from_row(row: Mapping[str, object]) -> ItemReviewState:
    raw_status = row["review_status"]
    # 결정이 아직 없는 품목은 왼쪽 결합에서 NULL로 온다. 검토 대기가 그 뜻이다.
    status = (
        ItemReviewStatus(raw_status)
        if isinstance(raw_status, str)
        else ItemReviewStatus.REVIEW_PENDING
    )
    due_date = row["revision_due_date"]
    return ItemReviewState(
        item_id=cast(str, row["item_id"]),
        review_status=status,
        revision_reason=_optional_text(row["revision_reason"]),
        revision_due_date=due_date if isinstance(due_date, date) else None,
        rejection_reason=_optional_text(row["rejection_reason"]),
    )


def _optional_text(value: object) -> str | None:
    return value if isinstance(value, str) else None


def _new_identifier() -> str:
    return str(uuid.uuid4())


def _utc_now() -> datetime:
    return datetime.now(UTC)


def _event_from_row(row: Mapping[str, object]) -> ItemReviewEvent:
    return ItemReviewEvent(
        item_id=cast(str, row["item_id"]),
        review_status=ItemReviewStatus(cast(str, row["review_status"])),
        decided_by_user_id=cast(str, row["decided_by_user_id"]),
        decided_at=cast(datetime, row["decided_at"]),
        revision_reason=_optional_text(row["revision_reason"]),
        rejection_reason=_optional_text(row["rejection_reason"]),
    )
