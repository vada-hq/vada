# pyright: reportUnknownArgumentType=false, reportUnknownMemberType=false, reportUnknownVariableType=false
from __future__ import annotations

import json
from collections.abc import Generator
from datetime import UTC, date, datetime
from decimal import Decimal
from functools import cache
from pathlib import Path
from typing import Protocol, cast

import pytest
import schemathesis
import sqlalchemy as sa
from fastapi import Request
from fastapi.testclient import TestClient
from httpx import Response
from jsonschema import Draft202012Validator
from jsonschema.exceptions import ValidationError
from referencing import Registry, Resource
from sqlalchemy import Engine, text

from vada_api.finance.application import (
    FinanceRequestContext,
    PurchaseRequestDisplayNames,
    PurchaseRequestRelationshipReader,
    PurchaseRequestService,
)
from vada_api.finance.authorization import PurchaseRequestActorFacts
from vada_api.finance.persistence.purchase_requests import (
    PostgreSQLPurchaseRequestRepository,
)
from vada_api.finance.persistence.schema import (
    purchase_request_drafts,
    purchase_requests,
)
from vada_api.finance.persistence.submission import (
    PostgreSQLPurchaseRequestSubmissionStore,
)
from vada_api.identity.authentication import CognitoPrincipal
from vada_api.identity.context import (
    DepartmentRelationshipFact,
    TrustedOrganizationContext,
)
from vada_api.identity.errors import ResourceNotFoundError
from vada_api.main import create_app

_NO_REQUEST_BODY = object()


class _SchemaParameterSet(Protocol):
    @property
    def validation_schema(self) -> dict[str, object]: ...


@cache
def _approved_openapi_schema():
    return schemathesis.openapi.from_path(
        Path(__file__).resolve().parents[4] / "contracts/openapi/CB-FIN-001/R1.json"
    )


def _assert_openapi_response(
    response: Response,
    *,
    path: str,
    method: str,
) -> None:
    _approved_openapi_schema()[path][method].validate_response(response)


def _assert_openapi_request(
    *,
    path: str,
    method: str,
    path_parameters: dict[str, str],
    headers: dict[str, str] | None = None,
    body: object = _NO_REQUEST_BODY,
) -> None:
    operation = _approved_openapi_schema()[path][method]
    components = (
        (operation.path_parameters, path_parameters),
        (operation.headers, headers or {}),
        (operation.query, {}),
        (operation.cookies, {}),
    )
    for component, value in components:
        parameter_set = cast(_SchemaParameterSet, component)
        Draft202012Validator(parameter_set.validation_schema).validate(value)

    if body is _NO_REQUEST_BODY:
        assert len(operation.body) == 0
        return

    json_bodies = [
        component
        for component in operation.body
        if component.media_type == "application/json"
    ]
    assert len(json_bodies) == 1
    Draft202012Validator(json_bodies[0].validation_schema).validate(body)


@cache
def _approved_detail_view_validator() -> Draft202012Validator:
    repository_root = Path(__file__).resolve().parents[4]
    bundles = [
        json.loads(
            (
                repository_root / f"contracts/bundles/CB-FIN-001/{revision}.json"
            ).read_text(encoding="utf-8")
        )
        for revision in ("R1", "R2")
    ]
    schemas = [
        contract["specification"]["json_schema"]
        for bundle in bundles
        for contract in bundle["contracts"]
        if contract["kind"] == "DATA"
    ]
    registry = Registry().with_resources(
        (schema["$id"], Resource.from_contents(schema)) for schema in schemas
    )
    detail_schema = next(
        contract["specification"]["json_schema"]
        for contract in bundles[1]["contracts"]
        if contract["id"] == "DATA:purchase_request.detail_view@R1"
    )
    return Draft202012Validator(detail_schema, registry=registry)


@pytest.fixture(autouse=True)
def clean_purchase_request_api_state(
    migrated_engine: Engine,
) -> Generator[None]:
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


