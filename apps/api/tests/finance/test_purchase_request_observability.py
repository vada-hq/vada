from __future__ import annotations

from datetime import UTC, date, datetime
from decimal import Decimal
from pathlib import Path
from typing import cast

import httpx
import pytest
from fastapi.testclient import TestClient

from vada_api.finance.api import (
    get_purchase_request_context,
    get_purchase_request_service,
)
from vada_api.finance.application import (
    FinanceRequestContext,
    PurchaseRequestDraft,
    PurchaseRequestService,
    PurchaseRequestSummary,
)
from vada_api.finance.authorization import PurchaseRequestActorFacts
from vada_api.finance.observability import (
    PowertoolsPurchaseRequestObserver,
    PurchaseRequestOperationRecord,
    observer_from_environment,
    submission_correlation_id,
)
from vada_api.finance.submission import (
    PurchaseRequestContent,
    PurchaseRequestItemInput,
    PurchaseRequestPersistenceError,
    PurchaseRequestRecord,
    PurchaseRequestSubmissionOutcome,
    ValidatedPurchaseRequestSubmission,
)
from vada_api.identity.authentication import CognitoPrincipal
from vada_api.identity.context import (
    DepartmentRelationshipFact,
    TrustedOrganizationContext,
)
from vada_api.main import create_app


class RecordingObserver:
    def __init__(self) -> None:
        self.records: list[PurchaseRequestOperationRecord] = []

    def record(self, record: PurchaseRequestOperationRecord) -> None:
        self.records.append(record)


class FailingObserver:
    def record(self, record: PurchaseRequestOperationRecord) -> None:
        del record
        raise RuntimeError("observability backend unavailable")


class DraftRepository:
    def __init__(self) -> None:
        self.fail_save = False
        self.fail_delete = False
        self.draft: PurchaseRequestDraft | None = None

    def get_draft(
        self, *, organization_id: str, event_id: str, owner_user_id: str
    ) -> PurchaseRequestDraft | None:
        del organization_id, event_id, owner_user_id
        return self.draft

    def save_draft(
        self,
        *,
        organization_id: str,
        event_id: str,
        owner_user_id: str,
        expected_version: int | None,
        content: dict[str, object],
    ) -> PurchaseRequestDraft:
        del organization_id, event_id, owner_user_id, expected_version
        if self.fail_save:
            raise PurchaseRequestPersistenceError
        self.draft = PurchaseRequestDraft(
            draft_id="draft-001",
            version=1,
            saved_at=datetime(2026, 8, 4, tzinfo=UTC),
            content=content,
        )
        return self.draft

    def delete_draft(
        self, *, organization_id: str, event_id: str, owner_user_id: str
    ) -> bool:
        del organization_id, event_id, owner_user_id
        if self.fail_delete:
            raise PurchaseRequestPersistenceError
        return True

    def list_own(
        self, *, organization_id: str, event_id: str, requester_user_id: str
    ) -> tuple[PurchaseRequestSummary, ...]:
        del organization_id, event_id, requester_user_id
        return ()

    def get_detail(
        self, *, organization_id: str, event_id: str, request_id: str
    ) -> PurchaseRequestRecord | None:
        del organization_id, event_id, request_id
        return None


class SubmissionStore:
    def __init__(self, record: PurchaseRequestRecord) -> None:
        self.record = record
        self.existing: PurchaseRequestRecord | None = None
        self.fail_submit = False
        self.replay_during_submit = False

    def get_idempotent_result(
        self, submission: ValidatedPurchaseRequestSubmission
    ) -> PurchaseRequestRecord | None:
        del submission
        return self.existing

    def submit(
        self, submission: ValidatedPurchaseRequestSubmission
    ) -> PurchaseRequestSubmissionOutcome:
        del submission
        if self.fail_submit:
            raise PurchaseRequestPersistenceError
        if self.replay_during_submit:
            self.existing = self.record
        return PurchaseRequestSubmissionOutcome(
            record=self.record,
            replayed=self.replay_during_submit,
        )


def _context() -> FinanceRequestContext:
    identity = TrustedOrganizationContext(
        principal=CognitoPrincipal(issuer="issuer", subject="subject"),
        user_id="user-001",
        organization_id="organization-001",
        membership_id="membership-001",
        event_id="event-001",
        department_relationships=(
            DepartmentRelationshipFact(
                relationship_id="relationship-001",
                department_id="department-001",
            ),
        ),
    )
    return FinanceRequestContext(
        actor=PurchaseRequestActorFacts(
            identity=identity,
            department_head_of=frozenset({"department-001"}),
        ),
        event_name="행사",
        requester_name="요청자",
        request_department_id="department-001",
        request_department_name="기획부",
        available_budget=Decimal(100_000),
    )


def _content() -> PurchaseRequestContent:
    return PurchaseRequestContent(
        title="민감한 구매 제목",
        needed_date=date(2999, 8, 20),
        purpose="공개되면 안 되는 구매 목적",
        priority="normal",
        items=(
            PurchaseRequestItemInput(
                name="민감한 품목명",
                category="운영",
                budget_item="행사비",
                purchase_type="general",
                quantity=Decimal(1),
                unit="개",
                estimated_unit_price=Decimal(10_000),
                price_evidence=({"url": "https://secret.example/item"},),
                details={"memo": "민감한 가격 근거"},
            ),
        ),
    )


