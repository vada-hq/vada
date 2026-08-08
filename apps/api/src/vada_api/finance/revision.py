"""보완 재제출 규칙.

저장소도 HTTP도 모른다. 계약 CB-FIN-004@R1과 VADA_FINANCE_SPEC.md §7이 정한
판정만 담는다.
"""

from __future__ import annotations

from collections.abc import Iterable, Mapping, Sequence
from dataclasses import dataclass

from vada_api.finance.review import ItemReviewStatus


class RevisionError(Exception):
    """보완 재제출을 거부하는 이유의 공통 조상."""


class RevisionEmptyError(RevisionError):
    """재제출할 품목을 하나도 담지 않았다."""


class ItemNotUnderRevisionError(RevisionError):
    """보완을 요청받지 않은 품목을 고치려 한다."""


class RevisionConflictError(RevisionError):
    """화면이 본 검토 상태가 저장된 값과 다르다."""


@dataclass(frozen=True, slots=True)
class RevisionItemState:
    """저장소가 아는 품목 하나. 제출본이 몇 벌 쌓였는지까지 안다."""

    item_id: str
    review_status: ItemReviewStatus
    submission_count: int


@dataclass(frozen=True, slots=True)
class RevisionSubmissionCommand:
    """재제출 명령. 품목마다 화면이 본 상태와 새 입력값을 담는다."""

    items: Sequence[tuple[str, ItemReviewStatus, Mapping[str, object]]]


@dataclass(frozen=True, slots=True)
class RevisionSubmission:
    """쌓을 제출본 하나와 그 뒤 품목의 검토 상태."""

    item_id: str
    submission_number: int
    content: Mapping[str, object]
    review_status: ItemReviewStatus


def decide_revision(
    members: Iterable[RevisionItemState],
    command: RevisionSubmissionCommand,
) -> tuple[RevisionSubmission, ...]:
    """쌓을 제출본들을 돌려주거나 거부한다.

    members는 그 구매 요청의 품목 전부여야 한다. 보완 대상이 아닌 품목을 담았는지
    확인하려면 대상이 아닌 품목도 알아야 하기 때문이다. 보완 품목만 넘기면
    "그런 품목 없음"과 "고칠 수 없는 품목"을 구분하지 못한다.

    보완 기한은 여기 없다. 기한이 지나도 자동 반려하지 않으므로(§7) 재제출을
    막을 이유가 되지 않는다.
    """
    if not command.items:
        # 빈 재제출을 성공으로 처리하면 요청자는 냈다고 믿고 재정부는 못 본다.
        raise RevisionEmptyError("재제출할 품목이 없습니다.")

    current = {member.item_id: member for member in members}
    decided: list[RevisionSubmission] = []

    for item_id, seen_status, content in command.items:
        member = current.get(item_id)
        if member is None:
            # 없는 품목의 존재 여부를 알려 주지 않는다. 구분해 알리면 다른
            # 요청에 어떤 품목이 있는지 떠보는 통로가 된다.
            raise ItemNotUnderRevisionError(
                f"{item_id}: 보완을 요청받은 품목만 다시 낼 수 있습니다."
            )

        if seen_status is not member.review_status:
            # 상태 불일치를 먼저 본다. 재정부가 그 사이 재검토를 끝내 반려했다면
            # 그 품목은 더 이상 보완 대상이 아니지만, 요청자에게 필요한 답은
            # "그런 품목 없음"이 아니라 "그 사이 바뀌었으니 다시 읽으라"다.
            raise RevisionConflictError(
                f"{item_id}: 그 사이 검토 상태가 바뀌었습니다. 다시 읽어야 합니다."
            )

        if member.review_status is not ItemReviewStatus.REVISION_REQUESTED:
            raise ItemNotUnderRevisionError(
                f"{item_id}: 보완을 요청받은 품목만 다시 낼 수 있습니다."
            )

        decided.append(
            RevisionSubmission(
                item_id=item_id,
                # 처음 제출한 것이 1번이다. 보완 재제출은 그 위에 쌓인다.
                submission_number=member.submission_count + 1,
                content=content,
                # 재제출 직후 원본 검토 상태는 검토 대기다. 재정부 처리 단계가
                # 재검토 대기가 되는 것은 그 상태에서 계산되는 별개의 값이다.
                review_status=ItemReviewStatus.REVIEW_PENDING,
            )
        )

    return tuple(decided)