def _context(
    *,
    organization_id: str = "organization-a",
    user_id: str = "user-a",
    available_budget: Decimal = Decimal(100_000),
    department_head: bool = True,
    finance_member: bool = False,
) -> FinanceRequestContext:
    identity = TrustedOrganizationContext(
        principal=CognitoPrincipal(
            issuer="https://cognito.example/pool-a", subject=f"subject-{user_id}"
        ),
        user_id=user_id,
        organization_id=organization_id,
        membership_id=f"membership-{user_id}",
        event_id="event-a",
        department_relationships=(
            DepartmentRelationshipFact(
                relationship_id=f"relationship-{user_id}",
                department_id="department-a",
            ),
        ),
    )
    return FinanceRequestContext(
        actor=PurchaseRequestActorFacts(
            identity=identity,
            department_head_of=(
                frozenset({"department-a"}) if department_head else frozenset()
            ),
            finance_member_of=(
                frozenset({organization_id}) if finance_member else frozenset()
            ),
        ),
        event_name="개강 행사",
        requester_name=f"요청자 {user_id}",
        request_department_id="department-a",
        request_department_name="기획부",
        available_budget=available_budget,
    )


class StaticPurchaseRequestContextProvider:
    """Test adapter that still enforces the requested event trust boundary."""

    def __init__(self, context: FinanceRequestContext) -> None:
        self._context = context

    def resolve(self, _request: Request, *, event_id: str) -> FinanceRequestContext:
        if event_id != self._context.actor.identity.event_id:
            raise ResourceNotFoundError
        return self._context


class StaticPurchaseRequestRelationshipReader:
    """Server-owned test facts kept separate from purchase request rows."""

    def __init__(
        self,
        *,
        event_names: dict[tuple[str, str], str],
        requester_names: dict[tuple[str, str], str],
    ) -> None:
        self._event_names = event_names
        self._requester_names = requester_names

    def get_detail_display_names(
        self, *, organization_id: str, event_id: str, requester_user_id: str
    ) -> PurchaseRequestDisplayNames | None:
        event_name = self._event_names.get((organization_id, event_id))
        requester_name = self._requester_names.get((organization_id, requester_user_id))
        if event_name is None or requester_name is None:
            return None
        return PurchaseRequestDisplayNames(
            event_name=event_name,
            requester_name=requester_name,
        )


def _client(
    engine: Engine,
    context: FinanceRequestContext,
    *,
    today: date | None = None,
    relationship_reader: PurchaseRequestRelationshipReader | None = None,
) -> TestClient:
    relationship_reader = (
        relationship_reader
        or StaticPurchaseRequestRelationshipReader(
            event_names={
                (
                    context.actor.identity.organization_id,
                    context.actor.identity.event_id,
                ): context.event_name
            },
            requester_names={
                (
                    context.actor.identity.organization_id,
                    context.actor.identity.user_id,
                ): context.requester_name
            },
        )
    )
    service = PurchaseRequestService(
        PostgreSQLPurchaseRequestRepository(engine),
        PostgreSQLPurchaseRequestSubmissionStore(engine),
        relationship_reader=relationship_reader,
        today_provider=(lambda: today) if today is not None else None,
    )
    app = create_app()
    app.state.purchase_request_context_provider = StaticPurchaseRequestContextProvider(
        context
    )
    app.state.purchase_request_service = service
    return TestClient(app)


def _submit_body(*, title: str = "행사 운영 물품") -> dict[str, object]:
    return {
        "content": {
            "title": title,
            "neededDate": date(2999, 8, 20).isoformat(),
            "purpose": "행사 운영",
            "priority": "urgent",
            "items": [
                {
                    "name": "현수막",
                    "category": "홍보물",
                    "budgetItem": "행사운영비",
                    "purchaseType": "general",
                    "quantity": 2,
                    "unit": "개",
                    "estimatedUnitPrice": 10000,
                    "priceEvidence": [
                        {
                            "type": "product_url",
                            "url": "https://example.test/banner",
                        }
                    ],
                    "details": {"vendor": "공급처 A"},
                },
                {
                    "name": "행사 진행",
                    "category": "용역",
                    "budgetItem": "행사운영비",
                    "purchaseType": "service",
                    "quantity": 1,
                    "unit": "건",
                    "estimatedUnitPrice": 5000,
                    "priceEvidence": [{"type": "vendor_quote", "note": "전화 견적"}],
                    "details": {"provider": "공급처 B"},
                },
            ],
        }
    }


