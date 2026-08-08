from __future__ import annotations

from fastapi import Request
from sqlalchemy.exc import SQLAlchemyError

from vada_api.identity.authentication import api_gateway_request_context
from vada_api.identity.context import (
    SoleOrganizationContextResolver,
    SoleOrganizationRepository,
    TrustedOrganizationOnlyContext,
)
from vada_api.organization.application import OrganizationPersistenceError


class PostgreSQLOrganizationContextProvider:
    """조직 화면의 요청자를 API Gateway와 PostgreSQL 사실로만 세운다.

    행사가 없다. 계약이 조직 화면의 경로에 조직 식별자를 두지 않으므로 서버가
    사용자의 활성 소속에서 유도한다. 소속이 정확히 하나일 때만 답한다 — 둘
    이상이면 어느 학생회를 말하는지 알 수 없고, 그때 아무거나 고르면 다른
    조직의 명단을 보여준다.

    조회는 한 번이다. 이 판정에 왕복을 넷 쓰던 때가 있었고, 화면이 열리는 데
    1.2초가 거기서 갔다.
    """

    def __init__(self, repository: SoleOrganizationRepository) -> None:
        self._resolver = SoleOrganizationContextResolver(repository)

    def resolve(self, request: Request) -> TrustedOrganizationOnlyContext:
        try:
            return self._resolver.resolve(api_gateway_request_context(request))
        except SQLAlchemyError as error:
            raise OrganizationPersistenceError from error
