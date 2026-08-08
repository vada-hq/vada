from __future__ import annotations

from collections.abc import Callable, Mapping
from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal
from typing import Protocol
from zoneinfo import ZoneInfo

from vada_api.finance.authorization import (
    PurchaseRequestActorFacts,
    PurchaseRequestAuthorizationScope,
    PurchaseRequestPermission,
    require_purchase_request_permission,
)
from vada_api.finance.event_finance import (
    EventBudgetSummary,
    EventItemBoardEntry,
    EventItemFact,
    build_item_board,
)
from vada_api.finance.observability import (
    ObservedResult,
    PurchaseRequestObserver,
    new_operation_correlation_id,
    observe_purchase_request_operation,
    observer_from_environment,
    submission_correlation_id,
)
from vada_api.finance.review import (
    ItemDecision,
    ItemReviewState,
    ItemReviewStatus,
    decide,
)
from vada_api.finance.submission import (
    DraftReference,
    PurchaseRequestContent,
    PurchaseRequestNeededDateInPastError,
    PurchaseRequestPersistenceError,
    PurchaseRequestRecord,
    PurchaseRequestSubmissionOutcome,
    ValidatedPurchaseRequestSubmission,
)
from vada_api.identity.errors import ResourceNotFoundError


@dataclass(frozen=True, slots=True)
class FinanceRequestContext:
    """인증·조직 저장소에서 파생된 구매 요청용 서버 신뢰 사실."""

    actor: PurchaseRequestActorFacts
    event_name: str
    requester_name: str
    request_department_id: str
    request_department_name: str
    available_budget: Decimal


@dataclass(frozen=True, slots=True)
class PurchaseRequestDraft:
    draft_id: str
    version: int
    saved_at: datetime
    content: Mapping[str, object]


@dataclass(frozen=True, slots=True)
class PurchaseRequestSummary:
    request_id: str
    title: str
    status: str
    estimated_total: Decimal
    over_budget: bool
    created_at: datetime


@dataclass(frozen=True, slots=True)
class PurchaseRequestDisplayNames:
    event_name: str
    requester_name: str


@dataclass(frozen=True, slots=True)
class PurchaseRequestDetailView:
    record: PurchaseRequestRecord
    display: PurchaseRequestDisplayNames


@dataclass(frozen=True, slots=True)
class PurchaseRequestHistoryEntry:
    """처리 기록 한 줄. VADA_FINANCE_SPEC.md §13이 누적을 요구하는 사실이다."""

    recorded_at: datetime
    actor_name: str
    summary: str
    item_id: str | None = None


@dataclass(frozen=True, slots=True)
class ItemReviewEvent:
    """저장된 검토 결정 하나. 처리 기록을 만드는 재료다."""

    item_id: str
    review_status: ItemReviewStatus
    decided_by_user_id: str
    decided_at: datetime
    revision_reason: str | None = None
    rejection_reason: str | None = None


@dataclass(frozen=True, slots=True)
class PurchaseRequestReviewView:
    detail: PurchaseRequestDetailView
    item_review_states: tuple[ItemReviewState, ...]
    history: tuple[PurchaseRequestHistoryEntry, ...] = ()


class PurchaseRequestReviewStore(Protocol):
    """품목 검토 결정을 추가 전용으로 쌓고 최신 사건으로 현재 상태를 읽는다."""

    def current_states(
        self, *, organization_id: str, event_id: str, request_id: str
    ) -> tuple[ItemReviewState, ...]: ...

    def record(
        self,
        state: ItemReviewState,
        *,
        organization_id: str,
        event_id: str,
        request_id: str,
        decided_by_user_id: str,
    ) -> None: ...

    def events(
        self, *, organization_id: str, event_id: str, request_id: str
    ) -> tuple[ItemReviewEvent, ...]: ...


class EventFinanceReader(Protocol):
    """행사 하나의 예산 요약과 활성 품목을 조직 범위로 읽는다."""

    def budget_summary(
        self, *, organization_id: str, event_id: str
    ) -> EventBudgetSummary: ...

    def active_items(
        self, *, organization_id: str, event_id: str
    ) -> tuple[EventItemFact, ...]: ...


class PurchaseRequestRepository(Protocol):
    def get_draft(
        self, *, organization_id: str, event_id: str, owner_user_id: str
    ) -> PurchaseRequestDraft | None: ...

    def save_draft(
        self,
        *,
        organization_id: str,
        event_id: str,
        owner_user_id: str,
        expected_version: int | None,
        content: dict[str, object],
    ) -> PurchaseRequestDraft: ...

    def delete_draft(
        self, *, organization_id: str, event_id: str, owner_user_id: str
    ) -> bool: ...

    def list_own(
        self, *, organization_id: str, event_id: str, requester_user_id: str
    ) -> tuple[PurchaseRequestSummary, ...]: ...

    def get_detail(
        self, *, organization_id: str, event_id: str, request_id: str
    ) -> PurchaseRequestRecord | None: ...


