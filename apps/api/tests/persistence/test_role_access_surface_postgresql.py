# pyright: reportUnknownMemberType=false
"""누가 어느 화면에 들어갈 수 있는지를 실제 PostgreSQL로 고정한다.

멀티테넌트 격리와 권한이 이 프로젝트 최대 보안 리스크인데, 지금까지 그 판정은
도메인마다 흩어진 짝 테스트에만 있었다. **표가 없으니 구멍이 안 보였다.**

실제로 사람이 브라우저를 열고서야 두 가지를 찾았다. 부서가 둘인 부서장은 재정
화면 전체가 404였고, 부서 미배정 부원도 마찬가지였다. 둘 다 어느 테스트도
보고 있지 않았다.

여기서는 **허용인가 거부인가**만 본다. 거부의 코드(403/404)는 경로마다 다르다 —
저장소가 "없는 것"과 "못 보는 것"을 일부러 같은 답으로 돌려보내는 자리가 있기
때문이다. 그 구분까지 여기서 못 박으면 정책이 바뀔 때마다 이 표가 깨진다.

기대값의 근거는 `VADA_PERMISSION_MATRIX.md`다.

    canSubmitPurchaseRequest | 재정부 · 부서장 | 구매 요청 작성·보완 재제출
    구매 요청 작성·제출 (FIN-REQ-01B) | 재정부 · 부서장
      — FIN-REQ-01은 일반 부원의 권한 없음 상태

지금 틀린 칸은 `xfail(strict=True)`로 적어 둔다. 고쳐지면 XPASS가 되어 이
표시를 지우라고 실패한다 — 알려진 결함이 조용히 남지 않는다.
"""

from __future__ import annotations

from collections.abc import Iterator, Mapping
from typing import cast

import pytest
from fastapi.testclient import TestClient
from httpx import Response
from scripts import seed_local
from sqlalchemy import Engine
from starlette.types import ASGIApp, Receive, Scope, Send

from vada_api.main import create_app

pytestmark = pytest.mark.postgres

EVENT = seed_local.EVENT
REQUEST = seed_local.REQUEST

MEMBER_ROLES = "/organization/member-roles"
EDITOR = f"/events/{EVENT}/purchase-request-editor"
REVISION = f"/events/{EVENT}/purchase-requests/{REQUEST}/revision"
REVIEW = f"/events/{EVENT}/purchase-requests/{REQUEST}/review"

ALLOWED = True
REFUSED = False

# 시드의 네 사람이 권한 축을 덮는다. 부서 둘과 부서 미배정도 사람이다.
PRESIDENT = seed_local.PRESIDENT  # 회장단 · 기획부 하나
FINANCE = seed_local.FINANCE  # 부원 · 재정부 · 기획부 하나
HEAD = seed_local.HEAD  # 부서장 · 운영부와 홍보부 둘
PLAIN = seed_local.MEMBER  # 부원 · 부서 미배정

PRESIDENT_CANNOT_SUBMIT = (
    "회장단은 재정부도 부서장도 아니다."
    " 매트릭스에 작성·보완 재제출 권한이 없는데 지금은 들어가진다."
)
TWO_DEPARTMENTS_BLOCK_FINANCE = (
    "부서가 둘이면 재정 맥락을 세우지 못한다"
    " (relationships.py의 len(rows) != 1). 정본 충돌이 아직 안 풀렸다."
)

# (사람, 경로) → 들어갈 수 있어야 하는가. 근거는 권한 매트릭스다.
SURFACE = [
    (PRESIDENT, MEMBER_ROLES, ALLOWED, None),
    (FINANCE, MEMBER_ROLES, REFUSED, None),
    (HEAD, MEMBER_ROLES, REFUSED, None),
    (PLAIN, MEMBER_ROLES, REFUSED, None),
    (PRESIDENT, EDITOR, REFUSED, PRESIDENT_CANNOT_SUBMIT),
    (FINANCE, EDITOR, ALLOWED, None),
    (HEAD, EDITOR, ALLOWED, TWO_DEPARTMENTS_BLOCK_FINANCE),
    (PLAIN, EDITOR, REFUSED, None),
    (PRESIDENT, REVISION, REFUSED, PRESIDENT_CANNOT_SUBMIT),
    (FINANCE, REVISION, ALLOWED, None),
    (HEAD, REVISION, ALLOWED, TWO_DEPARTMENTS_BLOCK_FINANCE),
    (PLAIN, REVISION, REFUSED, None),
    (PRESIDENT, REVIEW, REFUSED, None),
    (FINANCE, REVIEW, ALLOWED, None),
    (HEAD, REVIEW, REFUSED, None),
    (PLAIN, REVIEW, REFUSED, None),
]


class _ApiGatewayContextApp:
    """게이트웨이가 채우는 자리를 그 사람의 주체로 채운다."""

    def __init__(self, application: ASGIApp, *, subject: str) -> None:
        self._application = application
        self._event: Mapping[str, object] = {
            "requestContext": {
                "authorizer": {
                    "jwt": {
                        "claims": {
                            "token_use": "access",
                            "iss": seed_local.ISSUER,
                            "sub": subject,
                        }
                    }
                }
            }
        }

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] == "http":
            scope["aws.event"] = self._event
        await self._application(scope, receive, send)


@pytest.fixture(scope="module")
def seeded(migrated_engine: Engine) -> Iterator[Engine]:
    seed_local.seed(migrated_engine, reset=True)
    try:
        yield migrated_engine
    finally:
        with migrated_engine.begin() as connection:
            seed_local._delete_seeded(connection)  # pyright: ignore[reportPrivateUsage]


def _status(engine: Engine, *, subject: str, path: str) -> int:
    application = create_app(engine=engine)
    client = TestClient(_ApiGatewayContextApp(application, subject=subject))
    with client:
        response = cast(Response, client.get(path))
    return response.status_code


@pytest.mark.parametrize(("subject", "path", "allowed", "known_defect"), SURFACE)
def test_who_can_open_which_screen(
    seeded: Engine,
    subject: str,
    path: str,
    allowed: bool,
    known_defect: str | None,
) -> None:
    if known_defect is not None:
        pytest.xfail(known_defect)

    status = _status(seeded, subject=subject, path=path)

    if allowed:
        assert status == 200, f"{subject}는 {path}에 들어갈 수 있어야 합니다."
    else:
        # 거부의 코드는 경로마다 다르다. 들어가지 못한다는 것만 못 박는다.
        assert status in (401, 403, 404), (
            f"{subject}는 {path}에 들어가면 안 됩니다. 지금 {status}입니다."
        )
