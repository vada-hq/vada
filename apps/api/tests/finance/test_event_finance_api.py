# pyright: reportUnknownMemberType=false, reportUnknownVariableType=false
# pyright: reportUnknownArgumentType=false
# ↑ test_purchase_request_review_api.py와 같은 한계다. starlette TestClient의
#   httpx 조건부 import로 반환 타입이 Unknown이 된다. 이 파일에만 적용한다.
from __future__ import annotations

from collections.abc import Iterator

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
from vada_api.finance.application import FinanceRequestContext, PurchaseRequestService
from vada_api.finance.event_finance import EventBudgetSummary, EventItemFact
from vada_api.finance.review import ItemReviewStatus
from vada_api.main import create_app

BUDGET_PATH = "/events/event-a/budget-summary"
ITEMS_PATH = "/events/event-a/purchase-request-items"


class FakeEventFinanceReader:
    """조직 범위로 나뉜 품목을 들고 있는 최소 저장소.

    다른 조직의 행을 일부러 함께 넣는다. 범위를 빼먹으면 그것이 응답에 섞여
    나오므로, 크로스 테넌트 누출이 조용히 통과하지 못한다.
    """

    def __init__(self) -> None:
        self.rows: dict[tuple[str, str], tuple[EventItemFact, ...]] = {}
        self.budgets: dict[tuple[str, str], EventBudgetSummary] = {}
        self.asked: list[tuple[str, str]] = []

    def budget_summary(
        self, *, organization_id: str, event_id: str
    ) -> EventBudgetSummary:
        self.asked.append((organization_id, event_id))
        return self.budgets.get(
            (organization_id, event_id),
            EventBudgetSummary(allocated_total=0, committed_total=0),
        )

    def active_items(
        self, *, organization_id: str, event_id: str
    ) -> tuple[EventItemFact, ...]:
        self.asked.append((organization_id, event_id))
        return self.rows.get((organization_id, event_id), ())


def item(
    item_id: str,
    status: ItemReviewStatus,
    *,
    requester_user_id: str = "user-a",
    name: str = "현수막",
) -> EventItemFact:
    return EventItemFact(
        item_id=item_id,
        request_id="request-001",
        item_name=name,
        requester_user_id=requester_user_id,
        requester_name="박해랑",
        request_department_name="기획부",
        estimated_total_price=120_000,
        review_status=status,
    )


@pytest.fixture
def reader() -> FakeEventFinanceReader:
    return FakeEventFinanceReader()


def build_client(
    reader: FakeEventFinanceReader, context: FinanceRequestContext
) -> Iterator[TestClient]:
    service = PurchaseRequestService(
        FakePurchaseRequestRepository(),
        FakeSubmissionStore(build_record()),
        event_finance_reader=reader,
    )
    app = create_app()
    app.dependency_overrides[get_purchase_request_context] = lambda: context
    app.dependency_overrides[get_purchase_request_service] = lambda: service
    with TestClient(app) as client:
        yield client


@pytest.fixture
def member_client(reader: FakeEventFinanceReader) -> Iterator[TestClient]:
    yield from build_client(reader, build_context(finance=False))


@pytest.fixture
def finance_client(reader: FakeEventFinanceReader) -> Iterator[TestClient]:
    yield from build_client(reader, build_context(finance=True))


def test_budget_summary_reports_the_reservation_against_the_allocation(
    reader: FakeEventFinanceReader, member_client: TestClient
) -> None:
    reader.budgets[("organization-a", "event-a")] = EventBudgetSummary(
        allocated_total=1_000_000, committed_total=250_000
    )

    response = member_client.get(BUDGET_PATH)

    assert response.status_code == 200
    assert response.json() == {
        "allocatedTotal": 1_000_000,
        "committedTotal": 250_000,
        "availableTotal": 750_000,
    }


def test_budget_summary_reports_a_negative_available_total_when_unallocated(
    reader: FakeEventFinanceReader, member_client: TestClient
) -> None:
    # 배정을 만드는 흐름이 없어 배정은 늘 0이다. 음수를 0으로 깎아 내려보내면
    # 화면이 "미배정"과 "딱 맞게 쓴 상태"를 구분할 수 없다.
    reader.budgets[("organization-a", "event-a")] = EventBudgetSummary(
        allocated_total=0, committed_total=250_000
    )

    assert member_client.get(BUDGET_PATH).json()["availableTotal"] == -250_000


