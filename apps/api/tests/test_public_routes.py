"""게이트웨이가 열어 둔 자리와 코드가 아는 자리가 같은지 본다.

`infra/api.tf`는 `$default` 라우트 전체에 JWT 권한 부여자를 붙이고, 예외를
하나씩 따로 적는다. 그 예외 목록이 늘어나는 것을 아무도 안 보면, 어느 날
인증 없이 열린 자리가 생기고 그 사실은 아무 데도 안 적힌다.

**여기가 그 목록이다.** 게이트웨이에서 읽어와 코드가 아는 것과 맞춘다.
새로 열려면 이 파일이 먼저 실패한다.
"""

from __future__ import annotations

import re
from pathlib import Path

REPOSITORY_ROOT = Path(__file__).parents[3]
TERRAFORM = REPOSITORY_ROOT / "infra" / "api.tf"

# 인증 없이 열어 두기로 한 자리. 늘리려면 왜 열어도 되는지 여기 적는다.
#
# `/health`는 배포 후 검사가 토큰 없이 불러야 하고, 응답이 누구에게도
# 아무것도 알려주지 않는다.
INTENTIONALLY_PUBLIC = {"GET /health"}


def _routes_without_authorization() -> set[str]:
    source = TERRAFORM.read_text(encoding="utf-8")
    public: set[str] = set()

    for block in re.split(
        r'^resource\s+"aws_apigatewayv2_route"', source, flags=re.MULTILINE
    )[1:]:
        key = re.search(r'route_key\s*=\s*"([^"]+)"', block)
        kind = re.search(r'authorization_type\s*=\s*"([^"]+)"', block)
        if key and kind and kind.group(1) == "NONE":
            public.add(key.group(1))

    return public


def test_only_the_routes_we_named_are_open() -> None:
    assert _routes_without_authorization() == INTENTIONALLY_PUBLIC


def test_every_route_declares_whether_it_is_open() -> None:
    """`authorization_type`을 안 적은 라우트는 조용히 열린다.

    게이트웨이의 기본값이 인증 없음이라, 적지 않는 것과 열어 두는 것이
    같은 뜻이 된다. 그 둘은 읽는 사람에게 전혀 다른 뜻이다.
    """
    source = TERRAFORM.read_text(encoding="utf-8")
    blocks = re.split(
        r'^resource\s+"aws_apigatewayv2_route"', source, flags=re.MULTILINE
    )[1:]

    assert blocks, "라우트 선언을 하나도 찾지 못했습니다."
    for block in blocks:
        key = re.search(r'route_key\s*=\s*"([^"]+)"', block)
        assert key, block[:200]
        assert re.search(r"authorization_type\s*=", block), (
            f"{key.group(1)}에 authorization_type이 없습니다."
            " 안 적으면 인증 없이 열립니다."
        )
