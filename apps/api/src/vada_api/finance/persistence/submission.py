from __future__ import annotations

import hashlib
import hmac
import json
import uuid
from collections.abc import Callable, Mapping
from datetime import UTC, date, datetime
from decimal import Decimal
from typing import cast

import sqlalchemy as sa
from sqlalchemy import Connection, Engine
from sqlalchemy.dialects.postgresql import insert as postgresql_insert
from sqlalchemy.exc import SQLAlchemyError

from vada_api.finance.persistence.schema import (
    purchase_request_drafts,
    purchase_request_items,
    purchase_request_submission_events,
    purchase_request_submission_idempotency,
    purchase_requests,
)
from vada_api.finance.submission import (
    PurchaseRequestContent,
    PurchaseRequestItemInput,
    PurchaseRequestItemResult,
    PurchaseRequestRecord,
    PurchaseRequestSubmissionOutcome,
    SubmissionPersistenceError,
    SubmissionStateConflictError,
    ValidatedPurchaseRequestSubmission,
)

type JsonScalar = str | int | float | bool | None
type JsonValue = JsonScalar | list[JsonValue] | dict[str, JsonValue]


class PostgreSQLPurchaseRequestSubmissionStore:
    """요청·품목·초안 제거·제출 이벤트를 한 PostgreSQL 트랜잭션에 둔다."""

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

    def get_idempotent_result(
        self,
        submission: ValidatedPurchaseRequestSubmission,
    ) -> PurchaseRequestRecord | None:
        try:
            with self._engine.connect() as connection:
                return _load_existing_submission(
                    connection,
                    submission=submission,
                    idempotency_key_hash=_sha256_text(submission.idempotency_key),
                    payload_hash=_submission_payload_hash(submission),
                )
        except SubmissionStateConflictError:
            raise
        except SQLAlchemyError as error:
            raise SubmissionPersistenceError from error

    def submit(
        self,
        submission: ValidatedPurchaseRequestSubmission,
    ) -> PurchaseRequestSubmissionOutcome:
        estimated_amounts = tuple(
            item.quantity * item.estimated_unit_price
            for item in submission.content.items
        )
        estimated_total = sum(estimated_amounts, start=Decimal(0))
        request_id = self._identifier_factory()
        item_ids = tuple(self._identifier_factory() for _ in submission.content.items)
        created_at = self._clock()
        idempotency_key_hash = _sha256_text(submission.idempotency_key)
        payload_hash = _submission_payload_hash(submission)

        try:
            with self._engine.begin() as connection:
                claimed_request_id = connection.scalar(
                    postgresql_insert(purchase_request_submission_idempotency)
                    .values(
                        organization_id=submission.organization_id,
                        event_id=submission.event_id,
                        requester_user_id=submission.requester_user_id,
                        idempotency_key_hash=idempotency_key_hash,
                        payload_hash=payload_hash,
                        request_id=request_id,
                        created_at=created_at,
                    )
                    .on_conflict_do_nothing(
                        index_elements=[
                            purchase_request_submission_idempotency.c.organization_id,
                            purchase_request_submission_idempotency.c.event_id,
                            purchase_request_submission_idempotency.c.requester_user_id,
                            purchase_request_submission_idempotency.c.idempotency_key_hash,
                        ]
                    )
                    .returning(purchase_request_submission_idempotency.c.request_id)
                )
                if claimed_request_id is None:
                    return PurchaseRequestSubmissionOutcome(
                        record=_return_existing_submission(
                            connection,
                            submission=submission,
                            idempotency_key_hash=idempotency_key_hash,
                            payload_hash=payload_hash,
                        ),
                        replayed=True,
                    )

                connection.execute(
                    purchase_requests.insert().values(
                        request_id=request_id,
                        organization_id=submission.organization_id,
                        event_id=submission.event_id,
                        requester_user_id=submission.requester_user_id,
                        request_department_id=submission.request_department_id,
                        title=submission.content.title,
                        needed_date=submission.content.needed_date,
                        purpose=submission.content.purpose,
                        priority=submission.content.priority,
                        status="review_pending",
                        estimated_total=estimated_total,
                        over_budget=estimated_total > submission.available_budget,
                        created_at=created_at,
                    )
                )
                for position, (item, item_id) in enumerate(
                    zip(submission.content.items, item_ids, strict=True)
                ):
                    connection.execute(
                        purchase_request_items.insert().values(
                            item_id=item_id,
                            organization_id=submission.organization_id,
                            event_id=submission.event_id,
                            request_id=request_id,
                            item_position=position,
                            name=item.name,
                            category=item.category,
                            budget_item=item.budget_item,
                            purchase_type=item.purchase_type,
                            quantity=item.quantity,
                            unit=item.unit,
                            estimated_unit_price=item.estimated_unit_price,
                            price_evidence=_materialize_json(item.price_evidence),
                            details=_materialize_json(item.details),
                        )
                    )

                if submission.draft_ref is not None:
                    deleted = connection.execute(
                        purchase_request_drafts.delete().where(
                            purchase_request_drafts.c.organization_id
                            == submission.organization_id,
                            purchase_request_drafts.c.event_id == submission.event_id,
                            purchase_request_drafts.c.owner_user_id
                            == submission.requester_user_id,
                            purchase_request_drafts.c.draft_id
                            == submission.draft_ref.draft_id,
                            purchase_request_drafts.c.version
                            == submission.draft_ref.version,
                        )
                    )
                    if deleted.rowcount != 1:
                        raise SubmissionStateConflictError

                connection.execute(
                    purchase_request_submission_events.insert().values(
                        request_id=request_id,
                        organization_id=submission.organization_id,
                        event_id=submission.event_id,
                        requester_user_id=submission.requester_user_id,
                        request_department_id=submission.request_department_id,
                        estimated_total=estimated_total,
                        over_budget=estimated_total > submission.available_budget,
                        submitted_at=created_at,
                    )
                )
                return PurchaseRequestSubmissionOutcome(
                    record=load_purchase_request_record(
                        connection,
                        organization_id=submission.organization_id,
                        event_id=submission.event_id,
                        request_id=request_id,
                    ),
                    replayed=False,
                )
        except SubmissionStateConflictError:
            raise
        except SQLAlchemyError as error:
            raise SubmissionPersistenceError from error