def _record(content: PurchaseRequestContent) -> PurchaseRequestRecord:
    return PurchaseRequestRecord(
        request_id="request-001",
        organization_id="organization-001",
        event_id="event-001",
        requester_user_id="user-001",
        request_department_id="department-001",
        status="review_pending",
        content=content,
        item_results=(),
        estimated_total=Decimal(10_000),
        over_budget=False,
        created_at=datetime(2026, 8, 4, tzinfo=UTC),
    )


def test_service_records_safe_success_failure_and_retry_operations() -> None:
    content = _content()
    observer = RecordingObserver()
    repository = DraftRepository()
    submission_store = SubmissionStore(_record(content))
    service = PurchaseRequestService(repository, submission_store, observer=observer)
    context = _context()

    service.save_draft(
        context,
        expected_version=None,
        content={"purpose": content.purpose, "items": [content.items[0].name]},
    )
    repository.fail_save = True
    with pytest.raises(PurchaseRequestPersistenceError):
        service.save_draft(
            context,
            expected_version=1,
            content={"purpose": content.purpose},
        )
    service.delete_draft(context)
    repository.fail_delete = True
    with pytest.raises(PurchaseRequestPersistenceError):
        service.delete_draft(context)

    service.submit(
        context,
        idempotency_key="opaque-client-key",
        content=content,
        draft_ref=None,
    )
    submission_store.existing = submission_store.record
    service.submit(
        context,
        idempotency_key="opaque-client-key",
        content=content,
        draft_ref=None,
    )
    submission_store.existing = None
    submission_store.fail_submit = True
    with pytest.raises(PurchaseRequestPersistenceError):
        service.submit(
            context,
            idempotency_key="another-opaque-client-key",
            content=content,
            draft_ref=None,
        )

    assert [(record.operation, record.result) for record in observer.records] == [
        ("draft_save", "succeeded"),
        ("draft_save", "failed"),
        ("draft_delete", "succeeded"),
        ("draft_delete", "failed"),
        ("submission", "succeeded"),
        ("submission", "retried"),
        ("submission", "failed"),
    ]
    assert all(
        record.organization_id == "organization-001" for record in observer.records
    )
    assert all(record.event_id == "event-001" for record in observer.records)
    assert all(record.actor_user_id == "user-001" for record in observer.records)
    assert all(record.occurred_at.tzinfo is UTC for record in observer.records)
    assert all(record.duration_ms >= 0 for record in observer.records)
    assert observer.records[5].correlation_id == observer.records[4].correlation_id
    serialized_records = repr(observer.records)
    for secret in (
        content.title,
        content.purpose,
        content.items[0].name,
        "민감한 가격 근거",
        "opaque-client-key",
    ):
        assert secret not in serialized_records


def test_submission_correlation_is_stable_without_exposing_idempotency_key() -> None:
    first = submission_correlation_id("opaque-client-key")
    second = submission_correlation_id("opaque-client-key")

    assert first == second
    assert first.startswith("submission-")
    assert "opaque-client-key" not in first


def test_race_losing_same_submission_is_recorded_as_retry() -> None:
    content = _content()
    observer = RecordingObserver()
    submission_store = SubmissionStore(_record(content))
    submission_store.replay_during_submit = True
    service = PurchaseRequestService(
        DraftRepository(), submission_store, observer=observer
    )

    result = service.submit(
        _context(),
        idempotency_key="concurrent-client-key",
        content=content,
        draft_ref=None,
    )

    assert result is submission_store.record
    assert observer.records[-1].result == "retried"


def test_persistence_problem_instance_matches_safe_observability_correlation() -> None:
    sensitive_purpose = "공개되면 안 되는 구매 목적"
    observer = RecordingObserver()
    repository = DraftRepository()
    repository.fail_save = True
    service = PurchaseRequestService(
        repository,
        SubmissionStore(_record(_content())),
        observer=observer,
    )
    app = create_app()
    app.dependency_overrides[get_purchase_request_context] = _context
    app.dependency_overrides[get_purchase_request_service] = lambda: service

    response = cast(
        httpx.Response,
        TestClient(app).put(  # pyright: ignore[reportUnknownMemberType]
            "/events/event-001/purchase-request-draft",
            json={
                "expectedVersion": None,
                "content": {"purpose": sensitive_purpose},
            },
        ),
    )

    assert response.status_code == 503
    correlation_id = observer.records[-1].correlation_id
    assert response.json()["instance"] == f"urn:vada:problem:{correlation_id}"
    assert sensitive_purpose not in response.text
    assert sensitive_purpose not in repr(observer.records)


class FakeLogger:
    def __init__(self) -> None:
        self.entries: list[dict[str, object]] = []

    def info(self, message: str, **kwargs: object) -> None:
        del message
        self.entries.append(kwargs)


