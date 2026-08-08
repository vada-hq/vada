from collections.abc import Mapping
from dataclasses import dataclass
from typing import Literal, Protocol

from vada_api.identity.authentication import (
    CognitoPrincipal,
    principal_from_api_gateway_request_context,
)
from vada_api.identity.errors import ResourceNotFoundError, UnauthenticatedError


@dataclass(frozen=True, slots=True)
class RequestedOrganizationScope:
    """Untrusted organization and event selectors from the request boundary."""

    organization_id: str
    event_id: str


@dataclass(frozen=True, slots=True)
class DepartmentRelationshipCandidate:
    """Repository relationship row that must be validated before use."""

    relationship_id: str
    user_id: str
    membership_id: str
    organization_id: str
    department_id: str
    is_active: bool


@dataclass(frozen=True, slots=True)
class OrganizationContextCandidate:
    """Organization-scoped repository result, still outside the trust boundary."""

    user_id: str
    organization_id: str
    membership_id: str
    membership_is_active: bool
    event_id: str
    event_organization_id: str
    department_relationships: tuple[DepartmentRelationshipCandidate, ...]


@dataclass(frozen=True, slots=True)
class SoleOrganizationCandidate:
    """행사 밖 화면이 쓰는, 아직 믿지 않은 소속 한 줄.

    신원은 확인됐고 소속은 아닐 수 있다. 소속이 없거나 둘 이상이면
    `organization_id`가 비어 있다 — 그 둘을 신원 없음과 섞으면 401과 404가
    한 답으로 뭉개진다.
    """

    user_id: str
    organization_id: str | None
    membership_id: str | None


class IdentityContextRepository(Protocol):
    """Persistence port; implementations must keep context reads org-scoped."""

    def find_internal_user_id(self, principal: CognitoPrincipal) -> str | None: ...

    def find_organization_context(
        self,
        *,
        user_id: str,
        organization_id: str,
        event_id: str,
    ) -> OrganizationContextCandidate | None: ...


class SoleOrganizationRepository(Protocol):
    """조직 화면의 맥락을 한 번의 조회로 답하는 포트.

    신원과 소속을 따로 읽으면 왕복이 그만큼 늘어난다. 요청 하나가 왕복 하나로
    끝나야 하는 자리다.
    """

    def find_sole_organization_context(
        self, principal: CognitoPrincipal
    ) -> SoleOrganizationCandidate | None: ...


@dataclass(frozen=True, slots=True)
class DepartmentRelationshipFact:
    relationship_id: str
    department_id: str


@dataclass(frozen=True, slots=True)
class TrustedOrganizationContext:
    """Server-derived facts available to later domain authorization rules."""

    principal: CognitoPrincipal
    user_id: str
    organization_id: str
    membership_id: str
    event_id: str
    department_relationships: tuple[DepartmentRelationshipFact, ...]

    @property
    def has_active_organization_membership(self) -> Literal[True]:
        return True

    @property
    def department_ids(self) -> frozenset[str]:
        return frozenset(
            relationship.department_id for relationship in self.department_relationships
        )


@dataclass(frozen=True, slots=True)
class TrustedOrganizationOnlyContext:
    """행사 밖의 조직 화면이 쓰는 신뢰 사실.

    행사가 없다. 조직 화면(ORG-04B 같은)은 행사 안에 있지 않으므로 행사를
    요구하면 열 수 없다. 부서 관계도 담지 않는다 — 담으면 조직 화면이 그것을
    권한 판정에 쓰고 싶어지고, 그건 계약이 요구하지 않는 조건이다.
    """

    principal: CognitoPrincipal
    user_id: str
    organization_id: str
    membership_id: str

    @property
    def has_active_organization_membership(self) -> Literal[True]:
        return True