@pytest.mark.postgres
def test_ac05_draft_api_lifecycle_is_versioned_and_isolated(
    migrated_engine: Engine,
) -> None:
    owner = _client(migrated_engine, _context())

    _assert_openapi_request(
        path="/events/{eventId}/purchase-request-editor",
        method="GET",
        path_parameters={"eventId": "event-a"},
    )
    editor = owner.get("/events/event-a/purchase-request-editor")
    _assert_openapi_response(
        editor,
        path="/events/{eventId}/purchase-request-editor",
        method="GET",
    )
    assert editor.status_code == 200
    assert editor.json() == {
        "organizationId": "organization-a",
        "eventId": "event-a",
        "eventName": "개강 행사",
        "requesterUserId": "user-a",
        "requesterName": "요청자 user-a",
        "requestDepartmentId": "department-a",
        "requestDepartmentName": "기획부",
        "draft": None,
    }
    assert owner.get("/events/event-b/purchase-request-editor").status_code == 404
    draft_body = {
        "expectedVersion": None,
        "content": {"title": "첫 초안", "items": []},
    }
    _assert_openapi_request(
        path="/events/{eventId}/purchase-request-draft",
        method="PUT",
        path_parameters={"eventId": "event-a"},
        body=draft_body,
    )
    created = owner.put(
        "/events/event-a/purchase-request-draft",
        json=draft_body,
    )
    _assert_openapi_response(
        created,
        path="/events/{eventId}/purchase-request-draft",
        method="PUT",
    )
    assert created.status_code == 200
    assert created.json()["version"] == 1

    updated = owner.put(
        "/events/event-a/purchase-request-draft",
        json={
            "expectedVersion": 1,
            "content": {"title": "수정 초안", "items": []},
        },
    )
    assert updated.status_code == 200
    assert updated.json()["version"] == 2

    stale = owner.put(
        "/events/event-a/purchase-request-draft",
        json={
            "expectedVersion": 1,
            "content": {"title": "덮어쓰면 안 됨", "items": []},
        },
    )
    assert stale.status_code == 409
    assert (
        owner.get("/events/event-a/purchase-request-editor").json()["draft"]["content"][
            "title"
        ]
        == "수정 초안"
    )

    other_user = _client(migrated_engine, _context(user_id="user-b"))
    other_org = _client(
        migrated_engine, _context(organization_id="organization-b", user_id="user-b")
    )
    assert (
        other_user.get("/events/event-a/purchase-request-editor").json()["draft"]
        is None
    )
    assert (
        other_org.get("/events/event-a/purchase-request-editor").json()["draft"] is None
    )

    _assert_openapi_request(
        path="/events/{eventId}/purchase-request-draft",
        method="DELETE",
        path_parameters={"eventId": "event-a"},
    )
    deleted = owner.delete("/events/event-a/purchase-request-draft")
    _assert_openapi_response(
        deleted,
        path="/events/{eventId}/purchase-request-draft",
        method="DELETE",
    )
    assert deleted.status_code == 204
    assert owner.get("/events/event-a/purchase-request-editor").json()["draft"] is None


