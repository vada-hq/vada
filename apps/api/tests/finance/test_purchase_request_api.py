# pyright: reportUnknownMemberType=false, reportUnknownVariableType=false
from __future__ import annotations

import json
from datetime import UTC, date, datetime
from decimal import Decimal
from functools import cache
from pathlib import Path
from typing import Any, cast

import pytest
import schemathesis
from fastapi.testclient import TestClient
from jsonschema import Draft202012Validator

from vada_api.finance.api import (
    get_purchase_request_context,
    get_purchase_request_service,
)
from vada_api.finance.application import (
    FinanceRequestContext,
    PurchaseRequestDisplayNames,
    PurchaseRequestDraft,
    PurchaseRequestService,
    PurchaseRequestSummary,
)
from vada_api.finance.authorization import PurchaseRequestActorFacts
from vada_api.finance.submission import (
    PurchaseRequestContent,
    PurchaseRequestItemInput,
    PurchaseRequestItemResult,
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


class FakePurchaseRequestRepository:
    def __init__(self) -> None:
        self.draft: PurchaseRequestDraft | None = None
        self.summaries: tuple[PurchaseRequestSummary, ...] = ()
        self.detail: PurchaseRequestRecord | None = None
        self.detail_display_names: dict[tuple[str, str, str], tuple[str, str]] = {
            ("organization-a", "event-a", "user-a"): ("개강 행사", "요청자")
        }
        self.last_scope: tuple[str, ...] | None = None
        self.last_display_scope: tuple[str, str, str] | None = None

    def get_draft(
        self, *, organization_id: str, event_id: str, owner_user_id: str
    ) -> PurchaseRequestDraft | None:
        self.last_scope = (organization_id, event_id, owner_user_id)
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
        self.last_scope = (organization_id, event_id, owner_user_id)
        version = 1 if self.draft is None else self.draft.version + 1
        self.draft = PurchaseRequestDraft(
            draft_id="draft-001",
            version=version,
            saved_at=datetime(2026, 8, 4, 1, 2, tzinfo=UTC),
            content=content,
        )
        return self.draft

    def delete_draft(
        self, *, organization_id: str, event_id: str, owner_user_id: str
    ) -> bool:
        self.last_scope = (organization_id, event_id, owner_user_id)
        existed = self.draft is not None
        self.draft = None
        return existed

    def list_own(
        self, *, organization_id: str, event_id: str, requester_user_id: str
    ) -> tuple[PurchaseRequestSummary, ...]:
        self.last_scope = (organization_id, event_id, requester_user_id)
        return self.summaries

    def get_detail(
        self, *, organization_id: str, event_id: str, request_id: str
    ) -> PurchaseRequestRecord | None:
        self.last_scope = (organization_id, event_id, request_id)
        return self.detail

    def get_detail_display_names(
        self, *, organization_id: str, event_id: str, requester_user_id: str
    ) -> PurchaseRequestDisplayNames | None:
        self.last_display_scope = (organization_id, event_id, requester_user_id)
        names = self.detail_display_names.get(self.last_display_scope)
        if names is None:
            return None
        return PurchaseRequestDisplayNames(event_name=names[0], requester_name=names[1])


class FakeSubmissionStore:
    def __init__(self, record: PurchaseRequestRecord) -> None:
        self.record = record
        self.idempotent_record: PurchaseRequestRecord | None = None
        self.last_idempotency_key: str | None = None
        self.last_idempotency_lookup_key: str | None = None

    def get_idempotent_result(
        self, submission: ValidatedPurchaseRequestSubmission
    ) -> PurchaseRequestRecord | None:
        self.last_idempotency_lookup_key = submission.idempotency_key
        return self.idempotent_record

    def submit(
        self, submission: ValidatedPurchaseRequestSubmission
    ) -> PurchaseRequestSubmissionOutcome:
        self.last_idempotency_key = submission.idempotency_key
        return PurchaseRequestSubmissionOutcome(record=self.record, replayed=False)


def _context(
    *,
    organization_id: str = "organization-a",
    user_id: str = "user-a",
    department_head: bool = True,
) -> FinanceRequestContext:
    identity = TrustedOrganizationContext(
        principal=CognitoPrincipal(
            issuer="https://cognito.example/pool-a", subject="subject-a"
        ),
        user_id=user_id,
        organization_id=organization_id,
        membership_id="membership-a",
        event_id="event-a",
        department_relationships=(
            DepartmentRelationshipFact(
                relationship_id="relationship-a", department_id="department-a"
            ),
        ),
    )
    return FinanceRequestContext(
        actor=PurchaseRequestActorFacts(
            identity=identity,
            department_head_of=(
                frozenset({"department-a"}) if department_head else frozenset()
            ),
        ),
        event_name="개강 행사",
        requester_name="요청자",
        request_department_id="department-a",
        request_department_name="기획부",
        available_budget=Decimal(100_000),
    )


def _content(*, needed_date: date = date(2999, 8, 20)) -> PurchaseRequestContent:
    return PurchaseRequestContent(
        title="행사 운영 물품",
        needed_date=needed_date,
        purpose="행사 운영",
        priority="urgent",
        items=(
            PurchaseRequestItemInput(
                name="현수막",
                category="홍보물",
                budget_item="행사운영비",
                purchase_type="general",
                quantity=Decimal(2),
                unit="개",
                estimated_unit_price=Decimal(10_000),
                price_evidence=(
                    {"type": "product_url", "url": "https://example.test/banner"},
                ),
                details={"vendor": "공급처 A"},
            ),
        ),
    )


def _record(*, content: PurchaseRequestContent | None = None) -> PurchaseRequestRecord:
    return PurchaseRequestRecord(
        request_id="request-001",
        organization_id="organization-a",
        event_id="event-a",
        requester_user_id="user-a",
        request_department_id="department-a",
        status="review_pending",
        content=content or _content(),
        item_results=(
            PurchaseRequestItemResult(
                item_id="item-001",
                item_position=0,
                estimated_amount=Decimal(20_000),
            ),
        ),
        estimated_total=Decimal(20_000),
        over_budget=False,
        created_at=datetime(2026, 8, 4, 1, 3, tzinfo=UTC),
    )


def _submission_body(purchase_type: str) -> dict[str, Any]:
    details_by_type: dict[str, dict[str, object]] = {
        "general": {
            "vendor": "공급처 A",
            "productUrl": "https://example.test/banner",
            "options": "대형",
            "deliveryRequest": "행사 전날 배송",
        },
        "manufacturing_printing": {
            "itemKind": "현수막",
            "specification": "2m x 1m",
            "color": "컬러",
            "optionQuantities": {"대형": 1},
            "printMethod": "실사 출력",
            "deliveryDate": "2999-08-19",
            "fileRefs": ["file-001"],
            "requestNote": "재단 포함",
        },
        "rental": {
            "vendor": "대여처 A",
            "pickupLocation": "학생회관",
            "startDate": "2999-08-19",
            "endDate": "2999-08-20",
            "contact": "02-0000-0000",
            "depositAmount": 10000,
            "conditions": "직접 반납",
        },
        "service": {
            "provider": "용역사 A",
            "location": "학생회관",
            "startDate": "2999-08-19",
            "endDate": "2999-08-20",
            "contact": "02-0000-0000",
            "scope": "행사 운영",
            "requestNote": "현장 지원 포함",
        },
    }
    evidence = (
        [{"type": "product_url", "url": "https://example.test/banner"}]
        if purchase_type == "general"
        else [
            {
                "type": "vendor_quote",
                "fileRef": "quote-001",
                "note": "전화 견적 확인",
            }
        ]
    )
    return {
        "content": {
            "title": "행사 운영 물품",
            "neededDate": "2999-08-20",
            "purpose": "행사 운영",
            "priority": "normal",
            "items": [
                {
                    "name": "구매 대상",
                    "category": "행사용품",
                    "budgetItem": "행사운영비",
                    "purchaseType": purchase_type,
                    "quantity": 1,
                    "unit": "개",
                    "estimatedUnitPrice": 10000,
                    "priceEvidence": evidence,
                    "details": details_by_type[purchase_type],
                }
            ],
        }
    }


def _first_submission_item(body: dict[str, Any]) -> dict[str, Any]:
    content = body["content"]
    assert isinstance(content, dict)
    items = content["items"]
    assert isinstance(items, list)
    item = items[0]
    assert isinstance(item, dict)
    return item


@cache
def _approved_submit_body_validator() -> Draft202012Validator:
    schema = schemathesis.openapi.from_path(
        Path(__file__).resolve().parents[4] / "contracts/openapi/CB-FIN-001/R1.json"
    )
    operation = schema["/events/{eventId}/purchase-requests"]["POST"]
    json_bodies: list[Any] = [
        component
        for component in cast(list[Any], operation.body)
        if component.media_type == "application/json"
    ]
    assert len(json_bodies) == 1
    return Draft202012Validator(json_bodies[0].validation_schema)


_OPTIONAL_NON_NULL_DETAIL_FIELDS = (
    ("general", "vendor"),
    ("general", "productUrl"),
    ("general", "options"),
    ("general", "deliveryRequest"),
    ("manufacturing_printing", "itemKind"),
    ("manufacturing_printing", "specification"),
    ("manufacturing_printing", "color"),
    ("manufacturing_printing", "optionQuantities"),
    ("manufacturing_printing", "printMethod"),
    ("manufacturing_printing", "deliveryDate"),
    ("manufacturing_printing", "fileRefs"),
    ("manufacturing_printing", "requestNote"),
    ("rental", "vendor"),
    ("rental", "pickupLocation"),
    ("rental", "startDate"),
    ("rental", "endDate"),
    ("rental", "contact"),
    ("rental", "depositAmount"),
    ("rental", "conditions"),
    ("service", "provider"),
    ("service", "location"),
    ("service", "startDate"),
    ("service", "endDate"),
    ("service", "contact"),
    ("service", "scope"),
    ("service", "requestNote"),
)


def _client(
    repository: FakePurchaseRequestRepository,
    *,
    context: FinanceRequestContext | None = None,
) -> tuple[TestClient, FakeSubmissionStore]:
    submission_store = FakeSubmissionStore(_record())
    service = PurchaseRequestService(
        repository,
        submission_store,
        relationship_reader=repository,
    )
    app = create_app()
    app.dependency_overrides[get_purchase_request_context] = lambda: (
        context or _context()
    )
    app.dependency_overrides[get_purchase_request_service] = lambda: service
    return TestClient(app), submission_store


def test_editor_state_and_draft_lifecycle_use_server_derived_scope() -> None:
    repository = FakePurchaseRequestRepository()
    client, _ = _client(repository)

    empty = client.get("/events/event-a/purchase-request-editor")
    assert empty.status_code == 200
    assert empty.json() == {
        "organizationId": "organization-a",
        "eventId": "event-a",
        "eventName": "개강 행사",
        "requesterUserId": "user-a",
        "requesterName": "요청자",
        "requestDepartmentId": "department-a",
        "requestDepartmentName": "기획부",
        "draft": None,
    }

    saved = client.put(
        "/events/event-a/purchase-request-draft",
        json={
            "expectedVersion": None,
            "content": {"title": "작성 중", "items": []},
        },
    )
    assert saved.status_code == 200
    assert saved.json()["version"] == 1
    assert repository.last_scope == ("organization-a", "event-a", "user-a")

    restored = client.get("/events/event-a/purchase-request-editor")
    assert restored.json()["draft"]["content"] == {
        "title": "작성 중",
        "items": [],
    }

    deleted = client.delete("/events/event-a/purchase-request-draft")
    assert deleted.status_code == 204
    assert deleted.content == b""


def test_draft_preserves_incomplete_values_until_submission_validation() -> None:
    repository = FakePurchaseRequestRepository()
    client, _ = _client(repository)

    response = client.put(
        "/events/event-a/purchase-request-draft",
        json={
            "expectedVersion": None,
            "content": {
                "items": [{"details": {"depositAmount": -1}}],
            },
        },
    )

    assert response.status_code == 200
    assert response.json()["content"]["items"][0]["details"]["depositAmount"] == -1


def test_draft_numbers_remain_json_numbers() -> None:
    repository = FakePurchaseRequestRepository()
    client, _ = _client(repository)

    saved = client.put(
        "/events/event-a/purchase-request-draft",
        json={
            "expectedVersion": None,
            "content": {"items": [{"quantity": 1.5}]},
        },
    )

    assert saved.status_code == 200
    quantity = saved.json()["content"]["items"][0]["quantity"]
    assert isinstance(quantity, (int, float)) and not isinstance(quantity, bool)
    assert quantity == 1.5


def test_draft_rejects_an_explicit_null_evidence_type_without_overwriting() -> None:
    repository = FakePurchaseRequestRepository()
    client, _ = _client(repository)
    initial = client.put(
        "/events/event-a/purchase-request-draft",
        json={"expectedVersion": None, "content": {"title": "작성 중"}},
    )
    assert initial.status_code == 200

    rejected = client.put(
        "/events/event-a/purchase-request-draft",
        json={
            "expectedVersion": 1,
            "content": {
                "items": [{"priceEvidence": [{"type": None}]}],
            },
        },
    )

    assert rejected.status_code == 422
    assert repository.draft is not None
    assert repository.draft.version == 1


def test_purchase_request_numbers_reject_json_strings() -> None:
    repository = FakePurchaseRequestRepository()
    client, submission_store = _client(repository)

    draft = client.put(
        "/events/event-a/purchase-request-draft",
        json={
            "expectedVersion": None,
            "content": {"items": [{"quantity": "1.5"}]},
        },
    )
    submitted = client.post(
        "/events/event-a/purchase-requests",
        headers={"Idempotency-Key": "string-number-001"},
        json={
            "content": {
                "title": "행사 운영 물품",
                "neededDate": "2999-08-20",
                "purpose": "행사 운영",
                "priority": "normal",
                "items": [
                    {
                        "name": "현수막",
                        "category": "홍보물",
                        "budgetItem": "행사운영비",
                        "purchaseType": "general",
                        "quantity": "2",
                        "unit": "개",
                        "estimatedUnitPrice": 10000,
                        "priceEvidence": [
                            {
                                "type": "product_url",
                                "url": "https://example.test/banner",
                            }
                        ],
                        "details": {},
                    }
                ],
            }
        },
    )

    assert draft.status_code == 422
    assert submitted.status_code == 422
    assert submission_store.last_idempotency_key is None


def test_draft_integer_fields_reject_json_strings_without_overwriting() -> None:
    payloads: tuple[dict[str, object], ...] = (
        {
            "expectedVersion": "1",
            "content": {"title": "버전 문자열"},
        },
        {
            "expectedVersion": 1,
            "content": {"items": [{"estimatedUnitPrice": "10000"}]},
        },
        {
            "expectedVersion": 1,
            "content": {"items": [{"details": {"depositAmount": "1000"}}]},
        },
    )

    for payload in payloads:
        repository = FakePurchaseRequestRepository()
        client, _ = _client(repository)
        initial = client.put(
            "/events/event-a/purchase-request-draft",
            json={"expectedVersion": None, "content": {"title": "기존 초안"}},
        )
        assert initial.status_code == 200

        rejected = client.put(
            "/events/event-a/purchase-request-draft",
            json=payload,
        )

        assert rejected.status_code == 422, payload
        assert repository.draft is not None
        assert repository.draft.version == 1
        assert repository.draft.content == {"title": "기존 초안"}


def test_submission_integer_fields_reject_json_strings_without_creating() -> None:
    valid_item: dict[str, object] = {
        "name": "현수막",
        "category": "홍보물",
        "budgetItem": "행사운영비",
        "purchaseType": "general",
        "quantity": 1,
        "unit": "개",
        "estimatedUnitPrice": 10000,
        "priceEvidence": [
            {
                "type": "product_url",
                "url": "https://example.test/banner",
            }
        ],
        "details": {},
    }
    payloads: tuple[tuple[dict[str, object], dict[str, object] | None], ...] = (
        ({**valid_item, "estimatedUnitPrice": "10000"}, None),
        (
            {
                **valid_item,
                "purchaseType": "rental",
                "priceEvidence": [{"type": "vendor_quote", "note": "전화 견적"}],
                "details": {"depositAmount": "1000"},
            },
            None,
        ),
        (valid_item, {"draftId": "draft-001", "version": "1"}),
    )

    for index, (item, draft_ref) in enumerate(payloads, start=1):
        repository = FakePurchaseRequestRepository()
        client, submission_store = _client(repository)
        rejected = client.post(
            "/events/event-a/purchase-requests",
            headers={"Idempotency-Key": f"integer-string-{index}"},
            json={
                "content": {
                    "title": "행사 운영 물품",
                    "neededDate": "2999-08-20",
                    "purpose": "행사 운영",
                    "priority": "normal",
                    "items": [item],
                },
                "draftRef": draft_ref,
            },
        )

        assert rejected.status_code == 422, item
        assert submission_store.last_idempotency_key is None


def test_delayed_same_submission_retry_returns_the_original_result() -> None:
    repository = FakePurchaseRequestRepository()
    client, submission_store = _client(repository)
    original = _record(content=_content(needed_date=date(2000, 1, 1)))
    submission_store.idempotent_record = original

    response = client.post(
        "/events/event-a/purchase-requests",
        headers={"Idempotency-Key": "delayed-retry-001"},
        json={
            "content": {
                "title": "행사 운영 물품",
                "neededDate": "2000-01-01",
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
                    }
                ],
            }
        },
    )

    assert response.status_code == 201
    assert response.json()["requestId"] == original.request_id
    assert response.json()["content"]["neededDate"] == "2000-01-01"
    assert submission_store.last_idempotency_lookup_key == "delayed-retry-001"
    assert submission_store.last_idempotency_key is None