class FakeTracer:
    def __init__(self) -> None:
        self.annotations: dict[str, object] = {}
        self.metadata: dict[str, object] = {}

    def put_annotation(self, key: str, value: str | int | float | bool) -> None:
        self.annotations[key] = value

    def put_metadata(self, key: str, value: object, namespace: str) -> None:
        self.metadata[f"{namespace}.{key}"] = value


class FakeMetrics:
    def __init__(self) -> None:
        self.dimensions: dict[str, str] = {}
        self.values: list[tuple[str, object, float]] = []
        self.flush_count = 0

    def add_dimension(self, name: str, value: str) -> None:
        self.dimensions[name] = value

    def add_metric(self, name: str, unit: object, value: float) -> None:
        self.values.append((name, unit, value))

    def flush_metrics(self) -> None:
        self.flush_count += 1


def test_powertools_adapter_emits_safe_correlated_log_trace_and_metrics() -> None:
    logger = FakeLogger()
    tracer = FakeTracer()
    metrics = FakeMetrics()
    observer = PowertoolsPurchaseRequestObserver(
        environment="dev", logger=logger, tracer=tracer, metrics=metrics
    )
    record = PurchaseRequestOperationRecord(
        operation="submission",
        organization_id="organization-001",
        event_id="event-001",
        actor_user_id="user-001",
        occurred_at=datetime(2026, 8, 4, tzinfo=UTC),
        correlation_id="correlation-001",
        result="failed",
        duration_ms=12.5,
        error_code="PERSISTENCE_UNAVAILABLE",
    )

    observer.record(record)

    fields = logger.entries[0]["extra"]
    assert fields == {
        "operation": "submission",
        "organization_id": "organization-001",
        "event_id": "event-001",
        "actor_user_id": "user-001",
        "occurred_at": "2026-08-04T00:00:00+00:00",
        "correlation_id": "correlation-001",
        "result": "failed",
        "duration_ms": 12.5,
        "error_code": "PERSISTENCE_UNAVAILABLE",
    }
    assert tracer.annotations["operation"] == "submission"
    assert tracer.annotations["result"] == "failed"
    assert tracer.metadata["purchase_request.correlation_id"] == "correlation-001"
    assert metrics.dimensions == {
        "environment": "dev",
        "operation": "submission",
        "result": "failed",
    }
    assert [value[0] for value in metrics.values] == [
        "PurchaseRequestOperationCount",
        "PurchaseRequestOperationLatency",
        "PurchaseRequestPersistenceFailureCount",
    ]
    assert metrics.flush_count == 1


def test_lambda_environment_can_construct_real_powertools_observer(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("AWS_LAMBDA_FUNCTION_NAME", "vada-api-dev")
    monkeypatch.setenv("VADA_ENVIRONMENT", "dev")

    observer = observer_from_environment()

    assert isinstance(observer, PowertoolsPurchaseRequestObserver)


def test_observability_failure_does_not_change_business_result() -> None:
    content = _content()
    repository = DraftRepository()
    submission_store = SubmissionStore(_record(content))
    service = PurchaseRequestService(
        repository,
        submission_store,
        observer=FailingObserver(),
    )

    draft = service.save_draft(
        _context(), expected_version=None, content={"purpose": content.purpose}
    )

    assert draft.draft_id == "draft-001"

    repository.fail_save = True
    with pytest.raises(PurchaseRequestPersistenceError):
        service.save_draft(
            _context(), expected_version=1, content={"purpose": content.purpose}
        )


def test_terraform_module_sets_retention_alarm_sns_and_xray_inputs() -> None:
    module_dir = (
        Path(__file__).resolve().parents[4]
        / "infra"
        / "modules"
        / "purchase_request_observability"
    )
    main = (module_dir / "main.tf").read_text(encoding="utf-8")
    variables = (module_dir / "variables.tf").read_text(encoding="utf-8")
    outputs = (module_dir / "outputs.tf").read_text(encoding="utf-8")

    assert "dev  = 30" in main
    assert "prod = 90" in main
    assert 'resource "aws_cloudwatch_log_group" "api"' in main
    assert 'resource "aws_cloudwatch_log_metric_filter" "persistence_failure"' in main
    assert 'resource "aws_cloudwatch_metric_alarm" "persistence_failure"' in main
    assert 'resource "aws_sns_topic" "persistence_failure"' in main
    assert 'resource "aws_sns_topic_subscription" "email"' in main
    assert 'protocol  = "email"' in main
    assert 'name          = "PurchaseRequestPersistenceFailureAlarmCount"' in main
    assert 'metric_name         = "PurchaseRequestPersistenceFailureAlarmCount"' in main
    assert 'variable "alarm_email"' in variables
    assert 'tracing_mode = "Active"' in outputs
    assert '"xray:PutTraceSegments"' in outputs
    assert '"xray:PutTelemetryRecords"' in outputs
    assert "POWERTOOLS_SERVICE_NAME" in outputs
    assert "POWERTOOLS_METRICS_NAMESPACE" in outputs
