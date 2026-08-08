"""어느 데이터베이스를 겨냥할지 정하는 한 자리.

주소를 고르는 규칙이 앱·마이그레이션·시드에 따로 있으면 셋이 서로 다른 곳을
보게 된다. 실제로 `just migrate`가 환경을 무시하고 alembic.ini에 박힌 주소로
갔다. 명령은 성공했다고 말했고, 화면만 비어 있었다.
"""

from __future__ import annotations

import os
from collections.abc import Mapping

from sqlalchemy.engine import make_url
from sqlalchemy.exc import ArgumentError

DATABASE_URL_ENVIRONMENT_VARIABLE = "VADA_DATABASE_URL"


def names_a_host(url: str | None) -> bool:
    """주소인가, 방언을 고르는 자리인가.

    alembic.ini의 `postgresql+psycopg://`는 오프라인 DDL 렌더링이 방언을 고르는
    데만 쓴다. 비어 있지 않다고 해서 붙을 곳을 가리키는 것은 아니다.
    """
    if url is None or not url.strip():
        return False
    try:
        return bool(make_url(url.strip()).host)
    except ArgumentError:
        return False


def resolve_database_url(
    configured: str | None = None,
    environment: Mapping[str, str] | None = None,
) -> str | None:
    """부르는 쪽이 넣은 주소가 환경보다 세다.

    통합 테스트가 일회용 데이터베이스를 인자로 지정한다. 개발용 주소가 셸에
    떠 있다고 그쪽으로 끌려가면 테스트가 개발 데이터를 지운다. 그래서 환경이
    이기게 두지 않는다.
    """
    candidate = (configured or "").strip()
    if names_a_host(candidate):
        return candidate

    source = os.environ if environment is None else environment
    from_environment = (source.get(DATABASE_URL_ENVIRONMENT_VARIABLE) or "").strip()
    return from_environment or None
