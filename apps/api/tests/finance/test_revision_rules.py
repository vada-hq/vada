from __future__ import annotations

import pytest

from vada_api.finance.review import ItemReviewStatus
from vada_api.finance.revision import (
    ItemNotUnderRevisionError,
    RevisionConflictError,
    RevisionEmptyError,
    RevisionItemState,
    RevisionSubmissionCommand,
    decide_revision,
)


def _item(
    item_id: str,
    status: ItemReviewStatus = ItemReviewStatus.REVISION_REQUESTED,
    *,
    submissions: int = 1,
) -> RevisionItemState:
    return RevisionItemState(
        item_id=item_id, review_status=status, submission_count=submissions
    )


def _command(*item_ids: str) -> RevisionSubmissionCommand:
    return RevisionSubmissionCommand(
        items=tuple(
            (item_id, ItemReviewStatus.REVISION_REQUESTED, {"name": "고친 품목"})
            for item_id in item_ids
        )
    )


def test_resubmitting_a_revision_item_stacks_the_next_submission() -> None:
    decided = decide_revision([_item("i-1", submissions=1)], _command("i-1"))

    assert len(decided) == 1
    assert decided[0].item_id == "i-1"
    assert decided[0].submission_number == 2
    # 재제출 직후 원본 검토 상태는 검토 대기다(VADA_FINANCE_SPEC.md §7).
    assert decided[0].review_status is ItemReviewStatus.REVIEW_PENDING


def test_the_first_resubmission_is_numbered_two_not_one() -> None:
    # 처음 제출한 것이 1번이다. 보완 재제출은 그 위에 쌓인다.
    (decided,) = decide_revision([_item("i-1", submissions=1)], _command("i-1"))

    assert decided.submission_number == 2


def test_a_second_revision_round_stacks_again() -> None:
    # 재검토에서 또 보완을 요청하면 이 화면으로 돌아온다. 순환이다.
    (decided,) = decide_revision([_item("i-1", submissions=2)], _command("i-1"))

    assert decided.submission_number == 3


def test_items_that_were_not_asked_to_be_revised_are_rejected() -> None:
    """보완 대상이 아닌 품목은 수정할 수 없다. 서버가 변경 범위를 다시 확인한다.

    거부 이유는 충돌이다. 계약이 expectedReviewStatus를 revision_requested로
    고정해 두어서, 보완 대상이 아닌 품목을 담는다는 것은 곧 화면이 본 상태와
    서버가 아는 상태가 다르다는 뜻이기 때문이다. 요청자에게 필요한 답도
    "그런 품목 없음"이 아니라 "그 사이 바뀌었으니 다시 읽으라"다.
    """
    members = [
        _item("i-1"),
        _item("i-2", ItemReviewStatus.APPROVED),
    ]

    with pytest.raises(RevisionConflictError):
        decide_revision(members, _command("i-1", "i-2"))


def test_an_unknown_item_is_rejected_rather_than_created() -> None:
    with pytest.raises(ItemNotUnderRevisionError):
        decide_revision([_item("i-1")], _command("i-9"))


def test_a_stale_seen_status_is_a_conflict_not_an_overwrite() -> None:
    # 재정부가 그 사이 재검토를 끝냈으면 덮어쓰지 않는다.
    command = RevisionSubmissionCommand(
        items=((("i-1"), ItemReviewStatus.REVISION_REQUESTED, {"name": "고친 품목"}),)
    )

    with pytest.raises(RevisionConflictError):
        decide_revision([_item("i-1", ItemReviewStatus.REJECTED)], command)


def test_an_empty_submission_is_rejected() -> None:
    # 빈 재제출을 성공으로 처리하면 요청자는 냈다고 믿고 재정부는 못 본다.
    with pytest.raises(RevisionEmptyError):
        decide_revision([_item("i-1")], RevisionSubmissionCommand(items=()))


def test_only_the_named_items_change() -> None:
    # 한 요청에 보완 품목이 여럿이어도 담은 것만 바뀐다.
    members = [_item("i-1"), _item("i-2")]

    decided = decide_revision(members, _command("i-1"))

    assert [item.item_id for item in decided] == ["i-1"]


def test_a_past_due_date_does_not_block_resubmission() -> None:
    # 보완 기한이 지나도 자동 반려하지 않는다(§7). 그래서 기한은 판정에 없다.
    (decided,) = decide_revision([_item("i-1")], _command("i-1"))

    assert decided.review_status is ItemReviewStatus.REVIEW_PENDING