def _return_existing_submission(
    connection: Connection,
    *,
    submission: ValidatedPurchaseRequestSubmission,
    idempotency_key_hash: str,
    payload_hash: str,
) -> PurchaseRequestRecord:
    record = _load_existing_submission(
        connection,
        submission=submission,
        idempotency_key_hash=idempotency_key_hash,
        payload_hash=payload_hash,
    )
    if record is None:
        raise SubmissionPersistenceError
    return record


def _load_existing_submission(
    connection: Connection,
    *,
    submission: ValidatedPurchaseRequestSubmission,
    idempotency_key_hash: str,
    payload_hash: str,
) -> PurchaseRequestRecord | None:
    existing = connection.execute(
        sa.select(
            purchase_request_submission_idempotency.c.payload_hash,
            purchase_request_submission_idempotency.c.request_id,
        ).where(
            purchase_request_submission_idempotency.c.organization_id
            == submission.organization_id,
            purchase_request_submission_idempotency.c.event_id == submission.event_id,
            purchase_request_submission_idempotency.c.requester_user_id
            == submission.requester_user_id,
            purchase_request_submission_idempotency.c.idempotency_key_hash
            == idempotency_key_hash,
        )
    ).one_or_none()
    if existing is None:
        return None
    existing_payload_hash = cast(str, existing.payload_hash)
    if not hmac.compare_digest(existing_payload_hash, payload_hash):
        raise SubmissionStateConflictError

    return load_purchase_request_record(
        connection,
        organization_id=submission.organization_id,
        event_id=submission.event_id,
        request_id=cast(str, existing.request_id),
    )