def test_invalid_submission_returns_problem_details_without_calling_store() -> None:
    repository = FakePurchaseRequestRepository()
    client, submission_store = _client(repository)

    response = client.post(
        "/events/event-a/purchase-requests",
        headers={"Idempotency-Key": "request-key-001"},
        json={"content": {"title": "", "items": []}},
    )

    assert response.status_code == 422
    assert response.headers["content-type"].startswith("application/problem+json")
    problem = response.json()
    assert problem["code"] == "PURCHASE_REQUEST_VALIDATION_FAILED"
    assert {violation["path"] for violation in problem["fieldViolations"]} >= {
        "/content/title",
        "/content/items",
    }
    assert submission_store.last_idempotency_key is None


@pytest.mark.parametrize(
    ("purchase_type", "field_name"),
    _OPTIONAL_NON_NULL_DETAIL_FIELDS,
)
def test_submission_rejects_explicit_null_optional_detail_fields(
    purchase_type: str,
    field_name: str,
) -> None:
    repository = FakePurchaseRequestRepository()
    client, submission_store = _client(repository)
    body = _submission_body(purchase_type)
    details = _first_submission_item(body)["details"]
    assert isinstance(details, dict)
    details[field_name] = None

    response = client.post(
        "/events/event-a/purchase-requests",
        headers={"Idempotency-Key": f"null-{purchase_type}-{field_name}"},
        json=body,
    )

    assert not _approved_submit_body_validator().is_valid(body)
    assert response.status_code == 422
    assert submission_store.last_idempotency_key is None


