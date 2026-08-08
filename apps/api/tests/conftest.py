"""테스트는 데이터베이스를 스스로 지정한다. 환경에서 물려받지 않는다.

`just`가 `.env`를 읽어 모든 명령에 넣는다. 개발용 주소도 그렇게 들어온다.
그 상태로 테스트를 돌리면 앱이 개발용 데이터베이스로 조립되고, 통합 테스트는
표를 만들고 지우면서 시드를 함께 지운다. 실제로 `.env`를 만든 직후
`just check-api`가 26건을 오류로 뱉었다 — 코드는 하나도 안 바뀐 채였다.
"""

from __future__ import annotations

import os

import pytest

DEVELOPMENT_DATABASE_URL = "VADA_DATABASE_URL"
DISPOSABLE_DATABASE_URL = "VADA_TEST_DATABASE_URL"

_development = (os.environ.pop(DEVELOPMENT_DATABASE_URL, "") or "").strip()
_disposable = (os.environ.get(DISPOSABLE_DATABASE_URL) or "").strip()

if _development and _development == _disposable:
    pytest.exit(
        f"{DISPOSABLE_DATABASE_URL}이 {DEVELOPMENT_DATABASE_URL}과 같습니다."
        " 통합 테스트는 표를 만들고 지웁니다 — 개발 데이터가 사라집니다.",
        returncode=1,
    )
