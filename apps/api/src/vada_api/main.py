from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI
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
from vada_api.local_development import (
    LocalPrincipalMiddleware,
    local_principal_from_environment,
)
from vada_api.organization.api import (
    register_organization_error_handlers,
)
from vada_api.organization.api import router as organization_router


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
    application.include_router(router)
    application.include_router(organization_router)
    application.add_api_route("/health", _health, methods=["GET"])
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


app = create_app()

# Lambda가 부르는 자리. Mangum이 게이트웨이 이벤트를 ASGI로 옮기고, 그 원본
# 이벤트를 `scope["aws.event"]`에 넣는다. 인증 경계가 읽는 자리가 정확히 거기다
# (`vada_api.identity.authentication.api_gateway_request_context`).
#
# 로컬에는 게이트웨이가 없어 `LocalPrincipalMiddleware`가 그 자리를 흉내낸다.
# 배포에서는 이 경로로 진짜 청구항이 들어온다.
handler = Mangum(app)