class PurchaseRequestRelationshipReader(Protocol):
    """Resolve display-only names from server-owned relationship facts."""

    def get_detail_display_names(
        self, *, organization_id: str, event_id: str, requester_user_id: str
    ) -> PurchaseRequestDisplayNames | None: ...

    def get_member_display_names(
        self, *, organization_id: str, user_ids: frozenset[str]
    ) -> dict[str, str]: ...


class PurchaseRequestSubmissionStore(Protocol):
    def get_idempotent_result(
        self, submission: ValidatedPurchaseRequestSubmission
    ) -> PurchaseRequestRecord | None: ...

    def submit(
        self, submission: ValidatedPurchaseRequestSubmission
    ) -> PurchaseRequestSubmissionOutcome: ...


class PurchaseRequestService:
    """HTTP와 영속성 사이에서 인가와 구매 요청 사용 사례를 조정한다."""

    def __init__(
        self,
        repository: PurchaseRequestRepository,
        submission_store: PurchaseRequestSubmissionStore,
        *,
        relationship_reader: PurchaseRequestRelationshipReader | None = None,
        review_store: PurchaseRequestReviewStore | None = None,
        event_finance_reader: EventFinanceReader | None = None,
        today_provider: Callable[[], date] | None = None,
        observer: PurchaseRequestObserver | None = None,
    ) -> None:
        self._repository = repository
        self._submission_store = submission_store
        self._relationship_reader = relationship_reader
        self._review_store = review_store
        self._event_finance_reader = event_finance_reader
        self._today_provider = today_provider or _kst_today
        self._observer = observer or observer_from_environment()

    def require_permission(
        self,
        permission: PurchaseRequestPermission,
        context: FinanceRequestContext,
    ) -> None:
        identity = context.actor.identity
        require_purchase_request_permission(
            permission,
            actor=context.actor,
            scope=PurchaseRequestAuthorizationScope(
                event_id=identity.event_id,
                event_organization_id=identity.organization_id,
                request_department_id=context.request_department_id,
                draft_owner_user_id=identity.user_id,
                result_requester_user_id=identity.user_id,
                request_organization_id=identity.organization_id,
                request_event_id=identity.event_id,
            ),
        )

    def get_editor_state(
        self, context: FinanceRequestContext
    ) -> tuple[FinanceRequestContext, PurchaseRequestDraft | None]:
        identity = context.actor.identity
        return context, self._repository.get_draft(
            organization_id=identity.organization_id,
            event_id=identity.event_id,
            owner_user_id=identity.user_id,
        )

    def save_draft(
        self,
        context: FinanceRequestContext,
        *,
        expected_version: int | None,
        content: dict[str, object],
    ) -> PurchaseRequestDraft:
        identity = context.actor.identity
        return observe_purchase_request_operation(
            observer=self._observer,
            operation="draft_save",
            organization_id=identity.organization_id,
            event_id=identity.event_id,
            actor_user_id=identity.user_id,
            correlation_id=new_operation_correlation_id(),
            action=lambda: ObservedResult(
                self._repository.save_draft(
                    organization_id=identity.organization_id,
                    event_id=identity.event_id,
                    owner_user_id=identity.user_id,
                    expected_version=expected_version,
                    content=content,
                )
            ),
        )

    def delete_draft(self, context: FinanceRequestContext) -> None:
        identity = context.actor.identity
        observe_purchase_request_operation(
            observer=self._observer,
            operation="draft_delete",
            organization_id=identity.organization_id,
            event_id=identity.event_id,
            actor_user_id=identity.user_id,
            correlation_id=new_operation_correlation_id(),
            action=lambda: self._delete_draft(context),
        )

    def _delete_draft(self, context: FinanceRequestContext) -> ObservedResult[None]:
        identity = context.actor.identity
        deleted = self._repository.delete_draft(
            organization_id=identity.organization_id,
            event_id=identity.event_id,
            owner_user_id=identity.user_id,
        )
        if not deleted:
            raise ResourceNotFoundError
        return ObservedResult(None)

    def submit(
        self,
        context: FinanceRequestContext,
        *,
        idempotency_key: str,
        content: PurchaseRequestContent,
        draft_ref: DraftReference | None,
    ) -> PurchaseRequestRecord:
        identity = context.actor.identity
        submission = ValidatedPurchaseRequestSubmission(
            organization_id=identity.organization_id,
            event_id=identity.event_id,
            requester_user_id=identity.user_id,
            request_department_id=context.request_department_id,
            idempotency_key=idempotency_key,
            available_budget=context.available_budget,
            content=content,
            draft_ref=draft_ref,
        )
        return observe_purchase_request_operation(
            observer=self._observer,
            operation="submission",
            organization_id=identity.organization_id,
            event_id=identity.event_id,
            actor_user_id=identity.user_id,
            correlation_id=submission_correlation_id(idempotency_key),
            action=lambda: self._submit(submission),
        )

    def _submit(
        self, submission: ValidatedPurchaseRequestSubmission
    ) -> ObservedResult[PurchaseRequestRecord]:
        existing = self._submission_store.get_idempotent_result(submission)
        if existing is not None:
            return ObservedResult(existing, result="retried")
        if submission.content.needed_date < self._today_provider():
            raise PurchaseRequestNeededDateInPastError
        outcome = self._submission_store.submit(submission)
        return ObservedResult(
            outcome.record,
            result="retried" if outcome.replayed else "succeeded",
        )

    def list_own(
        self, context: FinanceRequestContext
    ) -> tuple[PurchaseRequestSummary, ...]:
        identity = context.actor.identity
        return self._repository.list_own(
            organization_id=identity.organization_id,
            event_id=identity.event_id,
            requester_user_id=identity.user_id,
        )

    def get_event_budget_summary(
        self, context: FinanceRequestContext
    ) -> EventBudgetSummary:
        identity = context.actor.identity
        return self._require_event_finance_reader().budget_summary(
            organization_id=identity.organization_id,
            event_id=identity.event_id,
        )

    def list_event_items(
        self, context: FinanceRequestContext
    ) -> tuple[EventItemBoardEntry, ...]:
        identity = context.actor.identity
        facts = self._require_event_finance_reader().active_items(
            organization_id=identity.organization_id,
            event_id=identity.event_id,
        )
        return build_item_board(
            facts,
            viewer_user_id=identity.user_id,
            # 처리 단계는 재정부에게만 존재한다. 응답을 나누지 않고 서버가 관계를
            # 보고 필드를 넣거나 뺀다. 화면이 역할을 다시 비교하지 않는다.
            include_finance_stage=(
                identity.organization_id in context.actor.finance_member_of
            ),
        )

    def get_detail(
        self, context: FinanceRequestContext, *, request_id: str
    ) -> PurchaseRequestDetailView:
        identity = context.actor.identity
        record = self._repository.get_detail(
            organization_id=identity.organization_id,
            event_id=identity.event_id,
            request_id=request_id,
        )
        if record is None:
            raise ResourceNotFoundError

        require_purchase_request_permission(
            PurchaseRequestPermission.READ_DETAIL,
            actor=context.actor,
            scope=PurchaseRequestAuthorizationScope(
                event_id=identity.event_id,
                event_organization_id=identity.organization_id,
                request_organization_id=record.organization_id,
                request_event_id=record.event_id,
            ),
        )
        if self._relationship_reader is None:
            raise PurchaseRequestPersistenceError
        display = self._relationship_reader.get_detail_display_names(
            organization_id=record.organization_id,
            event_id=record.event_id,
            requester_user_id=record.requester_user_id,
        )
        if (
            display is None
            or not _is_non_blank(display.event_name)
            or not _is_non_blank(display.requester_name)
        ):
            raise PurchaseRequestPersistenceError
        return PurchaseRequestDetailView(record=record, display=display)

    def get_review(
        self, context: FinanceRequestContext, *, request_id: str
    ) -> PurchaseRequestReviewView:
        """검토 화면이 읽는 것. 요청 내용과 품목마다 하나씩의 현재 상태다."""

        detail = self._authorized_review_detail(context, request_id=request_id)
        return self._review_view(detail)

    def decide_item(
        self,
        context: FinanceRequestContext,
        *,
        request_id: str,
        item_id: str,
        decision: ItemDecision,
    ) -> PurchaseRequestReviewView:
        """품목 하나의 결정을 기록하고 갱신된 검토 화면을 돌려준다."""

        detail = self._authorized_review_detail(context, request_id=request_id)
        record = detail.record
        current = {state.item_id: state for state in self._states(record)}
        if item_id not in current:
            # 이 요청에 없는 품목이다. 다른 조직 데이터의 존재를 알리지 않는다.
            raise ResourceNotFoundError

        # 규칙 위반과 충돌은 decide가 판정한다. 라우트가 상태 코드로 옮긴다.
        decided = decide(current[item_id], decision)

        store = self._require_review_store()
        store.record(
            decided,
            organization_id=record.organization_id,
            event_id=record.event_id,
            request_id=record.request_id,
            decided_by_user_id=context.actor.identity.user_id,
        )
        return self._review_view(detail)

    def _authorized_review_detail(
        self, context: FinanceRequestContext, *, request_id: str
    ) -> PurchaseRequestDetailView:
        detail = self.get_detail(context, request_id=request_id)
        # 읽기와 검토는 다른 권한이다. 상세를 볼 수 있다고 검토할 수 있는 것이 아니다.
        record = detail.record
        require_purchase_request_permission(
            PurchaseRequestPermission.REVIEW,
            actor=context.actor,
            scope=PurchaseRequestAuthorizationScope(
                event_id=context.actor.identity.event_id,
                event_organization_id=context.actor.identity.organization_id,
                request_organization_id=record.organization_id,
                request_event_id=record.event_id,
            ),
        )
        return detail

    def _states(self, record: PurchaseRequestRecord) -> tuple[ItemReviewState, ...]:
        stored = {
            state.item_id: state
            for state in self._require_review_store().current_states(
                organization_id=record.organization_id,
                event_id=record.event_id,
                request_id=record.request_id,
            )
        }
        # 계약은 요청의 품목마다 상태가 정확히 하나씩 있기를 요구한다. 저장소가
        # 품목을 못 찾는 경우에도 검토 대기로 채워 빠뜨리지 않는다.
        return tuple(
            stored.get(item.item_id)
            or ItemReviewState(item.item_id, ItemReviewStatus.REVIEW_PENDING)
            for item in record.item_results
        )

    def _review_view(
        self, detail: PurchaseRequestDetailView
    ) -> PurchaseRequestReviewView:
        return PurchaseRequestReviewView(
            detail=detail,
            item_review_states=self._states(detail.record),
            history=self._history(detail),
        )

    def _history(
        self, detail: PurchaseRequestDetailView
    ) -> tuple[PurchaseRequestHistoryEntry, ...]:
        """§13이 누적을 요구하는 사실을 시간순으로 만든다.

        요청 제출 사건은 별도 표를 읽지 않는다. 요청 기록 자체가 생성 시각과
        요청자를 들고 있으므로 그것으로 만든다.
        """

        record = detail.record
        events = self._require_review_store().events(
            organization_id=record.organization_id,
            event_id=record.event_id,
            request_id=record.request_id,
        )
        names = self._actor_names(record.organization_id, events)

        entries = [
            PurchaseRequestHistoryEntry(
                recorded_at=record.created_at,
                actor_name=detail.display.requester_name,
                summary="구매 요청을 제출했습니다.",
            )
        ]
        # 품목마다 이전 상태를 따라간다. §13이 "이전 상태와 변경 상태"를 요구한다.
        previous: dict[str, ItemReviewStatus] = {}
        for event in sorted(events, key=lambda item: item.decided_at):
            before = previous.get(event.item_id, ItemReviewStatus.REVIEW_PENDING)
            entries.append(
                PurchaseRequestHistoryEntry(
                    recorded_at=event.decided_at,
                    actor_name=names.get(event.decided_by_user_id, "알 수 없음"),
                    summary=_decision_summary(before, event),
                    item_id=event.item_id,
                )
            )
            previous[event.item_id] = event.review_status
        return tuple(entries)

    def _actor_names(
        self, organization_id: str, events: tuple[ItemReviewEvent, ...]
    ) -> dict[str, str]:
        if not events or self._relationship_reader is None:
            return {}
        return self._relationship_reader.get_member_display_names(
            organization_id=organization_id,
            user_ids=frozenset(event.decided_by_user_id for event in events),
        )

    def _require_review_store(self) -> PurchaseRequestReviewStore:
        if self._review_store is None:
            raise PurchaseRequestPersistenceError
        return self._review_store

    def _require_event_finance_reader(self) -> EventFinanceReader:
        if self._event_finance_reader is None:
            raise PurchaseRequestPersistenceError
        return self._event_finance_reader


_STATUS_LABELS: dict[ItemReviewStatus, str] = {
    ItemReviewStatus.REVIEW_PENDING: "검토 대기",
    ItemReviewStatus.APPROVED: "승인",
    ItemReviewStatus.REVISION_REQUESTED: "보완 요청",
    ItemReviewStatus.REJECTED: "반려",
}


def _decision_summary(before: ItemReviewStatus, event: ItemReviewEvent) -> str:
    """계약이 summary를 문자열로 정의하므로 서버가 문장을 만든다.

    사건 종류와 값만 주고 화면이 문장을 만드는 방법도 있지만, 그러려면 계약을
    새 리비전으로 바꿔야 한다. 지금은 계약 R1이 정한 형태를 그대로 지킨다.
    """

    after = _STATUS_LABELS[event.review_status]
    moved = f"{_STATUS_LABELS[before]}에서 {after}(으)로 바꿨습니다."
    reason = event.revision_reason or event.rejection_reason
    return f"{moved} 사유: {reason}" if reason else moved


def _kst_today() -> date:
    return datetime.now(ZoneInfo("Asia/Seoul")).date()


def _is_non_blank(value: str) -> bool:
    return bool(value) and value == value.strip()
