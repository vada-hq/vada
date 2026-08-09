from __future__ import annotations

from typing import cast

import sqlalchemy as sa
from sqlalchemy import Engine
from sqlalchemy.exc import SQLAlchemyError

from vada_api.identity.persistence.schema import (
    organization_finance_memberships,
    organization_memberships,
    organizations,
    vada_users,
)
from vada_api.organization.roles import MemberRole
from vada_api.session.application import SessionPersistenceError, ViewerFacts


class PostgreSQLViewerStore:
    """전역 판정에 필요한 사실을 조직 범위 안에서 한 번에 읽는다.

    한 번인 이유는 왕복 때문이다. 이 조회는 **모든 화면이 켜질 때마다** 돈다.
    이름·조직·직급·재정부 여부를 따로 읽으면 화면 하나가 열릴 때 왕복이 넷이다.
    """

    def __init__(self, engine: Engine) -> None:
        self._engine = engine

    def find_viewer_facts(
        self, *, user_id: str, organization_id: str, membership_id: str
    ) -> ViewerFacts | None:
        # 재정부는 기본 직급이 아니라 부서 소속이다. 소속 여부만 필요하므로
        # 조인이 아니라 존재 여부로 묻는다 — 조인하면 부서가 여럿일 때 행이 는다.
        is_finance_member = (
            sa.select(sa.literal(1))
            .where(
                organization_finance_memberships.c.organization_id == organization_id,
                organization_finance_memberships.c.membership_id == membership_id,
                organization_finance_memberships.c.user_id == user_id,
                organization_finance_memberships.c.is_active.is_(True),
            )
            .exists()
        )

        statement = (
            sa.select(
                vada_users.c.display_name,
                organizations.c.name.label("organization_name"),
                organization_memberships.c.role,
                is_finance_member.label("is_finance_member"),
            )
            .select_from(
                organization_memberships.join(
                    vada_users,
                    vada_users.c.user_id == organization_memberships.c.user_id,
                ).join(
                    organizations,
                    organizations.c.organization_id
                    == organization_memberships.c.organization_id,
                )
            )
            # 조직을 선두 조건으로 둔다. 구성원 식별자만으로 읽으면 다른 조직의
            # 사람을 읽을 수 있다.
            .where(
                organization_memberships.c.organization_id == organization_id,
                organization_memberships.c.user_id == user_id,
                organization_memberships.c.membership_id == membership_id,
                organization_memberships.c.is_active.is_(True),
            )
        )

        try:
            with self._engine.connect() as connection:
                row = connection.execute(statement).mappings().one_or_none()
        except SQLAlchemyError as error:
            raise SessionPersistenceError from error

        if row is None:
            return None

        return ViewerFacts(
            display_name=cast(str, row["display_name"]),
            organization_name=cast(str, row["organization_name"]),
            role=_role(row["role"]),
            is_finance_member=cast(bool, row["is_finance_member"]),
        )


def _role(value: object) -> MemberRole:
    """저장된 직급 문자열. 모르는 값은 가장 좁은 쪽으로 읽는다.

    마이그레이션 도중이나 손으로 넣은 값이 있을 수 있다. 그때 예외를 던지면
    화면이 아예 안 열리고, 넓은 쪽으로 읽으면 없는 권한이 생긴다.
    """
    try:
        return MemberRole(value)
    except ValueError:
        return MemberRole.MEMBER
