# pyright: reportUnknownMemberType=false, reportUnknownVariableType=false
# ↑ test_health.py와 같은 한계다. starlette TestClient의 httpx 조건부 import로
#   반환 타입이 Unknown이 된다. 이 파일에만 적용한다.
from __future__ import annotations

from datetime import UTC, date, datetime
from decimal import Decimal

import httpx
import pytest
from fastapi.testclient import TestClient
from test_purchase_request_api import (
    FakePurchaseRequestRepository,
    FakeSubmissionStore,
)

from vada_api.finance.api import (
    get_purchase_request_context,
    get_purchase_request_service,
)
from vada_api.finance.application import (
    FinanceRequestContext,
    PurchaseRequestService,
)
from vada_api.finance.authorization import PurchaseRequestActorFacts
from vada_api.finance.review import ItemReviewState, ItemReviewStatus
from vada_api.finance.submission import (
    PurchaseRequestContent,
    PurchaseRequestItemInput,
    PurchaseRequestItemResult,
    PurchaseRequestRecord,
)
from vada_api.identity.authentication import CognitoPrincipal
from vada_api.identity.context import (
    DepartmentRelationshipFact,
    TrustedOrganizationContext,
)
from vada_api.main import create_app


def build_record() -> PurchaseRequestRecord:
    """검토 대상 요청. 품목 하나면 이 화면의 규칙을 다 확인할 수 있다."""

    return PurchaseRequestRecord(
        request_id="request-001",
        organization_id="organization-a",
        event_id="event-a",
        requester_user_id="user-requester",
        request_department_id="department-a",
        status="review_pending",
        content=PurchaseRequestContent(
            title="체육대회 운영 물품",
            needed_date=date(2999, 8, 21),
            purpose="행사 운영",
            priority="normal",
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
        ),
        item_results=(
            PurchaseRequestItemResult(
                item_id="item-001", item_position=0, estimated_amount=Decimal(20_000)
            ),
        ),
        estimated_total=Decimal(20_000),
        over_budget=False,
        created_at=datetime(2026, 8, 4, 1, 3, tzinfo=UTC),
    )


def build_context(*, finance: bool) -> FinanceRequestContext:
    """재정부 또는 부서장 맥락. 검토 권한이 갈리는 축만 다르게 둔다."""

    identity = TrustedOrganizationContext(
        principal=CognitoPrincipal(
            issuer="https://cognito.example/pool-a", subject="subject-a"
        ),
        user_id="user-a",
        organization_id="organization-a",
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
            department_head_of=frozenset() if finance else frozenset({"department-a"}),
            finance_member_of=(
                frozenset({"organization-a"}) if finance else frozenset()
            ),
        ),
        event_name="개강 행사",
        requester_name="요청자",
        request_department_id="department-a",
        request_department_name="기획부",
        available_budget=Decimal(100_000),
    )


REVIEW_PATH = "/events/event-a/purchase-requests/request-001/review"
DECIDE_PATH = "/events/event-a/purchase-requests/request-001/items/item-001/review"


class FakeReviewStore:
    """품목마다 마지막 결정을 들고 있는 최소 저장소."""

    def __init__(self) -> None:
        self.states: dict[str, ItemReviewState] = {}
        self.recorded: list[tuple[str, str]] = []

    def current_states(
        self, *, organization_id: str, event_id: str, request_id: str
    ) -> tuple[ItemReviewState, ...]:
        del organization_id, event_id, request_id
        return tuple(self.states.values())

    def record(
        self,
        state: ItemReviewState,
        *,
        organization_id: str,
        event_id: str,
        request_id: str,
        decided_by_user_id: str,
    ) -> None:
        del organization_id, event_id, request_id
        self.states[state.item_id] = state
        self.recorded.append((state.item_id, decided_by_user_id))


def _client(*, finance: bool = True) -> tuple[TestClient, FakeReviewStore]:
    repository = FakePurchaseRequestRepository()
    record = build_record()
    repository.detail = record
    # 표시 이름은 서버가 관계에서 조회한다. 없으면 신뢰할 값이 없어 503이 된다.
    repository.detail_display_names[
        (record.organization_id, record.event_id, record.requester_user_id)
    ] = ("개강 행사", "요청자")
    review_store = FakeReviewStore()
    service = PurchaseRequestService(
        repository,
        FakeSubmissionStore(build_record()),
        relationship_reader=repository,
        review_store=review_store,
    )
    context = build_context(finance=finance)

    app = create_app()
    app.dependency_overrides[get_purchase_request_context] = lambda: context
    app.dependency_overrides[get_purchase_request_service] = lambda: service
    return TestClient(app), review_store