@pytest.mark.parametrize("field_name", ("fileRef", "note"))
def test_submission_rejects_explicit_null_optional_quote_fields(
    field_name: str,
) -> None:
    repository = FakePurchaseRequestRepository()
    client, submission_store = _client(repository)
    body = _submission_body("service")
    evidence = _first_submission_item(body)["priceEvidence"]
    assert isinstance(evidence, list)
    quote = evidence[0]
    assert isinstance(quote, dict)
    quote[field_name] = None

    response = client.post(
        "/events/event-a/purchase-requests",
        headers={"Idempotency-Key": f"null-quote-{field_name}"},
        json=body,
    )

    assert not _approved_submit_body_validator().is_valid(body)
    assert response.status_code == 422
    assert submission_store.last_idempotency_key is None


@pytest.mark.parametrize("omitted_field", ("fileRef", "note"))
def test_submission_allows_one_omitted_optional_quote_field(
    omitted_field: str,
) -> None:
    repository = FakePurchaseRequestRepository()
    client, submission_store = _client(repository)
    body = _submission_body("service")
    evidence = _first_submission_item(body)["priceEvidence"]
    assert isinstance(evidence, list)
    quote = evidence[0]
    assert isinstance(quote, dict)
    quote.pop(omitted_field)

    response = client.post(
        "/events/event-a/purchase-requests",
        headers={"Idempotency-Key": f"omitted-quote-{omitted_field}"},
        json=body,
    )

    assert _approved_submit_body_validator().is_valid(body)
    assert response.status_code == 201
    assert submission_store.last_idempotency_key == f"omitted-quote-{omitted_field}"


