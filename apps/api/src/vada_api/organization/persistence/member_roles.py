from __future__ import annotations

from typing import cast

import sqlalchemy as sa
from sqlalchemy import Engine
from sqlalchemy.exc import SQLAlchemyError

from vada_api.identity.persistence.schema import (
    department_memberships,
    organization_departments,
    organization_memberships,
    vada_users,
)
from vada_api.organization.application import (
    MemberRoleView,
    OrganizationPersistenceError,
)
from vada_api.organization.roles import MemberRole, MemberRoleState

MEMBERSHIPS = organization_memberships
USERS = vada_users
DEPARTMENT_MEMBERSHIPS = department_memberships
DEPARTMENTS = organization_departments


class PostgreSQLMemberRoleStore:
    """구성원의 기본 직급을 조직 범위로 읽고 바꾼다.

    모든 읽기·쓰기에 조직을 선두 조건으로 둔다. 구성원 식별자만으로 쓰면 다른
    조직의 구성원을 바꿀 수 있다.
    """

    def __init__(self, engine: Engine) -> None:
        self._engine = engine

    def list_members(self, *, organization_id: str) -> tuple[MemberRoleView, ...]:
        """활성 구성원과 소속 부서 이름을 한 번에 읽는다.

        한 구성원이 여러 부서에 속할 수 있어 부서를 배열로 모은다. 부서가 없는
        구성원도 나온다 — 미배정도 조직의 구성원이다.
        """
        departments = sa.func.array_remove(
            sa.func.array_agg(sa.func.distinct(DEPARTMENTS.c.name)),
            None,
        ).label("departments")

        statement = (
            sa.select(
                MEMBERSHIPS.c.membership_id,
                USERS.c.display_name,
                MEMBERSHIPS.c.role,
                departments,
            )
            .select_from(
                MEMBERSHIPS.join(USERS, USERS.c.user_id == MEMBERSHIPS.c.user_id)
                .outerjoin(
                    DEPARTMENT_MEMBERSHIPS,
                    sa.and_(
                        DEPARTMENT_MEMBERSHIPS.c.organization_id
                        == MEMBERSHIPS.c.organization_id,
                        DEPARTMENT_MEMBERSHIPS.c.membership_id
                        == MEMBERSHIPS.c.membership_id,
                        DEPARTMENT_MEMBERSHIPS.c.is_active.is_(True),
                    ),
                )
                .outerjoin(
                    DEPARTMENTS,
                    sa.and_(
                        DEPARTMENTS.c.organization_id
                        == DEPARTMENT_MEMBERSHIPS.c.organization_id,
                        DEPARTMENTS.c.department_id
                        == DEPARTMENT_MEMBERSHIPS.c.department_id,
                    ),
                )
            )
            .where(
                MEMBERSHIPS.c.organization_id == organization_id,
                MEMBERSHIPS.c.is_active.is_(True),
            )
            .group_by(
                MEMBERSHIPS.c.membership_id,
                USERS.c.display_name,
                MEMBERSHIPS.c.role,
            )
            .order_by(USERS.c.display_name, MEMBERSHIPS.c.membership_id)
        )
        try:
            with self._engine.connect() as connection:
                rows = connection.execute(statement).mappings().all()
        except SQLAlchemyError as error:
            raise OrganizationPersistenceError from error

        return tuple(
            MemberRoleView(
                membership_id=cast(str, row["membership_id"]),
                display_name=cast(str, row["display_name"]),
                departments=tuple(sorted(cast("list[str]", row["departments"] or []))),
                role=_role(row["role"]),
            )
            for row in rows
        )

    def change_role(
        self,
        state: MemberRoleState,
        *,
        organization_id: str,
        expected_current_role: MemberRole,
    ) -> bool:
        """기대한 현재 역할일 때만 바꾼다. 아니면 아무것도 쓰지 않는다.

        낙관적 잠금이다. 화면이 본 값을 조건에 담아 한 문장으로 확인하고 쓴다.
        읽고 나서 쓰면 그 사이에 다른 회장단이 같은 사람을 바꿀 수 있다.
        """
        statement = (
            sa.update(MEMBERSHIPS)
            .where(
                MEMBERSHIPS.c.organization_id == organization_id,
                MEMBERSHIPS.c.membership_id == state.membership_id,
                MEMBERSHIPS.c.is_active.is_(True),
                MEMBERSHIPS.c.role == expected_current_role.value,
            )
            .values(role=state.role.value)
        )
        try:
            with self._engine.begin() as connection:
                return connection.execute(statement).rowcount == 1
        except SQLAlchemyError as error:
            raise OrganizationPersistenceError from error


def _role(value: object) -> MemberRole:
    try:
        return MemberRole(cast(str, value))
    except ValueError as error:
        # 저장된 값이 계약의 직급이 아니면 화면이 그릴 수 있는 것이 없다.
        raise OrganizationPersistenceError from error
