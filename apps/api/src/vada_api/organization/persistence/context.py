from __future__ import annotations

from typing import Protocol

from fastapi import Request
from sqlalchemy.exc import SQLAlchemyError

from vada_api.identity.authentication import (
    api_gateway_request_context,
    principal_from_api_gateway_request_context,
)
from vada_api.identity.context import (
    IdentityContextRepository,
    IdentityContextResolver,
    TrustedOrganizationOnlyContext,
)
from vada_api.identity.errors import ResourceNotFoundError, UnauthenticatedError
from vada_api.organization.application import OrganizationPersistenceError


class OrganizationContextRepository(IdentityContextRepository, Protocol):
    def find_active_organization_id(self, *, user_id: str) -> str | None: ...


class PostgreSQLOrganizationContextProvider:
    """조직 화면의 요청자를 API Gateway와 PostgreSQL 사실로만 세운다.

    행사가 없다. 계약이 조직 화면의 경로에 조직 식별자를 두지 않으므로 서버가
    사용자의 활성 소속에서 유도한다. 소속이 정확히 하나일 때만 답한다 — 둘
    이상이면 어느 학생회를 말하는지 알 수 없고, 그때 아무거나 고르면 다른
    조직의 명단을 보여준다.
    """

    def __init__(self, repository: OrganizationContextRepository) -> None:
        self._repository = repository
        self._identity_resolver = IdentityContextResolver(repository)

    def resolve(self, request: Request) -> TrustedOrganizationOnlyContext:
        request_context = api_gateway_request_context(request)
        principal = principal_from_api_gateway_request_context(request_context)
        try:
            user_id = self._repository.find_internal_user_id(principal)
            if user_id is None:
                raise UnauthenticatedError
            organization_id = self._repository.find_active_organization_id(
                user_id=user_id
            )
            if organization_id is None:
                raise ResourceNotFoundError

            return self._identity_resolver.resolve_organization(
                request_context, organization_id=organization_id
            )
        except SQLAlchemyError as error:
            raise OrganizationPersistenceError from error
