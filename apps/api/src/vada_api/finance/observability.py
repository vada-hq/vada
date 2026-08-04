from __future__ import annotations

import hashlib
import logging
import os
import time
import uuid
from collections.abc import Callable
from dataclasses import asdict, dataclass
from datetime import UTC, datetime
from typing import Literal, Protocol, cast

from aws_lambda_powertools import Logger, Metrics, Tracer
from aws_lambda_powertools.metrics import MetricUnit

from vada_api.finance.submission import (
    PurchaseRequestNeededDateInPastError,
    PurchaseRequestPersistenceError,
    PurchaseRequestStateConflictError,
)
from vada_api.identity.errors import ResourceNotFoundError

type PurchaseRequestOperation = Literal["draft_save", "draft_delete", "submission"]
type PurchaseRequestOperationResult = Literal["succeeded", "failed", "retried"]

_fallback_logger = logging.getLogger(__name__)


@dataclass(frozen=True, slots=True)
class PurchaseRequestOperationRecord:
    """Allow-listed operational fields; purchase input has no place to enter."""

    operation: PurchaseRequestOperation
    organization_id: str
    event_id: str
    actor_user_id: str
    occurred_at: datetime
    correlation_id: str
    result: PurchaseRequestOperationResult
    duration_ms: float
    error_code: str | None = None

    def safe_fields(self) -> dict[str, object]:
        fields = asdict(self)
        fields["occurred_at"] = self.occurred_at.isoformat()
        if self.error_code is None:
            del fields["error_code"]
        return fields


class PurchaseRequestObserver(Protocol):
    def record(self, record: PurchaseRequestOperationRecord) -> None: ...


class NoOpPurchaseRequestObserver:
    def record(self, record: PurchaseRequestOperationRecord) -> None:
        del record
        return


class _Logger(Protocol):
    def info(self, message: str, **kwargs: object) -> None: ...


class _Tracer(Protocol):
    def put_annotation(self, key: str, value: str | int | float | bool) -> None: ...

    def put_metadata(self, key: str, value: object, namespace: str) -> None: ...


class _Metrics(Protocol):
    def add_dimension(self, name: str, value: str) -> None: ...

    def add_metric(self, name: str, unit: object, value: float) -> None: ...

    def flush_metrics(self) -> None: ...


class PowertoolsPurchaseRequestObserver:
    """Emit one correlated structured event without copying financial input."""

    def __init__(
        self,
        *,
        environment: str,
        logger: _Logger | None = None,
        tracer: _Tracer | None = None,
        metrics: _Metrics | None = None,
    ) -> None:
        self._environment = environment
        self._logger = logger or cast(_Logger, Logger(service="vada-purchase-requests"))
        self._tracer = tracer or cast(_Tracer, Tracer(service="vada-purchase-requests"))
        self._metrics = metrics or cast(
            _Metrics,
            Metrics(
                namespace="VADA/PurchaseRequests",
                service="vada-purchase-requests",
            ),
        )

    def record(self, record: PurchaseRequestOperationRecord) -> None:
        fields = record.safe_fields()
        self._logger.info("purchase_request_operation", extra=fields)

        annotations: dict[str, str] = {
            "operation": record.operation,
            "organization_id": record.organization_id,
            "event_id": record.event_id,
            "actor_user_id": record.actor_user_id,
            "result": record.result,
        }
        for key, value in annotations.items():
            self._tracer.put_annotation(key=key, value=value)
        self._tracer.put_metadata(
            key="correlation_id",
            value=record.correlation_id,
            namespace="purchase_request",
        )
        self._tracer.put_metadata(
            key="duration_ms",
            value=record.duration_ms,
            namespace="purchase_request",
        )

        self._metrics.add_dimension(name="environment", value=self._environment)
        self._metrics.add_dimension(name="operation", value=record.operation)
        self._metrics.add_dimension(name="result", value=record.result)
        self._metrics.add_metric(
            name="PurchaseRequestOperationCount",
            unit=MetricUnit.Count,
            value=1,
        )
        self._metrics.add_metric(
            name="PurchaseRequestOperationLatency",
            unit=MetricUnit.Milliseconds,
            value=record.duration_ms,
        )
        if record.error_code == "PERSISTENCE_UNAVAILABLE":
            self._metrics.add_metric(
                name="PurchaseRequestPersistenceFailureCount",
                unit=MetricUnit.Count,
                value=1,
            )
        self._metrics.flush_metrics()


@dataclass(frozen=True, slots=True)
class ObservedResult[T]:
    value: T
    result: Literal["succeeded", "retried"] = "succeeded"


def observe_purchase_request_operation[T](
    *,
    observer: PurchaseRequestObserver,
    operation: PurchaseRequestOperation,
    organization_id: str,
    event_id: str,
    actor_user_id: str,
    correlation_id: str,
    action: Callable[[], ObservedResult[T]],
) -> T:
    started = time.perf_counter()
    try:
        outcome = action()
    except Exception as error:
        _emit_without_changing_business_result(
            observer,
            PurchaseRequestOperationRecord(
                operation=operation,
                organization_id=organization_id,
                event_id=event_id,
                actor_user_id=actor_user_id,
                occurred_at=datetime.now(UTC),
                correlation_id=correlation_id,
                result="failed",
                duration_ms=_duration_ms(started),
                error_code=_safe_error_code(error),
            ),
        )
        raise

    _emit_without_changing_business_result(
        observer,
        PurchaseRequestOperationRecord(
            operation=operation,
            organization_id=organization_id,
            event_id=event_id,
            actor_user_id=actor_user_id,
            occurred_at=datetime.now(UTC),
            correlation_id=correlation_id,
            result=outcome.result,
            duration_ms=_duration_ms(started),
        ),
    )
    return outcome.value


def observer_from_environment() -> PurchaseRequestObserver:
    if not os.getenv("AWS_LAMBDA_FUNCTION_NAME"):
        return NoOpPurchaseRequestObserver()
    return PowertoolsPurchaseRequestObserver(
        environment=os.getenv("VADA_ENVIRONMENT", "dev")
    )


def new_operation_correlation_id() -> str:
    return f"operation-{uuid.uuid4().hex}"


def submission_correlation_id(idempotency_key: str) -> str:
    digest = hashlib.sha256(idempotency_key.encode("utf-8")).hexdigest()
    return f"submission-{digest}"


def _duration_ms(started: float) -> float:
    return max(0.0, round((time.perf_counter() - started) * 1000, 3))


def _safe_error_code(error: Exception) -> str:
    if isinstance(error, PurchaseRequestPersistenceError):
        return "PERSISTENCE_UNAVAILABLE"
    if isinstance(error, PurchaseRequestStateConflictError):
        return "STATE_CONFLICT"
    if isinstance(error, PurchaseRequestNeededDateInPastError):
        return "VALIDATION_FAILED"
    if isinstance(error, ResourceNotFoundError):
        return "RESOURCE_NOT_FOUND"
    return "UNEXPECTED_ERROR"


def _emit_without_changing_business_result(
    observer: PurchaseRequestObserver,
    record: PurchaseRequestOperationRecord,
) -> None:
    try:
        observer.record(record)
    except Exception:
        _fallback_logger.exception(
            "purchase_request_observability_emit_failed",
            extra={
                "operation": record.operation,
                "organization_id": record.organization_id,
                "event_id": record.event_id,
                "actor_user_id": record.actor_user_id,
                "correlation_id": record.correlation_id,
                "result": record.result,
            },
        )
