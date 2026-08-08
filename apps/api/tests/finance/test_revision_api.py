# pyright: reportUnknownMemberType=false, reportUnknownVariableType=false
# pyright: reportUnknownArgumentType=false
# ↑ test_purchase_request_review_api.py와 같은 한계다. starlette TestClient의
#   httpx 조건부 import로 반환 타입이 Unknown이 된다. 이 파일에만 적용한다.
from __future__ import annotations

from collections.abc import Iterator
from datetime import date

import pytest
from fastapi.testclient import TestClient
from test_purchase_request_api import (
    FakePurchaseRequestRepository,
    FakeSubmissionStore,
)
from test_purchase_request_review_api import build_context, build_record

from vada_api.finance.api import (
    get_purchase_request_context,
    get_purchase_request_service,
)
from vada_api.finance.application import (
    OtherItemView,
    PurchaseRequestRevisionView,
    PurchaseRequestService,
    RevisionItemView,
)
from vada_api.finance.review import ItemReviewStatus
from vada_api.finance.revision import RevisionItemState, RevisionSubmission
from vada_api.main import create_app

REQUEST_ID = "request-001"
BASE = f"/events/event-a/purchase-requests/{REQUEST_ID}"
VIEW_PATH = f"{BASE}/revision"
SUBMIT_PATH = f"{BASE}/revisions"

SCOPE = ("organization-a", "event-a", REQUEST_ID)


class FakeRevisionStore:
    """조직 범위로 나뉜 요청을 들고 있는 최소 저장소.

    다른 조직의 요청을 일부러 함께 넣는다. 범위를 빼먹으면 그것이 응답에 섞여
    나오므로 크로스 테넌트 누출이 조용히 통과하지 못한다.
    """

    def __init__(self) -> None:
        self.states: dict[tuple[str, str, str], tuple[RevisionItemState, ...]] = {}
        self.appended: list[tuple[str, int]] = []
        self.keys: list[str] = []
        self.asked: list[tuple[str, str, str]] = []

    def revision_view(
        self, *, organization_id: str, event_id: str, request_id: str
    ) -> PurchaseRequestRevisionView | None:
        scope = (organization_id, event_id, request_id)
        self.asked.append(scope)
        states = self.states.get(scope)
        if states is None:
            return None
        return PurchaseRequestRevisionView(
            request_id=request_id,
            request_title="체육대회 운영 물품",
            revision_items=tuple(
                RevisionItemView(
                    item_id=state.item_id,
                    item_name=f"품목 {state.item_id}",
                    revision_reason="견적 근거를 보완해 주세요.",
                    revision_due_date=date(2999, 9, 1),
                    content={"name": f"품목 {state.item_id}"},
                )
                for state in states
                if state.review_status is ItemReviewStatus.REVISION_REQUESTED
            ),
            other_items=tuple(
                OtherItemView(
                    item_id=state.item_id,
                    item_name=f"품목 {state.item_id}",
                    review_status=state.review_status,
                    estimated_total_price=120_000,
                )
                for state in states
                if state.review_status is not ItemReviewStatus.REVISION_REQUESTED
            ),
        )

    def item_states(
        self, *, organization_id: str, event_id: str, request_id: str
    ) -> tuple[RevisionItemState, ...]:
        scope = (organization_id, event_id, request_id)
        self.asked.append(scope)
        return self.states.get(scope, ())

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
        self.keys.append(idempotency_key)
        for submission in submissions:
            self.appended.append((submission.item_id, submission.submission_number))


@pytest.fixture
def store() -> FakeRevisionStore:
    return FakeRevisionStore()


@pytest.fixture
def client(store: FakeRevisionStore) -> Iterator[TestClient]:
    service = PurchaseRequestService(
        FakePurchaseRequestRepository(),
        FakeSubmissionStore(build_record()),
        revision_store=store,
    )
    app = create_app()
    # 재정부 맥락이면 요청자 본인 조건만 남는다. 그 조건은 권한 테스트가 지킨다.
    app.dependency_overrides[get_purchase_request_context] = lambda: build_context(
        finance=True
    )
    app.dependency_overrides[get_purchase_request_service] = lambda: service
    with TestClient(app) as test_client:
        yield test_client


def _submission(*item_ids: str) -> dict[str, object]:
    return {
        "items": [
            {
                "itemId": item_id,
                "expectedReviewStatus": "revision_requested",
                "content": {"name": "고친 품목"},
            }
            for item_id in item_ids
        ]
    }


