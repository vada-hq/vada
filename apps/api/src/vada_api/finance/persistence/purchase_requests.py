from __future__ import annotations

import uuid
from collections.abc import Callable, Mapping
from datetime import UTC, datetime
from decimal import Decimal
from typing import cast

import sqlalchemy as sa
from sqlalchemy import Engine
from sqlalchemy.dialects.postgresql import insert as postgresql_insert
from sqlalchemy.exc import SQLAlchemyError

from vada_api.finance.application import PurchaseRequestDraft, PurchaseRequestSummary
from vada_api.finance.persistence.schema import (
    purchase_request_drafts,
    purchase_requests,
)
from vada_api.finance.persistence.submission import load_purchase_request_record
from vada_api.finance.submission import (
    PurchaseRequestPersistenceError,
    PurchaseRequestRecord,
    PurchaseRequestStateConflictError,
)


class PostgreSQLPurchaseRequestRepository:
    """모든 읽기·쓰기에 조직 범위를 선두 조건으로 적용한다."""

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

    def get_draft(
        self, *, organization_id: str, event_id: str, owner_user_id: str
    ) -> PurchaseRequestDraft | None:
        try:
            with self._engine.connect() as connection:
                row = (
                    connection.execute(
                        sa.select(purchase_request_drafts).where(
                            purchase_request_drafts.c.organization_id
                            == organization_id,
                            purchase_request_drafts.c.event_id == event_id,
                            purchase_request_drafts.c.owner_user_id == owner_user_id,
                        )
                    )
                    .mappings()
                    .one_or_none()
                )
                return (
                    _draft_from_row(cast(Mapping[str, object], row))
                    if row is not None
                    else None
                )
        except SQLAlchemyError as error:
            raise PurchaseRequestPersistenceError from error

    def save_draft(
        self,
        *,
        organization_id: str,
        event_id: str,
        owner_user_id: str,
        expected_version: int | None,
        content: dict[str, object],
    ) -> PurchaseRequestDraft:
        saved_at = self._clock()
        try:
            with self._engine.begin() as connection:
                if expected_version is None:
                    row = (
                        connection.execute(
                            postgresql_insert(purchase_request_drafts)
                            .values(
                                draft_id=self._identifier_factory(),
                                organization_id=organization_id,
                                event_id=event_id,
                                owner_user_id=owner_user_id,
                                version=1,
                                content=content,
                                saved_at=saved_at,
                            )
                            .on_conflict_do_nothing(
                                index_elements=[
                                    purchase_request_drafts.c.organization_id,
                                    purchase_request_drafts.c.event_id,
                                    purchase_request_drafts.c.owner_user_id,
                                ]
                            )
                            .returning(purchase_request_drafts)
                        )
                        .mappings()
                        .one_or_none()
                    )
                else:
                    row = (
                        connection.execute(
                            purchase_request_drafts.update()
                            .where(
                                purchase_request_drafts.c.organization_id
                                == organization_id,
                                purchase_request_drafts.c.event_id == event_id,
                                purchase_request_drafts.c.owner_user_id
                                == owner_user_id,
                                purchase_request_drafts.c.version == expected_version,
                            )
                            .values(
                                version=expected_version + 1,
                                content=content,
                                saved_at=saved_at,
                            )
                            .returning(purchase_request_drafts)
                        )
                        .mappings()
                        .one_or_none()
                    )
                if row is None:
                    raise PurchaseRequestStateConflictError
                return _draft_from_row(cast(Mapping[str, object], row))
        except PurchaseRequestStateConflictError:
            raise
        except SQLAlchemyError as error:
            raise PurchaseRequestPersistenceError from error

    def delete_draft(
        self, *, organization_id: str, event_id: str, owner_user_id: str
    ) -> bool:
        try:
            with self._engine.begin() as connection:
                deleted_id = connection.scalar(
                    purchase_request_drafts.delete()
                    .where(
                        purchase_request_drafts.c.organization_id == organization_id,
                        purchase_request_drafts.c.event_id == event_id,
                        purchase_request_drafts.c.owner_user_id == owner_user_id,
                    )
                    .returning(purchase_request_drafts.c.draft_id)
                )
                return deleted_id is not None
        except SQLAlchemyError as error:
            raise PurchaseRequestPersistenceError from error

    def list_own(
        self, *, organization_id: str, event_id: str, requester_user_id: str
    ) -> tuple[PurchaseRequestSummary, ...]:
        try:
            with self._engine.connect() as connection:
                rows = (
                    connection.execute(
                        sa.select(
                            purchase_requests.c.request_id,
                            purchase_requests.c.title,
                            purchase_requests.c.status,
                            purchase_requests.c.estimated_total,
                            purchase_requests.c.over_budget,
                            purchase_requests.c.created_at,
                        )
                        .where(
                            purchase_requests.c.organization_id == organization_id,
                            purchase_requests.c.event_id == event_id,
                            purchase_requests.c.requester_user_id == requester_user_id,
                        )
                        .order_by(
                            purchase_requests.c.created_at.desc(),
                            purchase_requests.c.request_id.desc(),
                        )
                    )
                    .mappings()
                    .all()
                )
                return tuple(
                    PurchaseRequestSummary(
                        request_id=cast(str, row["request_id"]),
                        title=cast(str, row["title"]),
                        status=cast(str, row["status"]),
                        estimated_total=cast(Decimal, row["estimated_total"]),
                        over_budget=cast(bool, row["over_budget"]),
                        created_at=cast(datetime, row["created_at"]),
                    )
                    for row in rows
                )
        except SQLAlchemyError as error:
            raise PurchaseRequestPersistenceError from error

    def get_detail(
        self, *, organization_id: str, event_id: str, request_id: str
    ) -> PurchaseRequestRecord | None:
        try:
            with self._engine.connect() as connection:
                exists = connection.scalar(
                    sa.select(purchase_requests.c.request_id).where(
                        purchase_requests.c.organization_id == organization_id,
                        purchase_requests.c.event_id == event_id,
                        purchase_requests.c.request_id == request_id,
                    )
                )
                if exists is None:
                    return None
                return load_purchase_request_record(
                    connection,
                    organization_id=organization_id,
                    event_id=event_id,
                    request_id=request_id,
                )
        except SQLAlchemyError as error:
            raise PurchaseRequestPersistenceError from error


def _draft_from_row(row: Mapping[str, object]) -> PurchaseRequestDraft:
    return PurchaseRequestDraft(
        draft_id=cast(str, row["draft_id"]),
        version=cast(int, row["version"]),
        saved_at=cast(datetime, row["saved_at"]),
        content=cast(Mapping[str, object], row["content"]),
    )


def _new_identifier() -> str:
    return uuid.uuid4().hex


def _utc_now() -> datetime:
    return datetime.now(UTC)
