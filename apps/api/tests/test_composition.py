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

# 실제로 붙지 않는다. 조립은 어댑터를 만들 뿐 질의하지 않는다.
UNUSED = "postgresql+psycopg://vada:vada@composition.invalid/vada"


def _names_read_by_routes() -> set[str]:
    names: set[str] = set()
    for path in SOURCE_ROOT.rglob("api.py"):
        names |= set(_STATE_READ.findall(path.read_text(encoding="utf-8")))
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
