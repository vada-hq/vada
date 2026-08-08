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

    def __init__(self, captured: list[sa.ClauseElement]) -> None:
        self._captured = captured

    def __enter__(self) -> CapturingConnection:
        return self

    def __exit__(self, *_: object) -> None:
        return None

    def execute(self, statement: sa.ClauseElement) -> Any:
        self._captured.append(statement)
        return _EmptyResult()


class _EmptyResult:
    rowcount = 0

    def mappings(self) -> _EmptyResult:
        return self

    def all(self) -> list[object]:
        return []


class CapturingEngine:
    def __init__(self) -> None:
        self.captured: list[sa.ClauseElement] = []

    def connect(self) -> CapturingConnection:
        return CapturingConnection(self.captured)

    def begin(self) -> CapturingConnection:
        return CapturingConnection(self.captured)


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

    store.change_role(
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

    changed = store.change_role(
        MemberRoleState(membership_id="membership-a", role=MemberRole.MEMBER),
        organization_id=ORGANIZATION,
        expected_current_role=MemberRole.PRESIDENT,
    )

    assert changed is False
