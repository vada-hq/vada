# pyright: reportUnknownArgumentType=false, reportUnknownMemberType=false, reportUnknownVariableType=false
from __future__ import annotations

from collections.abc import Generator
from datetime import UTC, date, datetime
from decimal import Decimal

import pytest
import sqlalchemy as sa
from fastapi.testclient import TestClient
from sqlalchemy import Engine, text

from vada_api.finance.api import (
    get_purchase_request_context,
    get_purchase_request_service,
)
from vada_api.finance.application import FinanceRequestContext, PurchaseRequestService
from vada_api.finance.authorization import PurchaseRequestActorFacts
from vada_api.finance.persistence.purchase_requests import (
    PostgreSQLPurchaseRequestRepository,
)
from vada_api.finance.persistence.schema import purchase_requests
from vada_api.finance.persistence.submission import (
    PostgreSQLPurchaseRequestSubmissionStore,
)
from vada_api.identity.authentication import CognitoPrincipal
from vada_api.identity.context import (
    DepartmentRelationshipFact,
    TrustedOrganizationContext,
)
from vada_api.main import create_app


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


def _client(engine: Engine, context: FinanceRequestContext) -> TestClient:
    service = PurchaseRequestService(
        PostgreSQLPurchaseRequestRepository(engine),
        PostgreSQLPurchaseRequestSubmissionStore(engine),
    )
    app = create_app()
    app.dependency_overrides[get_purchase_request_context] = lambda: context
    app.dependency_overrides[get_purchase_request_service] = lambda: service
    return TestClient(app)


def _submit_body(*, title: str = "행사 운영 물품") -> dict[str, object]:
    return {
        "content": {
            "title": title,
            "neededDate": date(2026, 8, 20).isoformat(),
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
def test_draft_api_lifecycle_is_versioned_and_isolated(
    migrated_engine: Engine,
) -> None:
    owner = _client(migrated_engine, _context())

    assert owner.get("/events/event-a/purchase-request-editor").json()["draft"] is None
    created = owner.put(
        "/events/event-a/purchase-request-draft",
        json={
            "expectedVersion": None,
            "content": {"title": "첫 초안", "items": []},
        },
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

    assert owner.delete("/events/event-a/purchase-request-draft").status_code == 204
    assert owner.get("/events/event-a/purchase-request-editor").json()["draft"] is None


@pytest.mark.postgres
def test_submit_list_and_detail_api_preserve_scope_and_idempotency(
    migrated_engine: Engine,
) -> None:
    owner = _client(
        migrated_engine,
        _context(available_budget=Decimal(1_000)),
    )
    body = _submit_body()
    first = owner.post(
        "/events/event-a/purchase-requests",
        headers={"Idempotency-Key": "submit-001"},
        json=body,
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

    own_list = owner.get("/events/event-a/purchase-requests/mine")
    assert own_list.status_code == 200
    assert [item["requestId"] for item in own_list.json()["items"]] == [
        second_request_id,
        request_id,
    ]

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

    same_org_member = _client(migrated_engine, _context(user_id="user-c"))
    assert same_org_member.get("/events/event-a/purchase-requests/mine").json() == {
        "items": []
    }
    detail_path = f"/events/event-a/purchase-requests/{request_id}"
    owner_detail = owner.get(detail_path)
    assert owner_detail.status_code == 200
    expected_detail = owner_detail.json()
    assert same_org_member.get(detail_path).json() == expected_detail
    assert same_org_member.get(detail_path).json() == expected_detail

    other_org = _client(
        migrated_engine, _context(organization_id="organization-b", user_id="user-b")
    )
    hidden = other_org.get(detail_path)
    assert hidden.status_code == 404
    assert hidden.json()["code"] == "RESOURCE_NOT_FOUND"


@pytest.mark.postgres
def test_invalid_submission_does_not_create_a_request(
    migrated_engine: Engine,
) -> None:
    client = _client(migrated_engine, _context())

    invalid = client.post(
        "/events/event-a/purchase-requests",
        headers={"Idempotency-Key": "invalid-001"},
        json={"content": {"title": "", "items": []}},
    )

    assert invalid.status_code == 422
    with migrated_engine.connect() as connection:
        assert (
            connection.scalar(sa.select(sa.func.count()).select_from(purchase_requests))
            == 0
        )
