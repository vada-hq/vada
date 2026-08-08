"""시드가 실제로 PostgreSQL SQL을 만들어 내는지 본다.

임포트되는 것과 도는 것은 다른 사실이다. 이 저장소에서 그 차이로 두 번 물렸다.
데이터베이스 없이도 문장을 붙잡아 컴파일하면 열이 빠졌는지, 계산 열을 넣으려
했는지, 조직 범위 없이 지우려 했는지까지 볼 수 있다.
"""

from __future__ import annotations

from typing import Any, cast

import pytest
import sqlalchemy as sa
from scripts import seed_local
from sqlalchemy.dialects import postgresql


class CapturingConnection:
    """실행 대신 문장과 넘긴 값을 함께 붙잡는다.

    값을 함께 봐야 하는 이유가 있다. SQLAlchemy는 값 없이 컴파일할 때 모든 열을
    적지만, 실행할 때는 넘긴 키만 쓴다. 계산 열을 넣으려 했는지는 문장이 아니라
    값을 봐야 안다.
    """

    def __init__(
        self, captured: list[tuple[sa.ClauseElement, object]], rows: object
    ) -> None:
        self._captured = captured
        self._rows = rows

    def __enter__(self) -> CapturingConnection:
        return self

    def __exit__(self, *_: object) -> None:
        return None

    def execute(self, statement: sa.ClauseElement, parameters: object = None) -> Any:
        self._captured.append((statement, parameters))
        return None

    def scalar(self, _statement: sa.ClauseElement) -> object:
        return self._rows


class CapturingEngine:
    def __init__(self, *, existing: int = 0) -> None:
        self.captured: list[tuple[sa.ClauseElement, object]] = []
        self._existing = existing

    def begin(self) -> CapturingConnection:
        return CapturingConnection(self.captured, self._existing)

    def statements(self) -> list[sa.ClauseElement]:
        return [statement for statement, _ in self.captured]


def _compile(statement: sa.ClauseElement) -> str:
    return str(statement.compile(dialect=postgresql.dialect()))


@pytest.fixture
def engine() -> CapturingEngine:
    return CapturingEngine()


def test_the_seed_compiles_into_postgresql_statements(
    engine: CapturingEngine,
) -> None:
    seed_local.seed(cast(Any, engine), reset=False)

    compiled = [_compile(statement) for statement in engine.statements()]
    tables = {
        "organizations",
        "vada_users",
        "cognito_identities",
        "organization_departments",
        "organization_events",
        "organization_memberships",
        "department_memberships",
        "organization_finance_memberships",
        "event_finance_contexts",
        "purchase_requests",
        "purchase_request_items",
        "purchase_request_item_review_events",
    }
    for table in tables:
        assert any(f"INSERT INTO {table} " in sql for sql in compiled), table


def test_the_seed_never_writes_the_computed_amount(engine: CapturingEngine) -> None:
    """estimated_amount는 계산 열이다. 넣으려 하면 PostgreSQL이 거부한다.

    문장이 아니라 넘긴 값을 본다. 문장만 보면 SQLAlchemy가 값 없이 컴파일할 때
    적어 넣는 모든 열이 보여, 넣지도 않은 열을 넣었다고 잘못 읽는다.
    """
    seed_local.seed(cast(Any, engine), reset=False)

    for statement, parameters in engine.captured:
        if "purchase_request_items" not in _compile(statement):
            continue
        assert isinstance(parameters, list)
        for row in cast("list[dict[str, object]]", parameters):
            assert "estimated_amount" not in row


def test_an_existing_seed_stops_without_reset() -> None:
    # 이미 든 것을 말없이 덮어쓰면 사람이 무엇을 보고 있는지 알 수 없다.
    engine = CapturingEngine(existing=1)

    with pytest.raises(SystemExit):
        seed_local.seed(cast(Any, engine), reset=False)

    assert engine.statements() == []


def test_reset_deletes_only_what_this_seed_made() -> None:
    # 표를 통째로 비우지 않는다. 잘못된 주소를 줬을 때 피해를 좁힌다.
    engine = CapturingEngine(existing=1)

    seed_local.seed(cast(Any, engine), reset=True)

    deletes = [
        _compile(statement)
        for statement in engine.statements()
        if isinstance(statement, sa.Delete)
    ]
    assert deletes, "지우는 문장이 하나도 없습니다."
    for sql in deletes:
        assert "WHERE" in sql, sql
    assert not any("TRUNCATE" in sql for sql in deletes)


def test_the_seed_covers_every_review_outcome() -> None:
    # 승인·보완 요청·반려가 다 있어야 재정 화면 다섯의 열이 전부 그려진다.
    outcomes = {review["review_status"] for review in seed_local.reviews()}

    assert outcomes == {"approved", "revision_requested", "rejected"}


def test_one_member_has_no_department() -> None:
    # 부서 미배정도 조직의 구성원이다. 그 사람이 화면에서 빠지지 않는지 봐야 한다.
    seed_local.seed(cast(Any, CapturingEngine()), reset=False)

    assigned = {seed_local.PRESIDENT, seed_local.FINANCE, seed_local.HEAD}
    everyone = {person["user_id"] for person in seed_local.people()}

    assert everyone - assigned == {seed_local.MEMBER}


def test_two_items_share_a_request_so_the_stack_can_be_seen() -> None:
    # 같은 요청의 카드가 한 열에 둘 이상이면 스택으로 묶인다. 확인할 자리가 필요하다.
    second = [
        item
        for item in seed_local.items()
        if item["request_id"] == seed_local.SECOND_REQUEST
    ]

    assert len(second) >= 2
