from dataclasses import dataclass, field
from enum import StrEnum
from typing import ClassVar

from vada_api.identity.context import TrustedOrganizationContext


class PurchaseRequestPermission(StrEnum):
    """Stable purchase-request action keys from CB-FIN-001@R1."""

    DRAFT_READ = "purchase_request.draft.read"
    DRAFT_WRITE = "purchase_request.draft.write"
    DRAFT_DELETE = "purchase_request.draft.delete"
    SUBMIT = "purchase_request.submit"
    LIST_OWN = "purchase_request.list_own"
    READ_DETAIL = "purchase_request.read_detail"
    REVIEW = "purchase_request.review"


def _empty_relationships() -> frozenset[str]:
    return frozenset()


@dataclass(frozen=True, slots=True)
class PurchaseRequestActorFacts:
    """Trusted identity plus server-derived authorization relationships."""

    identity: TrustedOrganizationContext
    department_head_of: frozenset[str] = field(default_factory=_empty_relationships)
    finance_member_of: frozenset[str] = field(default_factory=_empty_relationships)


@dataclass(frozen=True, slots=True)
class PurchaseRequestAuthorizationScope:
    """Organization-scoped resource facts required by purchase-request rules."""

    event_id: str
    event_organization_id: str
    request_department_id: str | None = None
    draft_owner_user_id: str | None = None
    result_requester_user_id: str | None = None
    request_organization_id: str | None = None
    request_event_id: str | None = None


class PurchaseRequestActionForbiddenError(Exception):
    """Stable, non-disclosing forbidden result for purchase-request actions."""

    http_status: ClassVar[int] = 403
    code: ClassVar[str] = "PURCHASE_REQUEST_ACTION_FORBIDDEN"
    problem_type: ClassVar[str] = (
        "https://vada.example/problems/purchase-request-action-forbidden"
    )
    title: ClassVar[str] = "이 구매 요청 동작을 수행할 권한이 없습니다."

    def __init__(self) -> None:
        super().__init__(self.title)


def is_purchase_request_action_allowed(
    permission: PurchaseRequestPermission | str,
    *,
    actor: PurchaseRequestActorFacts | None,
    scope: PurchaseRequestAuthorizationScope,
) -> bool:
    """Evaluate one approved action; missing or unknown facts fail closed."""

    resolved_permission = _resolve_permission(permission)
    if (
        resolved_permission is None
        or actor is None
        or not _is_current_event_scope(actor, scope)
    ):
        return False

    if resolved_permission in {
        PurchaseRequestPermission.DRAFT_READ,
        PurchaseRequestPermission.DRAFT_WRITE,
    }:
        return _can_prepare_request(actor, scope) and _is_actor(
            scope.draft_owner_user_id,
            actor,
        )
    if resolved_permission is PurchaseRequestPermission.DRAFT_DELETE:
        return _is_actor(scope.draft_owner_user_id, actor)
    if resolved_permission is PurchaseRequestPermission.SUBMIT:
        return _can_prepare_request(actor, scope)
    if resolved_permission is PurchaseRequestPermission.LIST_OWN:
        return _can_prepare_request(actor, scope) and _is_actor(
            scope.result_requester_user_id,
            actor,
        )
    if resolved_permission is PurchaseRequestPermission.REVIEW:
        # 검토는 재정부만 한다. 부서장은 자기 부서 요청을 만들 수 있지만
        # 검토 결정은 할 수 없다(VADA_PERMISSION_MATRIX.md canManageFinance).
        return (
            scope.request_organization_id == actor.identity.organization_id
            and scope.request_event_id == scope.event_id
            and actor.identity.organization_id in actor.finance_member_of
        )
    if resolved_permission is PurchaseRequestPermission.READ_DETAIL:
        return (
            scope.request_organization_id == actor.identity.organization_id
            and scope.request_event_id == scope.event_id
        )
    return False


def require_purchase_request_permission(
    permission: PurchaseRequestPermission | str,
    *,
    actor: PurchaseRequestActorFacts | None,
    scope: PurchaseRequestAuthorizationScope,
) -> None:
    """Reject an action without exposing relationship or resource details."""

    if not is_purchase_request_action_allowed(
        permission,
        actor=actor,
        scope=scope,
    ):
        raise PurchaseRequestActionForbiddenError


def _resolve_permission(
    permission: PurchaseRequestPermission | str,
) -> PurchaseRequestPermission | None:
    if isinstance(permission, PurchaseRequestPermission):
        return permission
    try:
        return PurchaseRequestPermission(permission)
    except ValueError:
        return None


def _is_current_event_scope(
    actor: PurchaseRequestActorFacts,
    scope: PurchaseRequestAuthorizationScope,
) -> bool:
    identity = actor.identity
    return (
        identity.has_active_organization_membership
        and _is_non_blank(identity.user_id)
        and _is_non_blank(identity.organization_id)
        and _is_non_blank(identity.membership_id)
        and _is_non_blank(identity.event_id)
        and bool(identity.department_relationships)
        and all(
            _is_non_blank(relationship.relationship_id)
            and _is_non_blank(relationship.department_id)
            for relationship in identity.department_relationships
        )
        and identity.organization_id == scope.event_organization_id
        and identity.event_id == scope.event_id
    )


def _can_prepare_request(
    actor: PurchaseRequestActorFacts,
    scope: PurchaseRequestAuthorizationScope,
) -> bool:
    return (
        _is_non_blank(scope.request_department_id)
        and scope.request_department_id in actor.identity.department_ids
        and scope.request_department_id in actor.department_head_of
    ) or actor.identity.organization_id in actor.finance_member_of


def _is_actor(user_id: str | None, actor: PurchaseRequestActorFacts) -> bool:
    return _is_non_blank(user_id) and user_id == actor.identity.user_id


def _is_non_blank(value: str | None) -> bool:
    return isinstance(value, str) and bool(value) and value == value.strip()