def test_submission_rejects_explicit_null_optional_draft_reference() -> None:
    repository = FakePurchaseRequestRepository()
    client, submission_store = _client(repository)
    body = _submission_body("general")
    body["draftRef"] = None

    response = client.post(
        "/events/event-a/purchase-requests",
        headers={"Idempotency-Key": "null-draft-ref"},
        json=body,
    )

    assert not _approved_submit_body_validator().is_valid(body)
    assert response.status_code == 422
    assert submission_store.last_idempotency_key is None


@pytest.mark.parametrize(
    "purchase_type",
    ("general", "manufacturing_printing", "rental", "service"),
)
def test_submission_allows_omitted_optional_detail_fields(
    purchase_type: str,
) -> None:
    repository = FakePurchaseRequestRepository()
    client, submission_store = _client(repository)
    body = _submission_body(purchase_type)
    _first_submission_item(body)["details"] = {}

    response = client.post(
        "/events/event-a/purchase-requests",
        headers={"Idempotency-Key": f"omitted-{purchase_type}"},
        json=body,
    )

    assert _approved_submit_body_validator().is_valid(body)
    assert response.status_code == 201
    assert submission_store.last_idempotency_key == f"omitted-{purchase_type}"


def test_submission_rejects_a_past_needed_date_without_calling_store() -> None:
    repository = FakePurchaseRequestRepository()
    client, submission_store = _client(repository)

    response = client.post(
        "/events/event-a/purchase-requests",
        headers={"Idempotency-Key": "past-date-001"},
        json={
            "content": {
                "title": "행사 운영 물품",
                "neededDate": "2000-01-01",
                "purpose": "행사 운영",
                "priority": "normal",
                "items": [
                    {
                        "name": "현수막",
                        "category": "홍보물",
                        "budgetItem": "행사운영비",
                        "purchaseType": "general",
                        "quantity": 1,
                        "unit": "개",
                        "estimatedUnitPrice": 10000,
                        "priceEvidence": [
                            {
                                "type": "product_url",
                                "url": "https://example.test/banner",
                            }
                        ],
                        "details": {},
                    }
                ],
            }
        },
    )

    assert response.status_code == 422
    assert {violation["path"] for violation in response.json()["fieldViolations"]} >= {
        "/content/neededDate"
    }
    assert submission_store.last_idempotency_key is None


