from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from mangum import Mangum
from sqlalchemy import Engine

from vada_api.composition import (
    configure_postgresql_dependencies,
    database_engine_from_environment,
)
from vada_api.finance.api import (
    normalize_purchase_request_openapi,
    register_purchase_request_error_handlers,
    router,
)
from vada_api.identity.authentication import (
    api_gateway_request_context,
    principal_from_api_gateway_request_context,
)
from vada_api.identity.persistence.relationships import (
    PostgreSQLIdentityOrganizationRepository,
)
from vada_api.local_development import (
    LocalPrincipalMiddleware,
    local_principal_from_environment,
)
from vada_api.organization.api import (
    register_organization_error_handlers,
)
from vada_api.organization.api import router as organization_router
from vada_api.session.api import register_session_error_handlers
from vada_api.session.api import router as session_router


def create_app(*, engine: Engine | None = None) -> FastAPI:
    configured_engine = (
        engine if engine is not None else database_engine_from_environment()
    )
    owned_engine = configured_engine if engine is None else None

    @asynccontextmanager
    async def lifespan(_application: FastAPI) -> AsyncGenerator[None]:
        try:
            yield
        finally:
            if owned_engine is not None:
                owned_engine.dispose()

    application = FastAPI(title="VADA API", lifespan=lifespan)
    register_purchase_request_error_handlers(application)
    register_organization_error_handlers(application)
    register_session_error_handlers(application)
    application.include_router(router)
    application.include_router(organization_router)
    application.include_router(session_router)
    application.add_api_route("/health", _health, methods=["GET"])
    application.add_api_route("/whoami", _whoami, methods=["GET"])
    if configured_engine is not None:
        configure_postgresql_dependencies(application, configured_engine)
    application.openapi_schema = normalize_purchase_request_openapi(
        application.openapi()
    )

    # 로컬에는 API Gateway가 없어 인증 주체가 비어 있다. 두 환경변수가 모두
    # 채워졌을 때만 그 자리를 채운다. 게이트웨이가 이미 준 주체는 덮지 않는다.
    local_principal = local_principal_from_environment()
    if local_principal is not None:
        issuer, subject = local_principal
        application.add_middleware(
            LocalPrincipalMiddleware, issuer=issuer, subject=subject
        )

    return application


def _health() -> dict[str, str]:
    # 인증 없는 유일한 엔드포인트 — 배포·모니터링용
    return {"status": "ok"}


def _whoami(request: Request) -> dict[str, str | None]:
    """게이트웨이가 검증한 청구항으로 데이터베이스에서 자기 이름을 찾는다.

    걷는 뼈대가 확인하는 사슬 전체가 이 한 줄에 있다 — Cognito가 발급하고,
    게이트웨이가 검증하고, Mangum이 옮기고, 우리 코드가 읽고, 그 신원으로
    실제 PostgreSQL을 조회한다.

    `name`이 `null`이면 Cognito에는 있는데 VADA에 등록되지 않은 사람이다.
    오류가 아니다. 데이터베이스에 못 붙으면 그건 오류이고, 조회가 던진다.
    """
    principal = principal_from_api_gateway_request_context(
        api_gateway_request_context(request)
    )
    identity = {"issuer": principal.issuer, "subject": principal.subject}

    # 데이터베이스가 붙지 않은 환경에서도 신원까지는 답한다. 배포에서는 항상
    # 붙어 있고, 안 붙어 있으면 배포 후 검사가 그것을 잡는다.
    #
    # `getattr`로 읽지 않는다. 조립 불변식 검사가 소스에서 `app.state.<이름>`을
    # 찾아 조립이 그것을 붙이는지 맞춰 보는데, 이름을 문자열로 감추면 그 그물을
    # 빠져나간다. 실제로 이 줄이 한 번 빠져나갔다.
    if not hasattr(request.app.state, "identity_names"):
        return {**identity, "name": None, "database": "absent"}

    names: PostgreSQLIdentityOrganizationRepository = request.app.state.identity_names
    return {
        **identity,
        "name": names.find_own_display_name(principal),
        "database": "connected",
    }


app = create_app()

# Lambda가 부르는 자리. Mangum이 게이트웨이 이벤트를 ASGI로 옮기고, 그 원본
# 이벤트를 `scope["aws.event"]`에 넣는다. 인증 경계가 읽는 자리가 정확히 거기다
# (`vada_api.identity.authentication.api_gateway_request_context`).
#
# 로컬에는 게이트웨이가 없어 `LocalPrincipalMiddleware`가 그 자리를 흉내낸다.
# 배포에서는 이 경로로 진짜 청구항이 들어온다.
handler = Mangum(app)
