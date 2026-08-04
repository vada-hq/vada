from fastapi import FastAPI

from vada_api.finance.api import register_purchase_request_error_handlers, router


def create_app() -> FastAPI:
    application = FastAPI(title="VADA API")
    register_purchase_request_error_handlers(application)
    application.include_router(router)
    application.add_api_route("/health", _health, methods=["GET"])
    return application


def _health() -> dict[str, str]:
    # 인증 없는 유일한 엔드포인트 — 배포·모니터링용
    return {"status": "ok"}


app = create_app()
