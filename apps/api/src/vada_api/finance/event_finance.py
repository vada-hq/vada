"""행사 재정 개요(EVT-FIN-01)의 계산 규칙.

저장소도 HTTP도 모른다. 계약 CB-FIN-002@R1이 정한 판정만 담는다.
"""

from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass
from enum import StrEnum

from vada_api.finance.review import ItemReviewStatus


@dataclass(frozen=True, slots=True)
class EventBudgetSummary:
    """계약 DATA:event_budget.summary@R1. 금액은 전부 원 단위 정수다."""

    allocated_total: int
    committed_total: int

    @property
    def available_total(self) -> int:
        """배정에서 예약을 뺀 값. 음수일 수 있다.

        배정을 만드는 흐름이 아직 없어 allocated_total은 지금 항상 0이고, 승인이
        하나라도 생기면 이 값이 음수가 된다. 그것은 예산 초과가 아니라 배정이
        없다는 뜻이며, 그 구분은 화면이 한다(screens/EVTFIN01.md).
        """
        return self.allocated_total - self.committed_total


class EventItemProgressState(StrEnum):
    """대표 진행 상태. 저장된 값이 아니라 보는 사람 기준으로 계산한다."""

    NEEDS_ATTENTION = "needs_attention"
    UNDER_REVIEW = "under_review"
    REJECTED = "rejected"


class EventItemFinanceStage(StrEnum):
    """재정부 처리 단계. 재정부에게만 존재한다."""

    REVIEW_PENDING = "review_pending"
    REVISION_REVIEW_PENDING = "revision_review_pending"


@dataclass(frozen=True, slots=True)
class EventItemFact:
    """저장소가 아는 품목 하나. 진행 상태는 여기 없다. 계산되는 값이다."""

    item_id: str
    request_id: str
    item_name: str
    requester_user_id: str
    requester_name: str
    request_department_name: str
    estimated_total_price: int
    review_status: ItemReviewStatus


@dataclass(frozen=True, slots=True)
class EventItemBoardEntry:
    """한 사람이 보는 품목 한 줄. 계약 DATA:purchase_request.event_item_board@R1."""

    item_id: str
    request_id: str
    item_name: str
    requester_name: str
    request_department_name: str
    estimated_total_price: int
    progress_state: EventItemProgressState
    requested_by_viewer: bool
    finance_stage: EventItemFinanceStage | None


def build_item_board(
    facts: Iterable[EventItemFact],
    *,
    viewer_user_id: str,
    include_finance_stage: bool,
) -> tuple[EventItemBoardEntry, ...]:
    """활성 품목을 보는 사람 기준으로 배치한다.

    `include_finance_stage`는 이미 내려진 권한 판정의 결과여야 한다. 이 함수는
    역할을 보지 않는다. 필드의 존재 자체가 판정 결과이므로 화면이 역할을 다시
    비교하지 않는다(계약 의미 주석).
    """
    entries = []
    for fact in facts:
        state = _progress_state(fact, viewer_user_id=viewer_user_id)
        if state is None:
            continue
        entries.append(
            EventItemBoardEntry(
                item_id=fact.item_id,
                request_id=fact.request_id,
                item_name=fact.item_name,
                requester_name=fact.requester_name,
                request_department_name=fact.request_department_name,
                estimated_total_price=fact.estimated_total_price,
                progress_state=state,
                requested_by_viewer=fact.requester_user_id == viewer_user_id,
                finance_stage=_finance_stage(fact) if include_finance_stage else None,
            )
        )
    return tuple(entries)


def _progress_state(
    fact: EventItemFact, *, viewer_user_id: str
) -> EventItemProgressState | None:
    """VADA_FINANCE_SPEC.md §11.1의 대표 진행 상태. 놓을 열이 없으면 None."""

    if fact.review_status is ItemReviewStatus.REJECTED:
        # 종결이지만 요청자가 결과를 알아야 하므로 빼지 않는다.
        return EventItemProgressState.REJECTED

    if fact.review_status is ItemReviewStatus.REVISION_REQUESTED:
        # 같은 품목이 사람에 따라 다른 열에 놓인다. 버그가 아니라 화면정의서가
        # 정한 예외다. 요청자에게는 확인 필요, 다른 구성원에게는 검토 중이다.
        return (
            EventItemProgressState.NEEDS_ATTENTION
            if fact.requester_user_id == viewer_user_id
            else EventItemProgressState.UNDER_REVIEW
        )

    if fact.review_status is ItemReviewStatus.REVIEW_PENDING:
        return EventItemProgressState.UNDER_REVIEW

    # 승인된 품목이 갈 곳은 `구매 준비` 열인데 그 열은 아직 미도입이다. 계약의
    # progressState에도 그 값이 없다. 놓을 자리가 없는 품목을 다른 열에 끼워
    # 넣으면 그 열의 뜻이 무너진다. 활성 목록에서 뺀다.
    return None


def _finance_stage(fact: EventItemFact) -> EventItemFinanceStage | None:
    """재정부가 지금 처리해야 하는 품목인가.

    보완 요청된 품목은 재정부가 아니라 요청자를 기다린다. 그래서 처리 단계가
    없다. 재제출이 생기면 그때 REVISION_REVIEW_PENDING이 채워진다.
    """
    if fact.review_status is ItemReviewStatus.REVIEW_PENDING:
        return EventItemFinanceStage.REVIEW_PENDING
    return None
