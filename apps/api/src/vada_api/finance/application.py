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
from vada_api.finance.submission import (
    DraftReference,
    PurchaseRequestContent,
    PurchaseRequestNeededDateInPastError,
    PurchaseRequestRecord,
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


class PurchaseRequestSubmissionStore(Protocol):
    def get_idempotent_result(
        self, submission: ValidatedPurchaseRequestSubmission
    ) -> PurchaseRequestRecord | None: ...

    def submit(
        self, submission: ValidatedPurchaseRequestSubmission
    ) -> PurchaseRequestRecord: ...


class PurchaseRequestService:
    """HTTP와 영속성 사이에서 인가와 구매 요청 사용 사례를 조정한다."""

    def __init__(
        self,
        repository: PurchaseRequestRepository,
        submission_store: PurchaseRequestSubmissionStore,
        *,
        today_provider: Callable[[], date] | None = None,
    ) -> None:
        self._repository = repository
        self._submission_store = submission_store
        self._today_provider = today_provider or _kst_today

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
        return self._repository.save_draft(
            organization_id=identity.organization_id,
            event_id=identity.event_id,
            owner_user_id=identity.user_id,
            expected_version=expected_version,
            content=content,
        )

    def delete_draft(self, context: FinanceRequestContext) -> None:
        identity = context.actor.identity
        deleted = self._repository.delete_draft(
            organization_id=identity.organization_id,
            event_id=identity.event_id,
            owner_user_id=identity.user_id,
        )
        if not deleted:
            raise ResourceNotFoundError

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
        if content.needed_date < self._today_provider():
            existing = self._submission_store.get_idempotent_result(submission)
            if existing is not None:
                return existing
            raise PurchaseRequestNeededDateInPastError
        return self._submission_store.submit(submission)

    def list_own(
        self, context: FinanceRequestContext
    ) -> tuple[PurchaseRequestSummary, ...]:
        identity = context.actor.identity
        return self._repository.list_own(
            organization_id=identity.organization_id,
            event_id=identity.event_id,
            requester_user_id=identity.user_id,
        )

    def get_detail(
        self, context: FinanceRequestContext, *, request_id: str
    ) -> PurchaseRequestRecord:
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
        return record


def _kst_today() -> date:
    return datetime.now(ZoneInfo("Asia/Seoul")).date()
