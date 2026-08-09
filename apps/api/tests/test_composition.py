"""라우트가 읽는 것을 조립이 실제로 붙이는지 본다.

임포트는 통과하고 pyright도 통과한다. 그래도 실서버는 500이 난다 — 라우트가
`request.app.state.X`를 읽는데 조립이 X를 안 붙였기 때문이다.

이 저장소에서 두 번 났다. 재정 검토 저장소가 그랬고, 조직 역할 화면이 그랬다.
둘 다 테스트가 의존성을 갈아 끼워서 통과했다. 갈아 끼운 자리는 조립을 보지
않는다. 그래서 여기서는 실제 조립 함수를 부르고 라우트가 읽는 이름을 소스에서
뽑아 맞춰 본다.

데이터베이스는 필요 없다. SQLAlchemy 엔진은 붙을 때까지 붙지 않는다.
"""

from __future__ import annotations

import re
from pathlib import Path

from fastapi import FastAPI
from sqlalchemy import create_engine

from vada_api.composition import configure_postgresql_dependencies

SOURCE_ROOT = Path(__file__).parents[1] / "src" / "vada_api"

_STATE_READ = re.compile(r"app\.state\.([a-z_][a-z0-9_]*)")

# 이름을 문자열로 감춰 읽는 형태도 본다. `getattr(request.app.state, "x", None)`은
# 위 정규식에 안 걸리고, 그래서 `/whoami`가 한동안 이 그물 밖에 있었다.
_STATE_GETATTR = re.compile(r"app\.state,\s*[\"']([a-z_][a-z0-9_]*)[\"']")

# 실제로 붙지 않는다. 조립은 어댑터를 만들 뿐 질의하지 않는다.
UNUSED = "postgresql+psycopg://vada:vada@composition.invalid/vada"


def _route_sources() -> list[Path]:
    """라우트가 사는 곳. 도메인은 `api.py`, 뼈대 경로는 `main.py`다.

    `main.py`를 빼먹으면 거기 붙은 라우트가 그물 밖에 남는다. 실제로 `/whoami`가
    한동안 그랬다 — 조립이 아니라 `create_app`에서 직접 붙여 두었고, 이 검사는
    그것을 보지 못했다.
    """
    return [*SOURCE_ROOT.rglob("api.py"), SOURCE_ROOT / "main.py"]


def _names_read_by_routes() -> set[str]:
    names: set[str] = set()
    for path in _route_sources():
        source = path.read_text(encoding="utf-8")
        names |= set(_STATE_READ.findall(source))
        names |= set(_STATE_GETATTR.findall(source))
    return names


def test_composition_provides_everything_the_routes_read() -> None:
    expected = _names_read_by_routes()
    assert expected, "라우트에서 app.state 읽기를 하나도 못 찾았습니다."

    application = FastAPI()
    configure_postgresql_dependencies(application, create_engine(UNUSED))

    missing = sorted(name for name in expected if not hasattr(application.state, name))
    assert missing == [], (
        "라우트가 읽는데 조립이 붙이지 않는 것이 있습니다."
        f" 실서버에서 500이 납니다: {missing}"
    )