def load_purchase_request_record(
    connection: Connection,
    *,
    organization_id: str,
    event_id: str,
    request_id: str,
) -> PurchaseRequestRecord:
    request = (
        connection.execute(
            sa.select(purchase_requests).where(
                purchase_requests.c.organization_id == organization_id,
                purchase_requests.c.event_id == event_id,
                purchase_requests.c.request_id == request_id,
            )
        )
        .mappings()
        .one()
    )
    item_rows = (
        connection.execute(
            sa.select(purchase_request_items)
            .where(
                purchase_request_items.c.organization_id == organization_id,
                purchase_request_items.c.event_id == event_id,
                purchase_request_items.c.request_id == request_id,
            )
            .order_by(purchase_request_items.c.item_position)
        )
        .mappings()
        .all()
    )

    content_items = tuple(
        PurchaseRequestItemInput(
            name=cast(str, item["name"]),
            category=cast(str, item["category"]),
            budget_item=cast(str, item["budget_item"]),
            purchase_type=cast(str, item["purchase_type"]),
            quantity=cast(Decimal, item["quantity"]),
            unit=cast(str, item["unit"]),
            estimated_unit_price=cast(Decimal, item["estimated_unit_price"]),
            price_evidence=tuple(
                cast(list[Mapping[str, object]], item["price_evidence"])
            ),
            details=cast(Mapping[str, object], item["details"]),
        )
        for item in item_rows
    )
    content = PurchaseRequestContent(
        title=cast(str, request["title"]),
        needed_date=cast(date, request["needed_date"]),
        purpose=cast(str, request["purpose"]),
        priority=cast(str, request["priority"]),
        items=content_items,
    )
    item_results = tuple(
        PurchaseRequestItemResult(
            item_id=cast(str, item["item_id"]),
            item_position=cast(int, item["item_position"]),
            estimated_amount=cast(Decimal, item["estimated_amount"]),
        )
        for item in item_rows
    )
    return PurchaseRequestRecord(
        request_id=cast(str, request["request_id"]),
        organization_id=cast(str, request["organization_id"]),
        event_id=cast(str, request["event_id"]),
        requester_user_id=cast(str, request["requester_user_id"]),
        request_department_id=cast(str, request["request_department_id"]),
        status=cast(str, request["status"]),
        content=content,
        item_results=item_results,
        estimated_total=cast(Decimal, request["estimated_total"]),
        over_budget=cast(bool, request["over_budget"]),
        created_at=cast(datetime, request["created_at"]),
    )


def _submission_payload_hash(
    submission: ValidatedPurchaseRequestSubmission,
) -> str:
    content = submission.content
    payload: dict[str, object] = {
        "organizationId": submission.organization_id,
        "eventId": submission.event_id,
        "requesterUserId": submission.requester_user_id,
        "requestDepartmentId": submission.request_department_id,
        "content": {
            "title": content.title,
            "neededDate": content.needed_date,
            "purpose": content.purpose,
            "priority": content.priority,
            "items": [
                {
                    "name": item.name,
                    "category": item.category,
                    "budgetItem": item.budget_item,
                    "purchaseType": item.purchase_type,
                    "quantity": item.quantity,
                    "unit": item.unit,
                    "estimatedUnitPrice": item.estimated_unit_price,
                    "priceEvidence": item.price_evidence,
                    "details": item.details,
                }
                for item in content.items
            ],
        },
        "draftRef": (
            {
                "draftId": submission.draft_ref.draft_id,
                "version": submission.draft_ref.version,
            }
            if submission.draft_ref is not None
            else None
        ),
    }
    canonical_payload = json.dumps(
        _canonicalize(payload),
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
        allow_nan=False,
    )
    return _sha256_text(canonical_payload)


def _canonicalize(value: object) -> JsonValue:
    if value is None or isinstance(value, str | int | bool):
        return value
    if isinstance(value, float):
        return value
    if isinstance(value, Decimal):
        return {"$decimal": _decimal_text(value)}
    if isinstance(value, date):
        return {"$date": value.isoformat()}
    if isinstance(value, Mapping):
        mapping_value = cast(Mapping[object, object], value)
        return {str(key): _canonicalize(item) for key, item in mapping_value.items()}
    if isinstance(value, list | tuple):
        sequence_value = cast(list[object] | tuple[object, ...], value)
        return [_canonicalize(item) for item in sequence_value]
    raise TypeError(f"unsupported submission payload value: {type(value).__name__}")


def _materialize_json(value: object) -> JsonValue:
    if value is None or isinstance(value, str | int | bool):
        return value
    if isinstance(value, float):
        return value
    if isinstance(value, Decimal):
        if value == value.to_integral_value():
            return int(value)
        return float(value)
    if isinstance(value, Mapping):
        mapping_value = cast(Mapping[object, object], value)
        return {
            str(key): _materialize_json(item) for key, item in mapping_value.items()
        }
    if isinstance(value, list | tuple):
        sequence_value = cast(list[object] | tuple[object, ...], value)
        return [_materialize_json(item) for item in sequence_value]
    raise TypeError(f"unsupported JSON value: {type(value).__name__}")


def _decimal_text(value: Decimal) -> str:
    normalized = value.normalize()
    return format(normalized, "f")


def _sha256_text(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def _new_identifier() -> str:
    return uuid.uuid4().hex


def _utc_now() -> datetime:
    return datetime.now(UTC)
