from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal


@dataclass(frozen=True, slots=True)
class PurchaseRequestItemInput:
    name: str
    category: str
    budget_item: str
    purchase_type: str
    quantity: Decimal
    unit: str
    estimated_unit_price: Decimal
    price_evidence: tuple[Mapping[str, object], ...]
    details: Mapping[str, object]


@dataclass(frozen=True, slots=True)
class PurchaseRequestContent:
    title: str
    needed_date: date
    purpose: str
    priority: str
    items: tuple[PurchaseRequestItemInput, ...]


@dataclass(frozen=True, slots=True)
class DraftReference:
    draft_id: str
    version: int


@dataclass(frozen=True, slots=True)
class ValidatedPurchaseRequestSubmission:
    """인가·입력 검증 뒤 저장 경계가 받는 서버 신뢰 사실."""

    organization_id: str
    event_id: str
    requester_user_id: str
    request_department_id: str
    idempotency_key: str
    available_budget: Decimal
    content: PurchaseRequestContent
    draft_ref: DraftReference | None = None


@dataclass(frozen=True, slots=True)
class PurchaseRequestItemResult:
    item_id: str
    item_position: int
    estimated_amount: Decimal


@dataclass(frozen=True, slots=True)
class PurchaseRequestRecord:
    request_id: str
    organization_id: str
    event_id: str
    requester_user_id: str
    request_department_id: str
    status: str
    content: PurchaseRequestContent
    item_results: tuple[PurchaseRequestItemResult, ...]
    estimated_total: Decimal
    over_budget: bool
    created_at: datetime


class PurchaseRequestStateConflictError(Exception):
    """공개 HTTP 경계에서 같은 의미로 다루는 구매 요청 상태 충돌."""

    def __init__(self) -> None:
        super().__init__("구매 요청 상태가 변경되어 다시 확인해야 합니다.")


class PurchaseRequestNeededDateInPastError(Exception):
    """새 제출의 필요일이 서버 기준 오늘보다 이전입니다."""

    def __init__(self) -> None:
        super().__init__("필요일은 오늘 이전일 수 없습니다.")


class SubmissionStateConflictError(PurchaseRequestStateConflictError):
    """같은 멱등 키의 다른 내용 또는 소유 초안 버전 충돌."""


class PurchaseRequestPersistenceError(Exception):
    """구매 요청 저장소 동작을 완료하지 못한 비노출 영속 오류."""

    def __init__(self) -> None:
        super().__init__("구매 요청을 저장하지 못했습니다.")


class SubmissionPersistenceError(PurchaseRequestPersistenceError):
    """제출 트랜잭션을 확정하지 못한 비노출 영속 오류."""
