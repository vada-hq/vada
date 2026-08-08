"""저장소가 실제로 PostgreSQL SQL을 만들어 내는지 본다.

임포트되는 것과 도는 것은 다른 사실이다. 여기서는 문장을 붙잡아 컴파일해
조직 범위가 조건에 들어갔는지까지 확인한다. 실제 데이터로 도는지는
`just test-api-postgresql`이 본다.
"""

from __future__ import annotations

from typing import Any, cast

import pytest
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from vada_api.organization.persistence.member_roles import PostgreSQLMemberRoleStore
from vada_api.organization.roles import MemberRole, MemberRoleState

ORGANIZATION = "organization-a"


class CapturingConnection:
    """실행 대신 문장을 붙잡는다. 데이터베이스가 없어도 SQL을 볼 수 있다."""

    def __init__(self, captured: list[sa.ClauseElement], rowcount: int) -> None:
        self._captured = captured
        self._rowcount = rowcount

    def __enter__(self) -> CapturingConnection:
        return self

    def __exit__(self, *_: object) -> None:
        return None

    def execute(self, statement: sa.ClauseElement) -> Any:
        self._captured.append(statement)
        return _EmptyResult(self._rowcount)


class _EmptyResult:
    def __init__(self, rowcount: int) -> None:
        self.rowcount = rowcount

    def mappings(self) -> _EmptyResult:
        return self

    def all(self) -> list[object]:
        return []


class CapturingEngine:
    """연결을 몇 번 잡았는지도 센다. 왕복 수가 화면이 열리는 시간을 정한다."""

    def __init__(self) -> None:
        self.captured: list[sa.ClauseElement] = []
        self.connections = 0
        self.rowcount = 0

    def connect(self) -> CapturingConnection:
        self.connections += 1
        return CapturingConnection(self.captured, self.rowcount)

    def begin(self) -> CapturingConnection:
        self.connections += 1
        return CapturingConnection(self.captured, self.rowcount)


def _compile(statement: sa.ClauseElement) -> str:
    return str(
        statement.compile(
            dialect=postgresql.dialect(),
            compile_kwargs={"literal_binds": True},
        )
    )


@pytest.fixture
def engine() -> CapturingEngine:
    return CapturingEngine()


def test_the_member_query_compiles_and_scopes_by_organization(
    engine: CapturingEngine,
) -> None:
    store = PostgreSQLMemberRoleStore(cast(Any, engine))

    store.list_members(organization_id=ORGANIZATION)

    sql = _compile(engine.captured[0])
    assert "organization_memberships.organization_id = 'organization-a'" in sql
    assert "array_agg" in sql
    # 미배정 구성원도 나와야 한다. 부서 조인이 바깥쪽이어야 한다.
    assert "LEFT OUTER JOIN department_memberships" in sql


def test_the_role_update_carries_the_expected_current_role(
    engine: CapturingEngine,
) -> None:
    store = PostgreSQLMemberRoleStore(cast(Any, engine))

    store.change_role_and_list(
        MemberRoleState(membership_id="membership-a", role=MemberRole.DEPARTMENT_HEAD),
        organization_id=ORGANIZATION,
        expected_current_role=MemberRole.MEMBER,
    )

    sql = _compile(engine.captured[0])
    assert sql.startswith("UPDATE organization_memberships")
    # 낙관적 잠금이다. 기대한 값이 조건에 들어가야 한 문장으로 확인하고 쓴다.
    assert "organization_memberships.role = 'member'" in sql
    assert "SET role='department_head'" in sql.replace(" = ", "=")
    # 구성원 식별자만으로 쓰면 다른 조직의 구성원을 바꿀 수 있다.
    assert "organization_memberships.organization_id = 'organization-a'" in sql


def test_a_lost_race_reports_no_write(engine: CapturingEngine) -> None:
    # rowcount가 0이면 기대한 값이 아니었다는 뜻이다. 덮어쓰지 않았다.
    store = PostgreSQLMemberRoleStore(cast(Any, engine))

    changed = store.change_role_and_list(
        MemberRoleState(membership_id="membership-a", role=MemberRole.MEMBER),
        organization_id=ORGANIZATION,
        expected_current_role=MemberRole.PRESIDENT,
    )

    assert changed is None
    # 쓰지 못했으면 명단도 읽지 않는다. 왕복을 하나 덜 쓴다.
    assert len(engine.captured) == 1


def test_a_successful_write_reads_the_new_list_in_the_same_transaction(
    engine: CapturingEngine,
) -> None:
    """쓰고 나서 따로 읽으면 왕복이 하나 더 들고, 그 사이에 다른 회장단이 쓰면
    돌려주는 명단이 내가 쓴 결과가 아니게 된다."""
    engine.rowcount = 1
    store = PostgreSQLMemberRoleStore(cast(Any, engine))

    store.change_role_and_list(
        MemberRoleState(membership_id="membership-a", role=MemberRole.MEMBER),
        organization_id=ORGANIZATION,
        expected_current_role=MemberRole.PRESIDENT,
    )

    assert len(engine.captured) == 2
    assert _compile(engine.captured[0]).startswith("UPDATE organization_memberships")
    assert "SELECT" in _compile(engine.captured[1])
    # 한 연결에서 둘 다 했다. 트랜잭션이 하나여야 응답이 내가 쓴 결과다.
    assert engine.connections == 1