def test_submit_and_own_list_keep_identity_and_amounts_server_owned() -> None:
    repository = FakePurchaseRequestRepository()
    repository.summaries = (
        PurchaseRequestSummary(
            request_id="request-001",
            title="행사 운영 물품",
            status="review_pending",
            estimated_total=Decimal(20_000),
            over_budget=False,
            created_at=datetime(2026, 8, 4, 1, 3, tzinfo=UTC),
        ),
    )
    client, submission_store = _client(repository)

    response = client.post(
        "/events/event-a/purchase-requests",
        headers={"Idempotency-Key": "request-key-001"},
        json={
            "content": {
                "title": "행사 운영 물품",
                "neededDate": "2999-08-20",
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
                    }
                ],
            }
        },
    )

    assert response.status_code == 201
    assert response.json()["requesterUserId"] == "user-a"
    assert response.json()["estimatedTotal"] == 20000
    quantity = response.json()["content"]["items"][0]["quantity"]
    assert isinstance(quantity, (int, float)) and not isinstance(quantity, bool)
    assert quantity == 2
    assert submission_store.last_idempotency_key == "request-key-001"

    listed = client.get("/events/event-a/purchase-requests/mine")
    assert listed.status_code == 200
    assert [item["requestId"] for item in listed.json()["items"]] == ["request-001"]
    assert repository.last_scope == ("organization-a", "event-a", "user-a")