def test_the_view_separates_revisable_items_from_the_rest(
    store: FakeRevisionStore, client: TestClient
) -> None:
    store.states[SCOPE] = (
        RevisionItemState("i-1", ItemReviewStatus.REVISION_REQUESTED, 1),
        RevisionItemState("i-2", ItemReviewStatus.APPROVED, 1),
    )

    body = client.get(VIEW_PATH).json()

    # 고칠 수 있는 것과 없는 것을 서버가 구조로 가른다. 화면이 고를 일이 없다.
    assert [item["itemId"] for item in body["revisionItems"]] == ["i-1"]
    assert [item["itemId"] for item in body["otherItems"]] == ["i-2"]


def test_the_view_is_read_only_within_the_caller_organization(
    store: FakeRevisionStore, client: TestClient
) -> None:
    store.states[("organization-b", "event-a", REQUEST_ID)] = (
        RevisionItemState("i-9", ItemReviewStatus.REVISION_REQUESTED, 1),
    )

    assert client.get(VIEW_PATH).status_code == 404
    assert {organization for organization, _, _ in store.asked} == {"organization-a"}


def test_a_missing_request_and_another_organization_answer_the_same(
    client: TestClient,
) -> None:
    # 다른 조직에 그 요청이 있는지 떠볼 수 없어야 한다.
    assert client.get(VIEW_PATH).status_code == 404


def test_resubmitting_stacks_the_next_submission(
    store: FakeRevisionStore, client: TestClient
) -> None:
    store.states[SCOPE] = (
        RevisionItemState("i-1", ItemReviewStatus.REVISION_REQUESTED, 1),
    )

    response = client.post(
        SUBMIT_PATH, json=_submission("i-1"), headers={"Idempotency-Key": "key-1"}
    )

    assert response.status_code == 200
    assert store.appended == [("i-1", 2)]
    assert store.keys == ["key-1"]


def test_resubmitting_an_item_that_was_not_asked_to_be_revised_conflicts(
    store: FakeRevisionStore, client: TestClient
) -> None:
    # 계약이 expectedReviewStatus를 고정해 두어서, 보완 대상이 아닌 품목을
    # 담는다는 것은 곧 화면이 본 상태가 낡았다는 뜻이다.
    store.states[SCOPE] = (RevisionItemState("i-1", ItemReviewStatus.REJECTED, 1),)

    response = client.post(
        SUBMIT_PATH, json=_submission("i-1"), headers={"Idempotency-Key": "key-1"}
    )

    assert response.status_code == 409
    assert response.headers["content-type"].startswith("application/problem+json")
    assert store.appended == []


def test_resubmitting_an_unknown_item_is_not_found(
    store: FakeRevisionStore, client: TestClient
) -> None:
    store.states[SCOPE] = (
        RevisionItemState("i-1", ItemReviewStatus.REVISION_REQUESTED, 1),
    )

    response = client.post(
        SUBMIT_PATH, json=_submission("i-9"), headers={"Idempotency-Key": "key-1"}
    )

    assert response.status_code == 404
    assert store.appended == []


def test_an_empty_submission_is_rejected_before_it_reaches_the_store(
    store: FakeRevisionStore, client: TestClient
) -> None:
    store.states[SCOPE] = (
        RevisionItemState("i-1", ItemReviewStatus.REVISION_REQUESTED, 1),
    )

    response = client.post(
        SUBMIT_PATH, json={"items": []}, headers={"Idempotency-Key": "key-1"}
    )

    assert response.status_code == 422
    assert store.appended == []


def test_resubmitting_requires_an_idempotency_key(
    store: FakeRevisionStore, client: TestClient
) -> None:
    # 키가 없으면 재시도가 제출본을 두 벌 쌓는다.
    store.states[SCOPE] = (
        RevisionItemState("i-1", ItemReviewStatus.REVISION_REQUESTED, 1),
    )

    response = client.post(SUBMIT_PATH, json=_submission("i-1"))

    assert response.status_code == 422
    assert store.appended == []


def test_resubmitting_never_writes_outside_the_caller_organization(
    store: FakeRevisionStore, client: TestClient
) -> None:
    store.states[("organization-b", "event-a", REQUEST_ID)] = (
        RevisionItemState("i-1", ItemReviewStatus.REVISION_REQUESTED, 1),
    )

    response = client.post(
        SUBMIT_PATH, json=_submission("i-1"), headers={"Idempotency-Key": "key-1"}
    )

    assert response.status_code == 404
    assert store.appended == []
    assert {organization for organization, _, _ in store.asked} == {"organization-a"}