@pytest.mark.postgres
def test_ac01_ac02_ac06_ac07_submit_list_and_detail_preserve_scope_and_idempotency(
    migrated_engine: Engine,
) -> None:
    relationship_reader = StaticPurchaseRequestRelationshipReader(
        event_names={("organization-a", "event-a"): "개강 행사"},
        requester_names={
            ("organization-a", "user-a"): "실제 제출자",
            ("organization-a", "user-c"): "현재 조회자",
        },
    )
    owner = _client(
        migrated_engine,
        _context(available_budget=Decimal(1_000)),
        relationship_reader=relationship_reader,
    )
    body = _submit_body()
    _assert_openapi_request(
        path="/events/{eventId}/purchase-requests",
        method="POST",
        path_parameters={"eventId": "event-a"},
        headers={"Idempotency-Key": "submit-001"},
        body=body,
    )
    first = owner.post(
        "/events/event-a/purchase-requests",
        headers={"Idempotency-Key": "submit-001"},
        json=body,
    )
    _assert_openapi_response(
        first,
        path="/events/{eventId}/purchase-requests",
        method="POST",
    )
    retry = owner.post(
        "/events/event-a/purchase-requests",
        headers={"Idempotency-Key": "submit-001"},
        json=body,
    )

    assert first.status_code == 201
    assert retry.status_code == 201
    assert retry.json() == first.json()
    request_id = first.json()["requestId"]
    assert first.json()["estimatedTotal"] == 25000
    assert first.json()["overBudget"] is True
    assert len(first.json()["content"]["items"]) == 2

    conflict = owner.post(
        "/events/event-a/purchase-requests",
        headers={"Idempotency-Key": "submit-001"},
        json=_submit_body(title="멱등 키가 같은 다른 요청"),
    )
    assert conflict.status_code == 409

    second = owner.post(
        "/events/event-a/purchase-requests",
        headers={"Idempotency-Key": "submit-002"},
        json=_submit_body(title="두 번째 요청"),
    )
    assert second.status_code == 201
    second_request_id = second.json()["requestId"]
    with migrated_engine.begin() as connection:
        connection.execute(
            purchase_requests.update()
            .where(purchase_requests.c.request_id == request_id)
            .values(created_at=datetime(2026, 8, 4, 1, 0, tzinfo=UTC))
        )
        connection.execute(
            purchase_requests.update()
            .where(purchase_requests.c.request_id == second_request_id)
            .values(created_at=datetime(2026, 8, 4, 2, 0, tzinfo=UTC))
        )

    _assert_openapi_request(
        path="/events/{eventId}/purchase-requests/mine",
        method="GET",
        path_parameters={"eventId": "event-a"},
    )
    own_list = owner.get("/events/event-a/purchase-requests/mine")
    _assert_openapi_response(
        own_list,
        path="/events/{eventId}/purchase-requests/mine",
        method="GET",
    )
    assert own_list.status_code == 200
    assert [item["requestId"] for item in own_list.json()["items"]] == [
        second_request_id,
        request_id,
    ]
    assert own_list.json()["items"][0] == {
        "requestId": second_request_id,
        "title": "두 번째 요청",
        "status": "review_pending",
        "estimatedTotal": 25000,
        "overBudget": True,
        "createdAt": "2026-08-04T02:00:00Z",
    }

    finance_member = _client(
        migrated_engine,
        _context(
            user_id="user-finance",
            department_head=False,
            finance_member=True,
        ),
    )
    finance_submission = finance_member.post(
        "/events/event-a/purchase-requests",
        headers={"Idempotency-Key": "finance-submit-001"},
        json=body,
    )
    assert finance_submission.status_code == 201
    finance_list = finance_member.get("/events/event-a/purchase-requests/mine")
    assert finance_list.status_code == 200
    assert [item["requestId"] for item in finance_list.json()["items"]] == [
        finance_submission.json()["requestId"]
    ]

    other_org = _client(
        migrated_engine, _context(organization_id="organization-b", user_id="user-b")
    )
    other_org_submission = other_org.post(
        "/events/event-a/purchase-requests",
        headers={"Idempotency-Key": "other-org-submit-001"},
        json=body,
    )
    assert other_org_submission.status_code == 201
    assert [
        item["requestId"]
        for item in owner.get("/events/event-a/purchase-requests/mine").json()["items"]
    ] == [second_request_id, request_id]

    same_org_member = _client(
        migrated_engine,
        _context(user_id="user-c", department_head=False, finance_member=False),
        relationship_reader=relationship_reader,
    )
    member_list = same_org_member.get("/events/event-a/purchase-requests/mine")
    assert member_list.status_code == 403
    assert member_list.json()["code"] == "PURCHASE_REQUEST_ACTION_FORBIDDEN"
    detail_path = f"/events/event-a/purchase-requests/{request_id}"
    _assert_openapi_request(
        path="/events/{eventId}/purchase-requests/{requestId}",
        method="GET",
        path_parameters={"eventId": "event-a", "requestId": request_id},
    )
    owner_detail = owner.get(detail_path)
    assert owner_detail.status_code == 200
    expected_detail = owner_detail.json()
    _approved_detail_view_validator().validate(expected_detail)
    record = expected_detail["record"]
    assert record["requestId"] == request_id
    assert record["organizationId"] == "organization-a"
    assert record["eventId"] == "event-a"
    assert record["requesterUserId"] == "user-a"
    assert record["requestDepartmentId"] == "department-a"
    assert record["status"] == "review_pending"
    assert record["content"] == first.json()["content"]
    assert len(record["itemResults"]) == 2
    assert record["estimatedTotal"] == 25000
    assert record["overBudget"] is True
    assert expected_detail["display"] == {
        "eventName": "개강 행사",
        "requesterName": "실제 제출자",
    }
    member_detail = same_org_member.get(detail_path)
    assert member_detail.status_code == 200
    assert member_detail.json() == expected_detail

    hidden = other_org.get(detail_path)
    assert hidden.status_code == 404
    assert hidden.json()["code"] == "RESOURCE_NOT_FOUND"
    missing = owner.get("/events/event-a/purchase-requests/request-unknown")
    assert missing.status_code == 404
    assert {
        key: value for key, value in hidden.json().items() if key != "instance"
    } == {key: value for key, value in missing.json().items() if key != "instance"}


