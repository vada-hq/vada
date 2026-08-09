# pyright: reportUnknownMemberType=false
"""로그인한 사람이 실제 PostgreSQL에서 자기가 누구이고 무엇을 할 수 있는지 받는다.

계약 CB-IDENTITY-001@R1. 규칙만 단위 검사로 고정하면 스키마·질의·판정을 잇는
줄이 빠져도 초록불이다 — 이름을 못 읽거나 재정부 여부를 잘못 세는 것은 여기서만
드러난다.

기대값의 근거는 `VADA_PERMISSION_MATRIX.md`이고, 사람은 시드의 네 명이다.
부서가 둘인 부서장과 부서 미배정 부원이 거기 들어 있다.
"""

from __future__ import annotations

from collections.abc import Iterator
from typing import Any, cast

import pytest
from fastapi.testclient import TestClient
from httpx import Response
from scripts import seed_local
from sqlalchemy import Engine
from starlette.types import ASGIApp, Receive, Scope, Send

from vada_api.main import create_app

pytestmark = pytest.mark.postgres

VIEWER = "/session/viewer"

PRESIDENT = seed_local.PRESIDENT  # 회장단 · 기획부. 재정부가 아니다
FINANCE = seed_local.FINANCE  # 부원 · 재정부
HEAD = seed_local.HEAD  # 부서장 · 부서 둘
PLAIN = seed_local.MEMBER  # 부원 · 부서 미배정

ALL_CAPABILITIES = (
    "canManageFinance",
    "canSubmitPurchaseRequest",
    "canCompleteEvent",
    "canEditOrganization",
    "canInviteOrganizationMember",
    "canManageStudentRoster",
    "canManageStudentFeeRoster",
)

# 사람 → 참이어야 하는 판정. 여기 없는 것은 전부 거짓이어야 한다.
EXPECTED: list[tuple[str, str, frozenset[str]]] = [
    (
        PRESIDENT,
        "박해랑",
        frozenset(
            {
                "canCompleteEvent",
                "canEditOrganization",
                "canInviteOrganizationMember",
                "canManageStudentRoster",
                "canManageStudentFeeRoster",
            }
        ),
    ),
    (
        FINANCE,
        "최유나",
        frozenset(
            {
                "canManageFinance",
                "canSubmitPurchaseRequest",
                "canManageStudentFeeRoster",
            }
        ),
    ),
    (
        HEAD,
        "김도윤",
        frozenset({"canSubmitPurchaseRequest", "canInviteOrganizationMember"}),
    ),
    (PLAIN, "이서준", frozenset()),
]


class _ApiGatewayContextApp:
    """게이트웨이가 검증해 넘겨주는 청구항을 흉내낸다."""

    def __init__(self, application: ASGIApp, *, subject: str) -> None:
        self._application = application
        self._event = {
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


def _viewer(engine: Engine, *, subject: str) -> Response:
    application = create_app(engine=engine)
    client = TestClient(_ApiGatewayContextApp(application, subject=subject))
    with client:
        return cast(Response, client.get(VIEWER))


@pytest.mark.parametrize(("subject", "display_name", "allowed"), EXPECTED)
def test_viewer_says_who_i_am_and_what_i_may_do(
    seeded: Engine, subject: str, display_name: str, allowed: frozenset[str]
) -> None:
    response = _viewer(seeded, subject=subject)

    assert response.status_code == 200
    body = cast(dict[str, Any], response.json())

    # 이름이 돌아왔다는 것이 데이터베이스를 읽었다는 증거다. 토큰에는 없다.
    assert body["displayName"] == display_name
    assert body["userId"] == subject
    assert body["organizationId"] == seed_local.ORGANIZATION

    capabilities = cast(dict[str, bool], body["capabilities"])
    granted = {name for name in ALL_CAPABILITIES if capabilities[name]}
    assert granted == set(allowed), (
        f"{display_name}({subject})의 전역 판정이 권한 매트릭스와 다릅니다."
    )


def test_president_alone_does_not_manage_finance(seeded: Engine) -> None:
    """직급으로 재정을 판정하면 조용히 뒤집히는 자리다.

    회장단은 조직에서 가장 높은 직급이지만 재정부가 아니면 총예산을 편성하지
    못한다. 재정부는 직급이 아니라 부서다.
    """
    body = cast(dict[str, Any], _viewer(seeded, subject=PRESIDENT).json())

    assert body["capabilities"]["canManageFinance"] is False


def test_an_identity_without_a_membership_is_refused(seeded: Engine) -> None:
    """Cognito에는 있는데 VADA에 없는 신원. 이름을 만들어 주지 않는다."""
    response = _viewer(seeded, subject="user-who-never-joined")

    assert response.status_code in (401, 404)