def test_review_lists_every_item_even_before_any_decision() -> None:
    client, _ = _client()

    response: httpx.Response = client.get(REVIEW_PATH)

    assert response.status_code == 200
    body = response.json()
    assert body["itemReviewStates"] == [
        {"itemId": "item-001", "reviewStatus": "review_pending"}
    ]
    assert body["detail"]["record"]["requestId"] == "request-001"


def test_approval_records_the_decision_without_any_amount() -> None:
    client, store = _client()

    response: httpx.Response = client.put(
        DECIDE_PATH,
        json={"decision": "approve", "expectedReviewStatus": "review_pending"},
    )

    assert response.status_code == 200
    assert response.json()["itemReviewStates"] == [
        {"itemId": "item-001", "reviewStatus": "approved"}
    ]
    assert store.recorded == [("item-001", "user-a")]


def test_revision_request_carries_its_reason_and_due_date() -> None:
    client, _ = _client()

    response: httpx.Response = client.put(
        DECIDE_PATH,
        json={
            "decision": "request_revision",
            "expectedReviewStatus": "review_pending",
            "revisionReason": "가격 근거가 없습니다.",
            "revisionDueDate": "2026-08-20",
        },
    )

    assert response.status_code == 200
    assert response.json()["itemReviewStates"] == [
        {
            "itemId": "item-001",
            "reviewStatus": "revision_requested",
            "revisionReason": "가격 근거가 없습니다.",
            "revisionDueDate": "2026-08-20",
        }
    ]


@pytest.mark.parametrize(
    "body",
    [
        {"decision": "request_revision", "expectedReviewStatus": "review_pending"},
        {
            "decision": "request_revision",
            "expectedReviewStatus": "review_pending",
            "revisionReason": "부족",
        },
        {"decision": "reject", "expectedReviewStatus": "review_pending"},
        {
            "decision": "approve",
            "expectedReviewStatus": "review_pending",
            "rejectionReason": "딸려 온 사유",
        },
    ],
)
def test_a_decision_missing_or_carrying_the_wrong_values_is_refused(
    body: dict[str, str],
) -> None:
    client, store = _client()

    response: httpx.Response = client.put(DECIDE_PATH, json=body)

    assert response.status_code == 422
    assert response.headers["content-type"].startswith("application/problem+json")
    assert store.recorded == [], "거부된 결정을 저장하지 않는다"


def test_a_stale_expected_status_conflicts_without_overwriting() -> None:
    client, store = _client()
    store.states["item-001"] = ItemReviewState("item-001", ItemReviewStatus.APPROVED)

    response: httpx.Response = client.put(
        DECIDE_PATH,
        json={
            "decision": "reject",
            "expectedReviewStatus": "review_pending",
            "rejectionReason": "철회",
        },
    )

    assert response.status_code == 409
    assert store.states["item-001"].review_status is ItemReviewStatus.APPROVED


def test_an_item_outside_this_request_is_not_found() -> None:
    client, _ = _client()

    response: httpx.Response = client.put(
        "/events/event-a/purchase-requests/request-001/items/item-999/review",
        json={"decision": "approve", "expectedReviewStatus": "review_pending"},
    )

    assert response.status_code == 404


def test_a_department_head_cannot_review() -> None:
    # 요청을 만들 수 있는 것과 검토할 수 있는 것은 다른 권한이다.
    client, store = _client(finance=False)

    read: httpx.Response = client.get(REVIEW_PATH)
    write: httpx.Response = client.put(
        DECIDE_PATH,
        json={"decision": "approve", "expectedReviewStatus": "review_pending"},
    )

    assert read.status_code == 403
    assert write.status_code == 403
    assert store.recorded == []


def test_the_decision_date_survives_the_round_trip() -> None:
    client, store = _client()
    client.put(
        DECIDE_PATH,
        json={
            "decision": "request_revision",
            "expectedReviewStatus": "review_pending",
            "revisionReason": "보완 필요",
            "revisionDueDate": "2026-08-20",
        },
    )

    assert store.states["item-001"].revision_due_date == date(2026, 8, 20)