def test_detail_is_scoped_and_missing_or_cross_organization_is_same_404() -> None:
    repository = FakePurchaseRequestRepository()
    client, _ = _client(repository)

    missing = client.get("/events/event-a/purchase-requests/request-unknown")
    assert missing.status_code == 404
    assert missing.json()["code"] == "RESOURCE_NOT_FOUND"
    assert repository.last_scope == (
        "organization-a",
        "event-a",
        "request-unknown",
    )

    other_org_client, _ = _client(repository, context=_context(organization_id="other"))
    hidden = other_org_client.get("/events/event-a/purchase-requests/request-001")
    assert hidden.status_code == 404
    assert {
        key: value for key, value in hidden.json().items() if key != "instance"
    } == {key: value for key, value in missing.json().items() if key != "instance"}


def test_detail_resolves_display_names_from_the_stored_relationship_ids() -> None:
    repository = FakePurchaseRequestRepository()
    repository.detail = _record()
    repository.detail_display_names[("organization-a", "event-a", "user-a")] = (
        "저장된 행사의 이름",
        "실제 제출자",
    )
    client, _ = _client(repository, context=_context(user_id="user-b"))

    response = client.get("/events/event-a/purchase-requests/request-001")

    assert response.status_code == 200
    detail = cast(dict[str, Any], response.json())
    assert set(detail) == {"record", "display"}
    record = cast(dict[str, object], detail["record"])
    assert record["requestId"] == "request-001"
    assert record["eventId"] == "event-a"
    assert record["requesterUserId"] == "user-a"
    assert "eventName" not in record
    assert "requesterName" not in record
    assert cast(dict[str, object], detail["display"]) == {
        "eventName": "저장된 행사의 이름",
        "requesterName": "실제 제출자",
    }
    assert repository.last_display_scope == (
        "organization-a",
        "event-a",
        "user-a",
    )


