from datetime import date

import pytest

from vada_api.finance.review import (
    ItemDecision,
    ItemReviewState,
    ItemReviewStatus,
    ReviewConflictError,
    ReviewDecision,
    ReviewDecisionInvalidError,
    decide,
)

PENDING = ItemReviewState("item-a", ItemReviewStatus.REVIEW_PENDING)


def _decision(kind: ReviewDecision, **extra: object) -> ItemDecision:
    return ItemDecision(
        decision=kind,
        expected_review_status=ItemReviewStatus.REVIEW_PENDING,
        **extra,  # pyright: ignore[reportArgumentType]
    )


def test_approval_keeps_no_amount_and_no_reason() -> None:
    # 승인은 요청 금액을 그대로 예약한다. 승인액도 사유도 받지 않는다(§6.2).
    result = decide(PENDING, _decision(ReviewDecision.APPROVE))

    assert result == ItemReviewState("item-a", ItemReviewStatus.APPROVED)


def test_revision_request_keeps_reason_and_due_date() -> None:
    result = decide(
        PENDING,
        _decision(
            ReviewDecision.REQUEST_REVISION,
            revision_reason="가격 근거가 없습니다.",
            revision_due_date=date(2026, 8, 20),
        ),
    )

    assert result.review_status is ItemReviewStatus.REVISION_REQUESTED
    assert result.revision_reason == "가격 근거가 없습니다."
    assert result.revision_due_date == date(2026, 8, 20)


def test_rejection_keeps_the_free_text_reason() -> None:
    result = decide(
        PENDING,
        _decision(ReviewDecision.REJECT, rejection_reason="행사 범위를 벗어납니다."),
    )

    assert result.review_status is ItemReviewStatus.REJECTED
    assert result.rejection_reason == "행사 범위를 벗어납니다."


@pytest.mark.parametrize(
    ("kind", "extra", "message"),
    [
        (
            ReviewDecision.REQUEST_REVISION,
            {"revision_due_date": date(2026, 8, 20)},
            "사유",
        ),
        (ReviewDecision.REQUEST_REVISION, {"revision_reason": "부족"}, "기한"),
        (
            ReviewDecision.REQUEST_REVISION,
            {"revision_reason": "   ", "revision_due_date": date(2026, 8, 20)},
            "사유",
        ),
        (ReviewDecision.REJECT, {}, "사유"),
        (ReviewDecision.REJECT, {"rejection_reason": "  "}, "사유"),
    ],
)
def test_missing_required_reason_is_refused(
    kind: ReviewDecision, extra: dict[str, object], message: str
) -> None:
    with pytest.raises(ReviewDecisionInvalidError, match=message):
        decide(PENDING, _decision(kind, **extra))


@pytest.mark.parametrize(
    ("kind", "extra"),
    [
        (ReviewDecision.APPROVE, {"revision_reason": "부족"}),
        (ReviewDecision.APPROVE, {"revision_due_date": date(2026, 8, 20)}),
        (ReviewDecision.APPROVE, {"rejection_reason": "안 됩니다"}),
        (
            ReviewDecision.REQUEST_REVISION,
            {
                "revision_reason": "부족",
                "revision_due_date": date(2026, 8, 20),
                "rejection_reason": "안 됩니다",
            },
        ),
        (
            ReviewDecision.REJECT,
            {"rejection_reason": "안 됩니다", "revision_reason": "부족"},
        ),
    ],
)
def test_values_that_do_not_belong_to_the_decision_are_refused(
    kind: ReviewDecision, extra: dict[str, object]
) -> None:
    with pytest.raises(ReviewDecisionInvalidError):
        decide(PENDING, _decision(kind, **extra))


def test_stale_expected_status_is_refused_without_overwriting() -> None:
    # 재정부원 여럿이 같은 요청을 동시에 열 수 있다. 먼저 처리한 결정을 덮지 않는다.
    approved = ItemReviewState("item-a", ItemReviewStatus.APPROVED)

    with pytest.raises(ReviewConflictError, match="review_pending"):
        decide(approved, _decision(ReviewDecision.REJECT, rejection_reason="철회"))


def test_already_decided_item_is_not_decided_again() -> None:
    rejected = ItemReviewState("item-a", ItemReviewStatus.REJECTED)
    decision = ItemDecision(
        decision=ReviewDecision.APPROVE,
        expected_review_status=ItemReviewStatus.REJECTED,
    )

    with pytest.raises(ReviewConflictError, match="이미 확정된"):
        decide(rejected, decision)


def test_revision_requested_item_waits_for_resubmission() -> None:
    # 보완 요청된 품목은 요청자가 재제출해 검토 대기로 돌아온 뒤에만 다시 결정한다.
    revision = ItemReviewState(
        "item-a",
        ItemReviewStatus.REVISION_REQUESTED,
        revision_reason="가격 근거 없음",
        revision_due_date=date(2026, 8, 20),
    )
    decision = ItemDecision(
        decision=ReviewDecision.APPROVE,
        expected_review_status=ItemReviewStatus.REVISION_REQUESTED,
    )

    with pytest.raises(ReviewConflictError, match="이미 확정된"):
        decide(revision, decision)


def test_no_request_level_status_is_produced() -> None:
    # §6.3 — 구매 요청 수준의 통합 진행 상태를 만들지 않는다. 결정은 품목만 바꾼다.
    states = [
        decide(
            ItemReviewState("a", ItemReviewStatus.REVIEW_PENDING),
            _decision(ReviewDecision.APPROVE),
        ),
        decide(
            ItemReviewState("b", ItemReviewStatus.REVIEW_PENDING),
            _decision(ReviewDecision.REJECT, rejection_reason="불필요"),
        ),
    ]

    assert [state.item_id for state in states] == ["a", "b"]
    assert [state.review_status for state in states] == [
        ItemReviewStatus.APPROVED,
        ItemReviewStatus.REJECTED,
    ]
