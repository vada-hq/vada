from __future__ import annotations

from vada_api.finance.event_finance import (
    EventBudgetSummary,
    EventItemFact,
    EventItemFinanceStage,
    EventItemProgressState,
    build_item_board,
)
from vada_api.finance.review import ItemReviewStatus


def _fact(
    item_id: str,
    status: ItemReviewStatus,
    *,
    requester_user_id: str = "user-a",
) -> EventItemFact:
    return EventItemFact(
        item_id=item_id,
        request_id=f"request-{item_id}",
        item_name=f"품목 {item_id}",
        requester_user_id=requester_user_id,
        requester_name="박해랑",
        request_department_name="기획부",
        estimated_total_price=120_000,
        review_status=status,
    )


def _board(*facts: EventItemFact, viewer: str = "user-a", finance: bool = False):
    return build_item_board(facts, viewer_user_id=viewer, include_finance_stage=finance)


def test_review_pending_items_sit_under_review() -> None:
    (entry,) = _board(_fact("i-1", ItemReviewStatus.REVIEW_PENDING))

    assert entry.progress_state is EventItemProgressState.UNDER_REVIEW
    assert entry.requested_by_viewer


def test_revision_requested_is_needs_attention_only_for_its_requester() -> None:
    # 같은 품목이 사람에 따라 다른 열에 놓인다. 화면정의서가 정한 예외다.
    fact = _fact("i-1", ItemReviewStatus.REVISION_REQUESTED, requester_user_id="user-a")

    (mine,) = _board(fact, viewer="user-a")
    (theirs,) = _board(fact, viewer="user-b")

    assert mine.progress_state is EventItemProgressState.NEEDS_ATTENTION
    assert theirs.progress_state is EventItemProgressState.UNDER_REVIEW
    assert mine.requested_by_viewer
    assert not theirs.requested_by_viewer


def test_rejected_items_stay_on_the_board() -> None:
    # 종결이지만 요청자가 결과를 알아야 한다. 빼면 반려를 알 방법이 없다.
    (entry,) = _board(_fact("i-1", ItemReviewStatus.REJECTED))

    assert entry.progress_state is EventItemProgressState.REJECTED


def test_approved_items_leave_the_board_because_their_column_is_not_built() -> None:
    # 승인된 품목이 갈 곳은 `구매 준비` 열인데 미도입이다. 다른 열에 끼워 넣으면
    # 그 열의 뜻이 무너진다.
    assert _board(
        _fact("i-1", ItemReviewStatus.APPROVED),
        _fact("i-2", ItemReviewStatus.REVIEW_PENDING),
    ) == _board(_fact("i-2", ItemReviewStatus.REVIEW_PENDING))


def test_finance_stage_is_absent_unless_the_caller_already_decided_it() -> None:
    # 필드의 존재 자체가 권한 판정 결과다. 이 함수는 역할을 보지 않는다.
    (hidden,) = _board(_fact("i-1", ItemReviewStatus.REVIEW_PENDING), finance=False)
    (shown,) = _board(_fact("i-1", ItemReviewStatus.REVIEW_PENDING), finance=True)

    assert hidden.finance_stage is None
    assert shown.finance_stage is EventItemFinanceStage.REVIEW_PENDING


def test_revision_requested_items_are_not_waiting_on_the_finance_team() -> None:
    # 보완 요청된 품목은 요청자를 기다린다. 재정부 처리 대기 목록에 넣으면
    # 재정부가 할 수 없는 일을 할 일로 센다.
    (entry,) = _board(
        _fact("i-1", ItemReviewStatus.REVISION_REQUESTED), viewer="user-b", finance=True
    )

    assert entry.finance_stage is None


def test_available_total_can_go_negative_when_nothing_is_allocated() -> None:
    # 배정을 만드는 흐름이 없어 배정은 늘 0이다. 음수는 초과가 아니라 미배정이다.
    summary = EventBudgetSummary(allocated_total=0, committed_total=250_000)

    assert summary.available_total == -250_000


def test_available_total_subtracts_reservations_from_the_allocation() -> None:
    summary = EventBudgetSummary(allocated_total=1_000_000, committed_total=250_000)

    assert summary.available_total == 750_000
