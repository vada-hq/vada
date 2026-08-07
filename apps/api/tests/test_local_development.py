# pyright: reportUnknownMemberType=false, reportUnknownVariableType=false
# ↑ test_health.py와 같은 한계다. starlette TestClient의 httpx 조건부 import로
#   반환 타입이 Unknown이 된다. 이 파일에만 적용한다.
from collections.abc import Iterator, Mapping
from typing import cast

import httpx
import pytest
from starlette.applications import Starlette
from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.routing import Route
from starlette.testclient import TestClient
from starlette.types import ASGIApp, Receive, Scope, Send

from vada_api.identity.authentication import (
    principal_from_api_gateway_request_context,
)
from vada_api.identity.errors import UnauthenticatedError
from vada_api.local_development import (
    ISSUER_ENVIRONMENT_VARIABLE,
    SUBJECT_ENVIRONMENT_VARIABLE,
    LocalPrincipalMiddleware,
    local_principal_from_environment,
)


def _claims(issuer: str, subject: str) -> dict[str, object]:
    return {
        "requestContext": {
            "authorizer": {
                "jwt": {
                    "claims": {"token_use": "access", "iss": issuer, "sub": subject}
                }
            }
        }
    }


class _PretendGateway:
    """API Gateway가 먼저 주체를 채운 상황을 재현한다."""

    def __init__(self, application: ASGIApp, *, event: Mapping[str, object]) -> None:
        self._application = application
        self._event = event

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] == "http":
            scope["aws.event"] = self._event
        await self._application(scope, receive, send)


def _echo_principal(request: Request) -> JSONResponse:
    event = cast(Mapping[str, object], request.scope.get("aws.event") or {})
    request_context = cast(Mapping[str, object], event.get("requestContext") or {})
    try:
        principal = principal_from_api_gateway_request_context(request_context)
    except UnauthenticatedError:
        return JSONResponse({"principal": None})
    return JSONResponse(
        {"principal": {"issuer": principal.issuer, "subject": principal.subject}}
    )


def _application() -> ASGIApp:
    application = Starlette(routes=[Route("/echo", _echo_principal)])
    application.add_middleware(
        LocalPrincipalMiddleware, issuer="https://local", subject="local-subject"
    )
    return application


def _principal_of(application: ASGIApp) -> object:
    with TestClient(application) as client:
        response: httpx.Response = client.get("/echo")
        return response.json()


@pytest.fixture
def cleared_environment(monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    monkeypatch.delenv(ISSUER_ENVIRONMENT_VARIABLE, raising=False)
    monkeypatch.delenv(SUBJECT_ENVIRONMENT_VARIABLE, raising=False)
    yield


def test_local_principal_is_absent_without_both_variables(
    cleared_environment: None, monkeypatch: pytest.MonkeyPatch
) -> None:
    assert local_principal_from_environment() is None

    monkeypatch.setenv(ISSUER_ENVIRONMENT_VARIABLE, "https://local")
    assert local_principal_from_environment() is None, "발급자만으로는 켜지지 않는다"

    monkeypatch.setenv(SUBJECT_ENVIRONMENT_VARIABLE, "  ")
    assert local_principal_from_environment() is None, "공백은 값이 아니다"

    monkeypatch.setenv(SUBJECT_ENVIRONMENT_VARIABLE, "local-subject")
    assert local_principal_from_environment() == ("https://local", "local-subject")


def test_middleware_fills_the_empty_gateway_slot() -> None:
    assert _principal_of(_application()) == {
        "principal": {"issuer": "https://local", "subject": "local-subject"}
    }


def test_middleware_never_overrides_a_real_gateway_principal() -> None:
    behind_gateway = _PretendGateway(
        _application(), event=_claims("https://real-gateway", "real-subject")
    )

    # 배포 경로에서 실수로 설치되더라도 게이트웨이가 준 주체를 밀어내지 않는다.
    assert _principal_of(behind_gateway) == {
        "principal": {"issuer": "https://real-gateway", "subject": "real-subject"}
    }
