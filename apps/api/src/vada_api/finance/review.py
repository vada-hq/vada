"""품목별 검토 결정 규칙. CB-FIN-003@R1과 VADA_FINANCE_SPEC.md §6을 따른다."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from enum import StrEnum


class ItemReviewStatus(StrEnum):
    """품목의 검토 상태. 저장되는 원본이다."""

    REVIEW_PENDING = "review_pending"
    APPROVED = "approved"
    REVISION_REQUESTED = "revision_requested"
    REJECTED = "rejected"


class ReviewDecision(StrEnum):
    APPROVE = "approve"
    REQUEST_REVISION = "request_revision"
    REJECT = "reject"


class ReviewConflictError(Exception):
    """화면이 본 상태가 서버 상태와 다르다. 덮어쓰지 않는다."""


class ReviewDecisionInvalidError(Exception):
    """결정에 필요한 값이 없거나, 필요 없는 값이 함께 왔다."""


@dataclass(frozen=True, slots=True)
class ItemDecision:
    decision: ReviewDecision
    expected_review_status: ItemReviewStatus
    revision_reason: str | None = None
    revision_due_date: date | None = None
    rejection_reason: str | None = None


@dataclass(frozen=True, slots=True)
class ItemReviewState:
    item_id: str
    review_status: ItemReviewStatus
    revision_reason: str | None = None
    revision_due_date: date | None = None
    rejection_reason: str | None = None


def _blank(value: str | None) -> bool:
    return value is None or not value.strip()


def decide(state: ItemReviewState, decision: ItemDecision) -> ItemReviewState:
    """품목 하나의 결정을 적용한 새 상태를 돌려준다.

    검토 대기에서 승인·보완 요청·반려로 바로 전환한다(§6.1). 별도 `검토 중`
    단계가 없으므로 중간 상태를 만들지 않는다.

    이미 확정된 품목은 다시 결정하지 않는다. 보완 요청된 품목은 요청자가
    재제출해 검토 대기로 돌아온 뒤에만 다시 결정할 수 있다.
    """

    if decision.expected_review_status is not state.review_status:
        # 낙관적 잠금. 재정부원 여럿이 같은 요청을 동시에 열 수 있다.
        raise ReviewConflictError(
            f"{state.item_id}: 화면이 본 상태는 {decision.expected_review_status}지만"
            f" 현재 상태는 {state.review_status}입니다."
        )

    if state.review_status is not ItemReviewStatus.REVIEW_PENDING:
        raise ReviewConflictError(
            f"{state.item_id}: 이미 확정된 품목입니다. 결정을 덮어쓰지 않습니다."
        )

    if decision.decision is ReviewDecision.APPROVE:
        # 승인에는 금액 입력이 없다. 요청 금액을 그대로 예산 예약한다(§6.2).
        if (
            not _blank(decision.revision_reason)
            or decision.revision_due_date is not None
        ):
            raise ReviewDecisionInvalidError(
                "승인에는 보완 사유와 기한을 넣지 않습니다."
            )
        if not _blank(decision.rejection_reason):
            raise ReviewDecisionInvalidError("승인에는 반려 사유를 넣지 않습니다.")
        return ItemReviewState(state.item_id, ItemReviewStatus.APPROVED)

    if decision.decision is ReviewDecision.REQUEST_REVISION:
        if _blank(decision.revision_reason):
            raise ReviewDecisionInvalidError("보완 요청에는 사유가 필요합니다.")
        if decision.revision_due_date is None:
            raise ReviewDecisionInvalidError("보완 요청에는 재제출 기한이 필요합니다.")
        if not _blank(decision.rejection_reason):
            raise ReviewDecisionInvalidError("보완 요청에는 반려 사유를 넣지 않습니다.")
        return ItemReviewState(
            state.item_id,
            ItemReviewStatus.REVISION_REQUESTED,
            revision_reason=decision.revision_reason,
            revision_due_date=decision.revision_due_date,
        )

    # 반려. 사유 목록이나 추천을 시스템이 제공하지 않으므로 자유 입력을 받는다(§6.2).
    if _blank(decision.rejection_reason):
        raise ReviewDecisionInvalidError("반려에는 사유가 필요합니다.")
    if not _blank(decision.revision_reason) or decision.revision_due_date is not None:
        raise ReviewDecisionInvalidError("반려에는 보완 사유와 기한을 넣지 않습니다.")
    return ItemReviewState(
        state.item_id,
        ItemReviewStatus.REJECTED,
        rejection_reason=decision.rejection_reason,
    )