@pytest.mark.postgres
def test_same_submission_retry_remains_idempotent_after_needed_date_passes(
    migrated_engine: Engine,
) -> None:
    context = _context()
    body = _submit_body()
    content = body["content"]
    assert isinstance(content, dict)
    content["neededDate"] = "2026-08-04"

    first = _client(migrated_engine, context, today=date(2026, 8, 4)).post(
        "/events/event-a/purchase-requests",
        headers={"Idempotency-Key": "delayed-submit-001"},
        json=body,
    )
    retry = _client(migrated_engine, context, today=date(2026, 8, 5)).post(
        "/events/event-a/purchase-requests",
        headers={"Idempotency-Key": "delayed-submit-001"},
        json=body,
    )

    assert first.status_code == 201
    assert retry.status_code == 201
    assert retry.json() == first.json()


@pytest.mark.postgres
def test_ac03_invalid_submission_does_not_create_a_request(
    migrated_engine: Engine,
) -> None:
    client = _client(migrated_engine, _context())

    invalid = client.post(
        "/events/event-a/purchase-requests",
        headers={"Idempotency-Key": "invalid-001"},
        json={"content": {"title": "", "items": []}},
    )
    _assert_openapi_response(
        invalid,
        path="/events/{eventId}/purchase-requests",
        method="POST",
    )

    assert invalid.status_code == 422

    null_detail_body = _submit_body()
    content = null_detail_body["content"]
    assert isinstance(content, dict)
    items = content["items"]
    assert isinstance(items, list)
    first_item = items[0]
    assert isinstance(first_item, dict)
    details = first_item["details"]
    assert isinstance(details, dict)
    details["vendor"] = None
    with pytest.raises(ValidationError):
        _assert_openapi_request(
            path="/events/{eventId}/purchase-requests",
            method="POST",
            path_parameters={"eventId": "event-a"},
            headers={"Idempotency-Key": "invalid-null-detail-001"},
            body=null_detail_body,
        )
    null_detail = client.post(
        "/events/event-a/purchase-requests",
        headers={"Idempotency-Key": "invalid-null-detail-001"},
        json=null_detail_body,
    )
    assert null_detail.status_code == 422

    with migrated_engine.connect() as connection:
        assert (
            connection.scalar(sa.select(sa.func.count()).select_from(purchase_requests))
            == 0
        )


