from __future__ import annotations

from typing import Protocol

from fastapi import Request
from sqlalchemy.exc import SQLAlchemyError

from vada_api.finance.application import FinanceRequestContext
from vada_api.finance.authorization import PurchaseRequestActorFacts
from vada_api.finance.submission import PurchaseRequestPersistenceError
from vada_api.identity.authentication import (
    api_gateway_request_context,
    principal_from_api_gateway_request_context,
)
from vada_api.identity.context import (
    IdentityContextRepository,
    IdentityContextResolver,
    RequestedOrganizationScope,
)
from vada_api.identity.errors import ResourceNotFoundError, UnauthenticatedError
from vada_api.identity.persistence.relationships import (
    PurchaseRequestRelationshipContext,
)


class PurchaseRequestContextRepository(IdentityContextRepository, Protocol):
    def find_active_organization_id_for_event(
        self, *, user_id: str, event_id: str
    ) -> str | None: ...

    def find_purchase_request_context(
        self,
        *,
        user_id: str,
        organization_id: str,
        membership_id: str,
        event_id: str,
    ) -> PurchaseRequestRelationshipContext | None: ...


class PostgreSQLPurchaseRequestContextProvider:
    """Resolve the request actor only from API Gateway and PostgreSQL facts."""

    def __init__(self, repository: PurchaseRequestContextRepository) -> None:
        self._repository = repository
        self._identity_resolver = IdentityContextResolver(repository)

    def resolve(self, request: Request, *, event_id: str) -> FinanceRequestContext:
        request_context = api_gateway_request_context(request)
        principal = principal_from_api_gateway_request_context(request_context)
        try:
            user_id = self._repository.find_internal_user_id(principal)
            if user_id is None:
                raise UnauthenticatedError
            organization_id = self._repository.find_active_organization_id_for_event(
                user_id=user_id,
                event_id=event_id,
            )
            if organization_id is None:
                raise ResourceNotFoundError

            identity = self._identity_resolver.resolve(
                request_context,
                RequestedOrganizationScope(
                    organization_id=organization_id,
                    event_id=event_id,
                ),
            )
            relationship = self._repository.find_purchase_request_context(
                user_id=identity.user_id,
                organization_id=identity.organization_id,
                membership_id=identity.membership_id,
                event_id=identity.event_id,
            )
        except SQLAlchemyError as error:
            raise PurchaseRequestPersistenceError from error

        if relationship is None or not _is_valid_relationship(
            relationship,
            department_ids=identity.department_ids,
        ):
            raise ResourceNotFoundError

        return FinanceRequestContext(
            actor=PurchaseRequestActorFacts(
                identity=identity,
                department_head_of=relationship.department_head_of,
                finance_member_of=(
                    frozenset({identity.organization_id})
                    if relationship.is_finance_member
                    else frozenset()
                ),
            ),
            event_name=relationship.event_name,
            requester_name=relationship.requester_name,
            request_department_id=relationship.request_department_id,
            request_department_name=relationship.request_department_name,
            available_budget=relationship.available_budget,
        )


def _is_valid_relationship(
    relationship: PurchaseRequestRelationshipContext,
    *,
    department_ids: frozenset[str],
) -> bool:
    return (
        _is_non_blank(relationship.event_name)
        and _is_non_blank(relationship.requester_name)
        and _is_non_blank(relationship.request_department_id)
        and _is_non_blank(relationship.request_department_name)
        and relationship.request_department_id in department_ids
        and relationship.department_head_of <= department_ids
        and relationship.available_budget >= 0
    )


def _is_non_blank(value: str) -> bool:
    return bool(value) and value == value.strip()