class SoleOrganizationContextResolver:
    """조직 식별자를 경로에서 받지 않는 화면의 신뢰 맥락을 세운다.

    조회는 한 번이다. 신원·소속·조직 판별을 따로 읽으면 왕복이 네 번이고,
    개발용 데이터베이스에서 그 넷이 1.2초였다.
    """

    def __init__(self, repository: SoleOrganizationRepository) -> None:
        self._repository = repository

    def resolve(
        self, request_context: Mapping[str, object]
    ) -> TrustedOrganizationOnlyContext:
        """행사 없이 조직만으로 신뢰 맥락을 세운다.

        소속이 없는 것과 둘 이상인 것을 같은 답으로 돌려보낸다. 구분해 알리면
        어떤 조직이 있는지 떠보는 통로가 된다. 신원이 없는 것만 따로 답한다 —
        외부에서 유효하지만 VADA에 등록되지 않은 신원은 다른 인증 실패와
        구분되지 않아야 한다.
        """
        principal = principal_from_api_gateway_request_context(request_context)
        candidate = self._repository.find_sole_organization_context(principal)
        if candidate is None or not _is_non_blank(candidate.user_id):
            raise UnauthenticatedError

        organization_id = candidate.organization_id
        membership_id = candidate.membership_id
        if (
            organization_id is None
            or membership_id is None
            or not _is_non_blank(organization_id)
            or not _is_non_blank(membership_id)
        ):
            raise ResourceNotFoundError

        return TrustedOrganizationOnlyContext(
            principal=principal,
            user_id=candidate.user_id,
            organization_id=organization_id,
            membership_id=membership_id,
        )


class IdentityContextResolver:
    def __init__(self, repository: IdentityContextRepository) -> None:
        self._repository = repository

    def resolve(
        self,
        request_context: Mapping[str, object],
        requested_scope: RequestedOrganizationScope,
    ) -> TrustedOrganizationContext:
        principal = principal_from_api_gateway_request_context(request_context)
        user_id = self._repository.find_internal_user_id(principal)
        if user_id is None or not _is_non_blank(user_id):
            # An externally valid but unprovisioned identity is not a trusted
            # VADA actor. Keep it indistinguishable from other auth failures.
            raise UnauthenticatedError

        if not _is_non_blank(requested_scope.organization_id) or not _is_non_blank(
            requested_scope.event_id
        ):
            raise ResourceNotFoundError

        candidate = self._repository.find_organization_context(
            user_id=user_id,
            organization_id=requested_scope.organization_id,
            event_id=requested_scope.event_id,
        )
        if candidate is None or not _candidate_matches_scope(
            candidate,
            user_id=user_id,
            requested_scope=requested_scope,
        ):
            raise ResourceNotFoundError

        active_departments = _active_department_facts(
            candidate,
            user_id=user_id,
            requested_scope=requested_scope,
        )
        if not active_departments:
            raise ResourceNotFoundError

        return TrustedOrganizationContext(
            principal=principal,
            user_id=user_id,
            organization_id=candidate.organization_id,
            membership_id=candidate.membership_id,
            event_id=candidate.event_id,
            department_relationships=active_departments,
        )


def _candidate_matches_scope(
    candidate: OrganizationContextCandidate,
    *,
    user_id: str,
    requested_scope: RequestedOrganizationScope,
) -> bool:
    return (
        candidate.user_id == user_id
        and candidate.organization_id == requested_scope.organization_id
        and candidate.membership_is_active
        and _is_non_blank(candidate.membership_id)
        and candidate.event_id == requested_scope.event_id
        and candidate.event_organization_id == requested_scope.organization_id
    )


def _active_department_facts(
    candidate: OrganizationContextCandidate,
    *,
    user_id: str,
    requested_scope: RequestedOrganizationScope,
) -> tuple[DepartmentRelationshipFact, ...]:
    facts: list[DepartmentRelationshipFact] = []
    for relationship in candidate.department_relationships:
        if (
            relationship.user_id != user_id
            or relationship.membership_id != candidate.membership_id
            or relationship.organization_id != requested_scope.organization_id
            or not _is_non_blank(relationship.relationship_id)
            or not _is_non_blank(relationship.department_id)
        ):
            raise ResourceNotFoundError
        if relationship.is_active:
            facts.append(
                DepartmentRelationshipFact(
                    relationship_id=relationship.relationship_id,
                    department_id=relationship.department_id,
                )
            )
    return tuple(facts)


def _is_non_blank(value: str | None) -> bool:
    return isinstance(value, str) and bool(value) and value == value.strip()
