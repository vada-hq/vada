"""주소를 어디서 가져오는지, 그 순서가 맞는지 본다.

셋이 있다. 인자, 환경변수의 값, 환경변수가 가리키는 SSM 자리. 순서가 틀리면
조용히 다른 데이터베이스를 본다 — 실제로 `just migrate`가 그렇게 엉뚱한 곳으로
갔고, 명령은 성공했다고 말했다.

SSM은 부르지 않는다. 읽는 함수를 갈아 끼워 **어떤 이름으로 물었는지**만 본다.
"""

from __future__ import annotations

from vada_api.database import (
    DATABASE_URL_ENVIRONMENT_VARIABLE,
    DATABASE_URL_PARAMETER_ENVIRONMENT_VARIABLE,
    resolve_database_url,
)

DIRECT = "postgresql+psycopg://vada:secret@direct.example/vada"
STORED = "postgresql+psycopg://vada:secret@stored.example/vada"
EXPLICIT = "postgresql+psycopg://vada:secret@explicit.example/vada"
DIALECT_ONLY = "postgresql+psycopg://"


class FakeParameterStore:
    def __init__(self, value: str | None = STORED) -> None:
        self.asked: list[str] = []
        self._value = value

    def __call__(self, name: str) -> str | None:
        self.asked.append(name)
        return self._value


def test_the_parameter_store_answers_when_nothing_else_does() -> None:
    store = FakeParameterStore()

    resolved = resolve_database_url(
        DIALECT_ONLY,
        {DATABASE_URL_PARAMETER_ENVIRONMENT_VARIABLE: "/vada/skeleton/database-url"},
        read_parameter=store,
    )

    assert resolved == STORED
    assert store.asked == ["/vada/skeleton/database-url"]


def test_a_direct_address_wins_over_the_parameter_store() -> None:
    """개발 기계는 `.env`로 준다. 그때 SSM을 부르면 AWS 자격 증명을 요구한다."""
    store = FakeParameterStore()

    resolved = resolve_database_url(
        DIALECT_ONLY,
        {
            DATABASE_URL_ENVIRONMENT_VARIABLE: DIRECT,
            DATABASE_URL_PARAMETER_ENVIRONMENT_VARIABLE: "/vada/skeleton/database-url",
        },
        read_parameter=store,
    )

    assert resolved == DIRECT
    assert store.asked == [], "값이 이미 있는데 SSM을 불렀습니다."


def test_an_explicit_address_wins_over_everything() -> None:
    # 통합 테스트가 일회용 데이터베이스를 인자로 준다. 여기서 밀리면
    # 테스트가 배포용 데이터를 건드린다.
    store = FakeParameterStore()

    resolved = resolve_database_url(
        EXPLICIT,
        {
            DATABASE_URL_ENVIRONMENT_VARIABLE: DIRECT,
            DATABASE_URL_PARAMETER_ENVIRONMENT_VARIABLE: "/vada/skeleton/database-url",
        },
        read_parameter=store,
    )

    assert resolved == EXPLICIT
    assert store.asked == []


def test_an_empty_parameter_reads_as_no_address() -> None:
    # 자리는 있는데 값을 아직 안 넣은 상태다. 빈 문자열을 주소로 쓰면
    # 연결이 알 수 없는 오류로 실패한다.
    store = FakeParameterStore(value="   ")

    resolved = resolve_database_url(
        DIALECT_ONLY,
        {DATABASE_URL_PARAMETER_ENVIRONMENT_VARIABLE: "/vada/skeleton/database-url"},
        read_parameter=store,
    )

    assert resolved is None
