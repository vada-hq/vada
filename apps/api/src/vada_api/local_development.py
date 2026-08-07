"""로컬에서만 쓰는 개발 편의 장치. 배포 경로에서는 활성화되지 않는다."""

from __future__ import annotations

import os

from starlette.types import ASGIApp, Receive, Scope, Send

ISSUER_ENVIRONMENT_VARIABLE = "VADA_LOCAL_PRINCIPAL_ISSUER"
SUBJECT_ENVIRONMENT_VARIABLE = "VADA_LOCAL_PRINCIPAL_SUBJECT"


def local_principal_from_environment() -> tuple[str, str] | None:
    """두 환경변수가 모두 채워졌을 때만 로컬 주체를 쓴다."""

    issuer = (os.getenv(ISSUER_ENVIRONMENT_VARIABLE) or "").strip()
    subject = (os.getenv(SUBJECT_ENVIRONMENT_VARIABLE) or "").strip()
    if not issuer or not subject:
        return None
    return issuer, subject


class LocalPrincipalMiddleware:
    """운영에서 API Gateway가 채우는 자리를 로컬에서만 대신 채운다.

    배포에서는 API Gateway의 JWT 권한 부여자가 서명·발급자·만료를 검증한 뒤
    그 결과를 Lambda 이벤트의 ``requestContext``에 넣는다. 로컬 uvicorn 앞에는
    그 게이트웨이가 없어 모든 요청이 인증 실패로 끝난다.

    이 미들웨어는 **게이트웨이의 출력만** 흉내낸다. 사용자 조회, 조직 스코프
    판정, 권한 확인은 모두 실제 경로를 그대로 탄다. 그래서 여기서 넣은 주체가
    PostgreSQL에 없으면 실제와 똑같이 인증 실패가 된다.

    이미 ``aws.event``가 있으면 절대 덮지 않는다. 배포 경로에서 이 미들웨어가
    실수로 설치되더라도 게이트웨이가 준 진짜 주체를 밀어내지 못한다.
    """

    def __init__(self, application: ASGIApp, *, issuer: str, subject: str) -> None:
        self._application = application
        self._event: dict[str, object] = {
            "requestContext": {
                "authorizer": {
                    "jwt": {
                        "claims": {
                            "token_use": "access",
                            "iss": issuer,
                            "sub": subject,
                        }
                    }
                }
            }
        }

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] == "http" and "aws.event" not in scope:
            scope["aws.event"] = self._event
        await self._application(scope, receive, send)