@pytest.mark.postgres
def test_ac04_ac08_failures_are_stable_and_writes_create_no_state(
    migrated_engine: Engine,
) -> None:
    unauthenticated = TestClient(create_app()).get(
        "/events/event-a/purchase-request-editor"
    )
    assert unauthenticated.status_code == 401
    assert unauthenticated.json()["code"] == "UNAUTHENTICATED"

    forbidden_client = _client(
        migrated_engine,
        _context(department_head=False, finance_member=False),
    )
    forbidden_responses = (
        (
            forbidden_client.get("/events/event-a/purchase-request-editor"),
            "/events/{eventId}/purchase-request-editor",
            "GET",
        ),
        (
            forbidden_client.put(
                "/events/event-a/purchase-request-draft",
                json={"expectedVersion": None, "content": {"title": "차단 대상"}},
            ),
            "/events/{eventId}/purchase-request-draft",
            "PUT",
        ),
        (
            forbidden_client.post(
                "/events/event-a/purchase-requests",
                headers={"Idempotency-Key": "forbidden-submit-001"},
                json=_submit_body(),
            ),
            "/events/{eventId}/purchase-requests",
            "POST",
        ),
    )
    for forbidden, path, method in forbidden_responses:
        _assert_openapi_response(forbidden, path=path, method=method)
        assert forbidden.status_code == 403
        assert forbidden.json()["code"] == "PURCHASE_REQUEST_ACTION_FORBIDDEN"

    missing_draft = forbidden_client.delete("/events/event-a/purchase-request-draft")
    _assert_openapi_response(
        missing_draft,
        path="/events/{eventId}/purchase-request-draft",
        method="DELETE",
    )
    assert missing_draft.status_code == 404
    assert missing_draft.json()["code"] == "RESOURCE_NOT_FOUND"

    with migrated_engine.connect() as connection:
        for table in (purchase_request_drafts, purchase_requests):
            assert connection.scalar(sa.select(sa.func.count()).select_from(table)) == 0

    client = _client(migrated_engine, _context())
    missing_event = client.get("/events/event-b/purchase-request-editor")
    assert missing_event.status_code == 404
    assert missing_event.json()["code"] == "RESOURCE_NOT_FOUND"

    with migrated_engine.begin() as connection:
        connection.execute(
            text("ALTER TABLE purchase_request_drafts RENAME TO unavailable_drafts")
        )
    try:
        draft_failure = client.get("/events/event-a/purchase-request-editor")
        _assert_openapi_response(
            draft_failure,
            path="/events/{eventId}/purchase-request-editor",
            method="GET",
        )
        assert draft_failure.status_code == 503
        assert (
            draft_failure.json()["code"] == "PURCHASE_REQUEST_PERSISTENCE_UNAVAILABLE"
        )
        draft_save_failure = client.put(
            "/events/event-a/purchase-request-draft",
            json={
                "expectedVersion": None,
                "content": {"title": "저장 실패 확인"},
            },
        )
        _assert_openapi_response(
            draft_save_failure,
            path="/events/{eventId}/purchase-request-draft",
            method="PUT",
        )
        assert draft_save_failure.status_code == 503
        assert (
            draft_save_failure.json()["code"]
            == "PURCHASE_REQUEST_PERSISTENCE_UNAVAILABLE"
        )
    finally:
        with migrated_engine.begin() as connection:
            connection.execute(
                text("ALTER TABLE unavailable_drafts RENAME TO purchase_request_drafts")
            )

    with migrated_engine.begin() as connection:
        connection.execute(
            text("ALTER TABLE purchase_requests RENAME TO unavailable_requests")
        )
    try:
        submission_failure = client.post(
            "/events/event-a/purchase-requests",
            headers={"Idempotency-Key": "unavailable-submit-001"},
            json=_submit_body(),
        )
        _assert_openapi_response(
            submission_failure,
            path="/events/{eventId}/purchase-requests",
            method="POST",
        )
        assert submission_failure.status_code == 503
        assert (
            submission_failure.json()["code"]
            == "PURCHASE_REQUEST_PERSISTENCE_UNAVAILABLE"
        )
    finally:
        with migrated_engine.begin() as connection:
            connection.execute(
                text("ALTER TABLE unavailable_requests RENAME TO purchase_requests")
            )

    with migrated_engine.connect() as connection:
        assert (
            connection.scalar(sa.select(sa.func.count()).select_from(purchase_requests))
            == 0
        )