def test_event_items_are_read_only_within_the_caller_organization(
    reader: FakeEventFinanceReader, member_client: TestClient
) -> None:
    reader.rows[("organization-a", "event-a")] = (
        item("item-001", ItemReviewStatus.REVIEW_PENDING),
    )
    reader.rows[("organization-b", "event-a")] = (
        item("item-999", ItemReviewStatus.REVIEW_PENDING, name="다른 학생회 물품"),
    )

    body = member_client.get(ITEMS_PATH).json()

    assert [entry["itemId"] for entry in body["items"]] == ["item-001"]
    assert reader.asked == [("organization-a", "event-a")]


def test_event_items_never_read_an_organization_the_caller_does_not_belong_to(
    reader: FakeEventFinanceReader, member_client: TestClient
) -> None:
    # 경로에 행사 식별자가 있어도 조직은 신뢰 맥락에서만 온다. 저장소에 물어본
    # 조직이 호출자의 조직 하나뿐이어야 한다.
    reader.rows[("organization-b", "event-a")] = (
        item("item-999", ItemReviewStatus.REVIEW_PENDING),
    )

    assert member_client.get(ITEMS_PATH).json() == {"items": []}
    assert {organization for organization, _ in reader.asked} == {"organization-a"}


def test_revision_requested_items_are_needs_attention_for_their_requester(
    reader: FakeEventFinanceReader, member_client: TestClient
) -> None:
    reader.rows[("organization-a", "event-a")] = (
        item("mine", ItemReviewStatus.REVISION_REQUESTED, requester_user_id="user-a"),
        item("theirs", ItemReviewStatus.REVISION_REQUESTED, requester_user_id="user-b"),
    )

    states = {
        entry["itemId"]: (entry["progressState"], entry["requestedByViewer"])
        for entry in member_client.get(ITEMS_PATH).json()["items"]
    }

    assert states == {
        "mine": ("needs_attention", True),
        "theirs": ("under_review", False),
    }


def test_finance_stage_is_absent_for_members_and_present_for_the_finance_team(
    reader: FakeEventFinanceReader,
    member_client: TestClient,
    finance_client: TestClient,
) -> None:
    # 필드의 존재 자체가 권한 판정 결과다. 응답을 나누지 않고 서버가 넣거나 뺀다.
    reader.rows[("organization-a", "event-a")] = (
        item("item-001", ItemReviewStatus.REVIEW_PENDING),
    )

    (seen_by_member,) = member_client.get(ITEMS_PATH).json()["items"]
    (seen_by_finance,) = finance_client.get(ITEMS_PATH).json()["items"]

    assert "financeStage" not in seen_by_member
    assert seen_by_finance["financeStage"] == "review_pending"


def test_approved_items_do_not_appear_because_their_column_is_not_built(
    reader: FakeEventFinanceReader, finance_client: TestClient
) -> None:
    reader.rows[("organization-a", "event-a")] = (
        item("approved", ItemReviewStatus.APPROVED),
        item("rejected", ItemReviewStatus.REJECTED),
    )

    body = finance_client.get(ITEMS_PATH).json()

    # 반려는 남는다. 요청자가 결과를 알아야 하기 때문이다.
    assert [entry["itemId"] for entry in body["items"]] == ["rejected"]


@pytest.fixture
def readerless_client() -> Iterator[TestClient]:
    """저장소를 붙이지 않은 서버. 배포가 잘못 조립된 상태를 흉내낸다."""

    service = PurchaseRequestService(
        FakePurchaseRequestRepository(), FakeSubmissionStore(build_record())
    )
    app = create_app()
    app.dependency_overrides[get_purchase_request_context] = lambda: build_context(
        finance=False
    )
    app.dependency_overrides[get_purchase_request_service] = lambda: service
    with TestClient(app) as client:
        yield client


@pytest.mark.parametrize("path", [BUDGET_PATH, ITEMS_PATH])
def test_event_finance_reads_report_a_persistence_failure_as_a_problem(
    readerless_client: TestClient, path: str
) -> None:
    # 저장소가 없으면 빈 목록이 아니라 503이다. 실패를 성공으로 꾸미지 않는다.
    response = readerless_client.get(path)

    assert response.status_code == 503
    assert response.headers["content-type"].startswith("application/problem+json")
