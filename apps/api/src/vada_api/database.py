"""어느 데이터베이스를 겨냥할지 정하는 한 자리.

주소를 고르는 규칙이 앱·마이그레이션·시드에 따로 있으면 셋이 서로 다른 곳을
보게 된다. 실제로 `just migrate`가 환경을 무시하고 alembic.ini에 박힌 주소로
갔다. 명령은 성공했다고 말했고, 화면만 비어 있었다.
"""

from __future__ import annotations

import os
from collections.abc import Callable, Mapping

from sqlalchemy.engine import make_url
from sqlalchemy.exc import ArgumentError

DATABASE_URL_ENVIRONMENT_VARIABLE = "VADA_DATABASE_URL"

# 배포에서는 주소를 값이 아니라 **자리 이름**으로 준다.
#
# 값으로 주면 두 곳에 남는다. Terraform이 읽어 넣으면 상태 파일에 평문으로
# 남고, Lambda 환경변수에도 남아 함수 설정을 볼 수 있는 사람이면 다 본다.
# 자리 이름만 주고 실행할 때 읽으면 어느 쪽에도 값이 없다.
DATABASE_URL_PARAMETER_ENVIRONMENT_VARIABLE = "VADA_DATABASE_URL_PARAMETER"


def _read_parameter(name: str) -> str | None:
    """SSM Parameter Store에서 값을 읽는다.

    powertools를 쓰는 이유는 캐시다. Lambda는 같은 실행 환경을 재사용하므로
    호출마다 읽으면 매번 왕복이 붙는다.

    임포트를 함수 안에 둔다. 로컬 개발은 이 경로를 타지 않는데, 위에서
    임포트하면 AWS가 없는 기계에서도 부팅에 그 값을 치른다.
    """
    from aws_lambda_powertools.utilities import parameters

    # 변환 없이 부르면 문자열을 준다. 다만 반환 형태가 transform 인자에 따라
    # 갈리는 오버로드라, 그 사실이 여기까지 온전히 전해지지 않는다.
    return parameters.get_parameter(name, decrypt=True, max_age=300)  # pyright: ignore[reportUnknownMemberType]


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
    read_parameter: Callable[[str], str | None] = _read_parameter,
) -> str | None:
    """세 곳을 이 순서로 본다. 먼저 답하는 것이 이긴다.

    1. **부르는 쪽이 넣은 주소.** 통합 테스트가 일회용 데이터베이스를 인자로
       지정한다. 개발용 주소가 셸에 떠 있다고 그쪽으로 끌려가면 테스트가 개발
       데이터를 지운다. 그래서 환경이 이기게 두지 않는다.
    2. **환경변수의 주소.** 개발 기계가 `.env`로 준다.
    3. **환경변수가 가리키는 SSM 자리.** 배포가 이 길로 온다. 값이 아니라
       이름만 환경에 있으므로 함수 설정에도 상태 파일에도 주소가 남지 않는다.
    """
    candidate = (configured or "").strip()
    if names_a_host(candidate):
        return candidate

    source = os.environ if environment is None else environment

    direct = (source.get(DATABASE_URL_ENVIRONMENT_VARIABLE) or "").strip()
    if direct:
        return direct

    parameter = (source.get(DATABASE_URL_PARAMETER_ENVIRONMENT_VARIABLE) or "").strip()
    if parameter:
        return (read_parameter(parameter) or "").strip() or None

    return None
