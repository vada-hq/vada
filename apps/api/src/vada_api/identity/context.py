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
