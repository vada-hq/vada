"""마이그레이션이 어느 데이터베이스를 겨냥하는지 본다.

alembic.ini에 주소를 박아 두면 `just migrate`는 사람이 지정한 곳이 아니라 그
기본값으로 조용히 간다. 이 사고는 눈에 잘 띄지 않는다 — 명령은 성공했다고
말하고, 화면만 비어 있다.

붙지 않는 주소를 줘서 어디로 걸었는지 보는 방법은 쓰지 않는다. 이 머신에서
127.0.0.1의 닫힌 포트가 거부되기까지 130초가 걸렸다. 대신 판정을 함수로 꺼내
표를 고정하고, 그 함수를 env.py가 실제로 지난다는 것은 주소 없이 돌렸을 때
나오는 오류로 확인한다.
"""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

from vada_api.database import (
    DATABASE_URL_ENVIRONMENT_VARIABLE,
    resolve_database_url,
)

API_ROOT = Path(__file__).parents[2]

DEVELOPMENT = "postgresql+psycopg://vada:secret@dev.example/vada"
DISPOSABLE = "postgresql+psycopg://vada:secret@disposable.example/vada_test"

# alembic.ini에 남는 값. 오프라인 DDL 렌더링이 방언을 고르는 데만 쓴다.
DIALECT_ONLY = "postgresql+psycopg://"


def test_the_environment_names_the_database_when_the_caller_did_not() -> None:
    resolved = resolve_database_url(
        DIALECT_ONLY, {DATABASE_URL_ENVIRONMENT_VARIABLE: DEVELOPMENT}
    )

    assert resolved == DEVELOPMENT


def test_an_explicit_address_beats_the_environment() -> None:
    """통합 테스트가 일회용 데이터베이스를 인자로 준다.

    개발용 주소가 셸에 떠 있다고 그쪽으로 끌려가면 테스트가 표를 만들고 지우면서
    개발 데이터를 함께 지운다. `.env`를 읽는 `just`를 쓰기 시작한 뒤로 이 상황은
    예외가 아니라 기본값이다.
    """
    resolved = resolve_database_url(
        DISPOSABLE, {DATABASE_URL_ENVIRONMENT_VARIABLE: DEVELOPMENT}
    )

    assert resolved == DISPOSABLE


def test_the_dialect_placeholder_is_not_an_address() -> None:
    assert resolve_database_url(DIALECT_ONLY, {}) is None


def test_migrations_refuse_to_run_without_an_address() -> None:
    """판정을 env.py가 실제로 지나는지 본다.

    함수가 맞게 답해도 env.py가 부르지 않으면 소용없다. 주소 없이 돌리면 붙기
    전에 멈춰야 하고, 그 오류는 무엇을 채우라는 것인지 말해야 한다.
    """
    environment = dict(os.environ)
    environment.pop(DATABASE_URL_ENVIRONMENT_VARIABLE, None)
    # 오류 문구가 한국어다. 콘솔 기본 인코딩(cp949)으로 읽으면 읽지도 못하고 깨진다.
    environment["PYTHONIOENCODING"] = "utf-8"

    completed = subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", "head"],
        cwd=API_ROOT,
        env=environment,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        # 붙기 전에 멈춰야 한다. 여기서 오래 걸린다면 어딘가로 붙으러 간 것이다.
        timeout=60,
        check=False,
    )

    output = f"{completed.stdout}\n{completed.stderr}"
    assert completed.returncode != 0, output
    assert DATABASE_URL_ENVIRONMENT_VARIABLE in output, output