def test_detail_returns_503_when_stored_relationship_names_are_missing() -> None:
    repository = FakePurchaseRequestRepository()
    repository.detail = _record()
    repository.detail_display_names.clear()
    client, _ = _client(repository)

    response = client.get("/events/event-a/purchase-requests/request-001")

    assert response.status_code == 503
    assert response.json()["code"] == "PURCHASE_REQUEST_PERSISTENCE_UNAVAILABLE"


def test_stored_request_remains_readable_after_its_needed_date_passes() -> None:
    repository = FakePurchaseRequestRepository()
    repository.detail = _record(content=_content(needed_date=date(2000, 1, 1)))
    client, _ = _client(repository)

    response = client.get("/events/event-a/purchase-requests/request-001")

    assert response.status_code == 200
    assert response.json()["record"]["content"]["neededDate"] == "2000-01-01"


def test_permission_and_persistence_failures_are_stable_problem_details() -> None:
    repository = FakePurchaseRequestRepository()
    forbidden_client, _ = _client(repository, context=_context(department_head=False))

    forbidden = forbidden_client.get("/events/event-a/purchase-request-editor")
    assert forbidden.status_code == 403
    assert forbidden.json()["code"] == "PURCHASE_REQUEST_ACTION_FORBIDDEN"

    def fail_get_draft(**_scope: str) -> None:
        raise PurchaseRequestPersistenceError

    repository.get_draft = fail_get_draft  # type: ignore[method-assign]
    unavailable_client, _ = _client(repository)
    unavailable = unavailable_client.get("/events/event-a/purchase-request-editor")
    assert unavailable.status_code == 503
    assert unavailable.headers["content-type"].startswith("application/problem+json")
    assert unavailable.json()["code"] == "PURCHASE_REQUEST_PERSISTENCE_UNAVAILABLE"

    unauthenticated = TestClient(create_app()).get(
        "/events/event-a/purchase-request-editor"
    )
    assert unauthenticated.status_code == 401
    assert unauthenticated.json()["code"] == "UNAUTHENTICATED"


def test_purchase_request_validation_handler_does_not_relabel_other_domains() -> None:
    app = create_app()

    def example(value: int) -> dict[str, int]:
        return {"value": value}

    app.add_api_route("/example/{value}", example, methods=["GET"])
    response = TestClient(app).get("/example/not-an-integer")

    assert response.status_code == 422
    assert response.headers["content-type"].startswith("application/json")
    assert "code" not in response.json()
    assert response.json()["detail"]


