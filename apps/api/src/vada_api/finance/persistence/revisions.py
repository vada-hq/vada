from __future__ import annotations

import uuid
from collections.abc import Callable, Mapping
from datetime import UTC, datetime
from decimal import ROUND_HALF_UP, Decimal
from typing import cast

import sqlalchemy as sa
from sqlalchemy import Engine
from sqlalchemy.exc import SQLAlchemyError

from vada_api.finance.application import (
    OtherItemView,
    PurchaseRequestRevisionView,
    RevisionItemView,
)
from vada_api.finance.persistence.schema import (
    purchase_request_item_review_events,
    purchase_request_item_revisions,
    purchase_request_items,
    purchase_requests,
)
from vada_api.finance.review import ItemReviewStatus
from vada_api.finance.revision import RevisionItemState, RevisionSubmission
from vada_api.finance.submission import PurchaseRequestPersistenceError

ITEMS = purchase_request_items
REQUESTS = purchase_requests
REVIEWS = purchase_request_item_review_events
REVISIONS = purchase_request_item_revisions


class PostgreSQLPurchaseRequestRevisionStore:
    """보완 제출본을 추가 전용으로 쌓고 재제출 화면이 볼 것을 읽는다.

    모든 읽기·쓰기에 조직 범위를 선두 조건으로 적용한다. 외래 키가 조직·행사·
    요청·품목을 복합으로 묶고 있어 범위를 벗어난 품목에는 애초에 쓸 수 없지만,
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

    def revision_view(
        self, *, organization_id: str, event_id: str, request_id: str
    ) -> PurchaseRequestRevisionView | None:
        try:
            with self._engine.connect() as connection:
                title = connection.scalar(
                    sa.select(REQUESTS.c.title).where(
                        REQUESTS.c.organization_id == organization_id,
                        REQUESTS.c.event_id == event_id,
                        REQUESTS.c.request_id == request_id,
                    )
                )
                if title is None:
                    return None
                rows = (
                    connection.execute(
                        self._item_statement(organization_id, event_id, request_id)
                    )
                    .mappings()
                    .all()
                )
        except SQLAlchemyError as error:
            raise PurchaseRequestPersistenceError from error

        revision_items: list[RevisionItemView] = []
        other_items: list[OtherItemView] = []
        for row in rows:
            status = _status(row["review_status"])
            if status is ItemReviewStatus.REVISION_REQUESTED:
                reason = row["revision_reason"]
                if not reason:
                    # 보완 요청에는 사유가 반드시 있다. DB 제약이 그것을 지킨다.
                    # 비어 있다면 저장이 깨진 것이므로 지어내지 않는다.
                    raise PurchaseRequestPersistenceError
                revision_items.append(
                    RevisionItemView(
                        item_id=cast(str, row["item_id"]),
                        item_name=cast(str, row["name"]),
                        revision_reason=cast(str, reason),
                        revision_due_date=row["revision_due_date"],
                        content=cast(Mapping[str, object], row["content"] or {}),
                    )
                )
                continue

            other_items.append(
                OtherItemView(
                    item_id=cast(str, row["item_id"]),
                    item_name=cast(str, row["name"]),
                    review_status=status,
                    estimated_total_price=_won(cast(Decimal, row["estimated_amount"])),
                )
            )

        return PurchaseRequestRevisionView(
            request_id=request_id,
            request_title=cast(str, title),
            revision_items=tuple(revision_items),
            other_items=tuple(other_items),
        )

    def item_states(
        self, *, organization_id: str, event_id: str, request_id: str
    ) -> tuple[RevisionItemState, ...]:
        try:
            with self._engine.connect() as connection:
                rows = (
                    connection.execute(
                        self._item_statement(organization_id, event_id, request_id)
                    )
                    .mappings()
                    .all()
                )
        except SQLAlchemyError as error:
            raise PurchaseRequestPersistenceError from error

        return tuple(
            RevisionItemState(
                item_id=cast(str, row["item_id"]),
                review_status=_status(row["review_status"]),
                # 처음 제출한 것이 1번이다. 재제출본이 그 위에 쌓인다.
                submission_count=1 + cast(int, row["revision_count"] or 0),
            )
            for row in rows
        )

    def append(
        self,
        submissions: tuple[RevisionSubmission, ...],
        *,
        organization_id: str,
        event_id: str,
        request_id: str,
        submitted_by_user_id: str,
        idempotency_key: str,
    ) -> None:
        """제출본을 한 트랜잭션에 쌓는다.

        같은 멱등성 키로 다시 들어오면 유니크 제약이 막는다. 재시도가 제출본을
        두 벌 쌓으면 요청자가 낸 적 없는 제출본이 생긴다.
        """
        if not submissions:
            return

        submitted_at = self._clock()
        rows = [
            {
                "revision_id": self._identifier_factory(),
                "organization_id": organization_id,
                "event_id": event_id,
                "request_id": request_id,
                "item_id": submission.item_id,
                "submission_number": submission.submission_number,
                "content": dict(submission.content),
                "submitted_by_user_id": submitted_by_user_id,
                "submitted_at": submitted_at,
                "idempotency_key": idempotency_key,
            }
            for submission in submissions
        ]
        try:
            with self._engine.begin() as connection:
                connection.execute(sa.insert(REVISIONS), rows)
        except SQLAlchemyError as error:
            raise PurchaseRequestPersistenceError from error

    def _item_statement(
        self, organization_id: str, event_id: str, request_id: str
    ) -> sa.Select[tuple[object, ...]]:
        """요청의 품목마다 최신 검토 상태와 최신 제출본을 붙여 읽는다."""

        newest_review = self._newest(
            REVIEWS,
            [
                REVIEWS.c.item_id,
                REVIEWS.c.review_status,
                REVIEWS.c.revision_reason,
                REVIEWS.c.revision_due_date,
            ],
            order=[REVIEWS.c.decided_at.desc(), REVIEWS.c.review_event_id.desc()],
            organization_id=organization_id,
            event_id=event_id,
            request_id=request_id,
        )
        newest_revision = self._newest(
            REVISIONS,
            [REVISIONS.c.item_id, REVISIONS.c.content, REVISIONS.c.submission_number],
            order=[
                REVISIONS.c.submission_number.desc(),
                REVISIONS.c.revision_id.desc(),
            ],
            organization_id=organization_id,
            event_id=event_id,
            request_id=request_id,
        )
        # 제출본이 몇 벌 쌓였는지는 최신 한 벌이 아니라 전체를 세야 안다.
        counted = (
            sa.select(
                REVISIONS.c.item_id,
                sa.func.count().label("revision_count"),
            )
            .where(
                REVISIONS.c.organization_id == organization_id,
                REVISIONS.c.event_id == event_id,
                REVISIONS.c.request_id == request_id,
            )
            .group_by(REVISIONS.c.item_id)
            .subquery()
        )

        return (
            sa.select(
                ITEMS.c.item_id,
                ITEMS.c.name,
                ITEMS.c.estimated_amount,
                newest_review.c.review_status,
                newest_review.c.revision_reason,
                newest_review.c.revision_due_date,
                newest_revision.c.content,
                counted.c.revision_count,
            )
            .select_from(
                ITEMS.outerjoin(
                    newest_review, newest_review.c.item_id == ITEMS.c.item_id
                )
                .outerjoin(
                    newest_revision, newest_revision.c.item_id == ITEMS.c.item_id
                )
                .outerjoin(counted, counted.c.item_id == ITEMS.c.item_id)
            )
            .where(
                ITEMS.c.organization_id == organization_id,
                ITEMS.c.event_id == event_id,
                ITEMS.c.request_id == request_id,
            )
            .order_by(ITEMS.c.item_position)
        )

    def _newest(
        self,
        table: sa.Table,
        columns: list[sa.ColumnElement[object]],
        *,
        order: list[sa.UnaryExpression[object]],
        organization_id: str,
        event_id: str,
        request_id: str,
    ) -> sa.Subquery:
        ranked = (
            sa.select(
                *columns,
                sa.func.row_number()
                .over(partition_by=table.c.item_id, order_by=order)
                .label("recency"),
            )
            .where(
                table.c.organization_id == organization_id,
                table.c.event_id == event_id,
                table.c.request_id == request_id,
            )
            .subquery()
        )
        picked: list[sa.ColumnElement[object]] = [
            cast("sa.ColumnElement[object]", ranked.c[column.name])
            for column in columns
        ]
        return sa.select(*picked).where(ranked.c.recency == 1).subquery()


def _status(value: object) -> ItemReviewStatus:
    """결정 사건이 없는 품목은 검토 대기다. 제출이 그 상태를 만든다."""

    if value is None:
        return ItemReviewStatus.REVIEW_PENDING
    try:
        return ItemReviewStatus(cast(str, value))
    except ValueError as error:
        raise PurchaseRequestPersistenceError from error


def _won(amount: Decimal) -> int:
    return int(Decimal(amount).quantize(Decimal(1), rounding=ROUND_HALF_UP))


def _new_identifier() -> str:
    return str(uuid.uuid4())


def _utc_now() -> datetime:
    return datetime.now(UTC)