def test_routes_expose_contract_traceability_metadata() -> None:
    openapi = create_app().openapi()
    canonical = json.loads(
        (
            Path(__file__).resolve().parents[4] / "contracts/openapi/CB-FIN-001/R1.json"
        ).read_text(encoding="utf-8")
    )

    expected = {
        ("/events/{eventId}/purchase-request-editor", "get"): (
            "purchase_request.draft_read",
            "API:purchase_request.get_editor_state@R1",
        ),
        ("/events/{eventId}/purchase-request-draft", "put"): (
            "purchase_request.draft_write",
            "API:purchase_request.save_draft@R1",
        ),
        ("/events/{eventId}/purchase-request-draft", "delete"): (
            "purchase_request.draft_delete",
            "API:purchase_request.delete_draft@R1",
        ),
        ("/events/{eventId}/purchase-requests", "post"): (
            "purchase_request.submit",
            "API:purchase_request.submit@R1",
        ),
        ("/events/{eventId}/purchase-requests/mine", "get"): (
            "purchase_request.list_own",
            "API:purchase_request.list_own@R1",
        ),
        ("/events/{eventId}/purchase-requests/{requestId}", "get"): (
            "purchase_request.read_detail",
            "API:purchase_request.get_detail@R2",
        ),
    }
    for (path, method), (permission, contract) in expected.items():
        operation = openapi["paths"][path][method]
        canonical_operation = canonical["paths"][path][method]
        assert operation["x-vada-permission"] == permission
        assert contract in operation["x-vada-contracts"]
        assert operation["x-vada-acceptance-criteria"]
        for key in (
            "operationId",
            "x-vada-permission",
            "x-vada-contracts",
            "x-vada-acceptance-criteria",
        ):
            if key == "x-vada-contracts" and contract.endswith("get_detail@R2"):
                continue
            assert operation[key] == canonical_operation[key]
        assert set(operation["responses"]) == set(canonical_operation["responses"])
        for status, response in canonical_operation["responses"].items():
            assert operation["responses"][status].get(
                "x-vada-contract"
            ) == response.get("x-vada-contract")
            assert set(operation["responses"][status].get("content", {})) == set(
                response.get("content", {})
            )

    schemas = openapi["components"]["schemas"]
    detail_operation = openapi["paths"][
        "/events/{eventId}/purchase-requests/{requestId}"
    ]["get"]
    assert (
        "DATA:purchase_request.detail_view@R1" in detail_operation["x-vada-contracts"]
    )
    detail_schema = schemas["PurchaseRequestDetailViewResponse"]
    assert set(detail_schema["required"]) == {"record", "display"}
    assert set(schemas["PurchaseRequestDisplayResponse"]["required"]) == {
        "eventName",
        "requesterName",
    }
    assert schemas["JsonNumberDecimal"] == {"type": "number"}
    assert schemas["PositiveJsonNumberDecimal"] == {
        "type": "number",
        "exclusiveMinimum": 0,
    }
    assert schemas["PositiveJsonInteger"] == {
        "type": "integer",
        "exclusiveMinimum": 0,
    }
    assert schemas["NonNegativeJsonInteger"] == {
        "type": "integer",
        "minimum": 0,
    }
    item_schema = schemas["PurchaseRequestItemModel"]
    assert len(item_schema["oneOf"]) == 4
    assert item_schema["discriminator"]["propertyName"] == "purchaseType"
    general_contains = schemas["GeneralPurchaseRequestItemModel"]["properties"][
        "priceEvidence"
    ]["contains"]
    assert set(general_contains["properties"]["type"]["enum"]) == {
        "product_url",
        "vendor",
        "price_screenshot",
    }
    for model_name in (
        "ManufacturingPrintingPurchaseRequestItemModel",
        "RentalPurchaseRequestItemModel",
        "ServicePurchaseRequestItemModel",
    ):
        assert (
            schemas[model_name]["properties"]["priceEvidence"]["contains"][
                "properties"
            ]["type"]["const"]
            == "vendor_quote"
        )
