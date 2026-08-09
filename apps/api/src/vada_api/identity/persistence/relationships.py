from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass
from decimal import Decimal
from typing import cast

import sqlalchemy as sa
from sqlalchemy import Engine

from vada_api.identity.authentication import CognitoPrincipal
from vada_api.identity.context import (
    DepartmentRelationshipCandidate,
    OrganizationContextCandidate,
    SoleOrganizationCandidate,
)
from vada_api.identity.persistence.schema import (
    cognito_identities,
    department_memberships,
    event_finance_contexts,
    organization_departments,
    organization_events,
    organization_finance_memberships,
    organization_memberships,
    vada_users,
)


@dataclass(frozen=True, slots=True)
class PurchaseRequestRelationshipContext:
    event_name: str
    requester_name: str
    request_department_id: str
    request_department_name: str
    available_budget: Decimal
    department_head_of: frozenset[str]
    is_finance_member: bool


@dataclass(frozen=True, slots=True)
class RelationshipDisplayNames:
    event_name: str
    requester_name: str


class PostgreSQLIdentityOrganizationRepository:
    """Read trusted identity and organization relationships from PostgreSQL."""

    def __init__(self, engine: Engine) -> None:
        self._engine = engine

    def find_internal_user_id(self, principal: CognitoPrincipal) -> str | None:
        with self._engine.connect() as connection:
            return connection.scalar(
                sa.select(cognito_identities.c.user_id).where(
                    cognito_identities.c.issuer == principal.issuer,
                    cognito_identities.c.subject == principal.subject,
                )
            )

    def find_own_display_name(self, principal: CognitoPrincipal) -> str | None:
        """검증된 주체 자신의 표시 이름. 없으면 `None`.

        조직 범위가 없는 이유는 조직 데이터가 아니기 때문이다. 부르는 사람이
        자기 이름을 묻는 것이고, 그 사람이 누구인지는 게이트웨이가 이미 검증했다.

        `None`은 "VADA에 아직 등록되지 않은 신원"이라는 뜻이다. 오류가 아니다 —
        Cognito에는 있는데 이 조직의 사람으로 초대된 적이 없는 상태다.
        """
        statement = (
            sa.select(vada_users.c.display_name)
            .select_from(
                cognito_identities.join(
                    vada_users,
                    vada_users.c.user_id == cognito_identities.c.user_id,
                )
            )
            .where(
                cognito_identities.c.issuer == principal.issuer,
                cognito_identities.c.subject == principal.subject,
            )
        )
        with self._engine.connect() as connection:
            return connection.scalar(statement)

    def find_sole_organization_context(
        self, principal: CognitoPrincipal
    ) -> SoleOrganizationCandidate | None:
        """검증된 주체에서 조직 소속을 한 번에 읽는다.

        계약이 조직 화면의 경로에 조직 식별자를 두지 않았으므로 서버가 유도한다.
        활성 소속이 정확히 하나일 때만 답한다. 둘 이상이면 어느 학생회를 말하는지
        서버가 알 수 없고, 그때 아무거나 고르면 다른 조직의 명단을 보여준다.

        바깥 조인을 쓴다. 신원은 있는데 소속이 없는 경우와 신원 자체가 없는 경우를
        한 번의 왕복으로 가르기 위해서다. 안쪽 조인이면 둘 다 빈 결과라 401과 404를
        구분할 수 없고, 구분하려면 조회가 하나 더 는다.
        """
        statement = (
            sa.select(
                cognito_identities.c.user_id,
                organization_memberships.c.organization_id,
                organization_memberships.c.membership_id,
            )
            .select_from(
                cognito_identities.outerjoin(
                    organization_memberships,
                    sa.and_(
                        organization_memberships.c.user_id
                        == cognito_identities.c.user_id,
                        organization_memberships.c.is_active.is_(True),
                    ),
                )
            )
            .where(
                cognito_identities.c.issuer == principal.issuer,
                cognito_identities.c.subject == principal.subject,
            )
            .limit(2)
        )
        with self._engine.connect() as connection:
            rows = connection.execute(statement).mappings().all()

        if not rows:
            return None
        if len(rows) > 1:
            # 활성 소속이 둘 이상이다. 어느 학생회인지 서버가 정할 수 없다.
            return SoleOrganizationCandidate(
                user_id=cast(str, rows[0]["user_id"]),
                organization_id=None,
                membership_id=None,
            )

        row = rows[0]
        return SoleOrganizationCandidate(
            user_id=cast(str, row["user_id"]),
            organization_id=cast("str | None", row["organization_id"]),
            membership_id=cast("str | None", row["membership_id"]),
        )

    def find_active_organization_id_for_event(
        self, *, user_id: str, event_id: str
    ) -> str | None:
        statement = (
            sa.select(organization_memberships.c.organization_id)
            .select_from(
                organization_memberships.join(
                    organization_events,
                    organization_events.c.organization_id
                    == organization_memberships.c.organization_id,
                )
            )
            .where(
                organization_memberships.c.user_id == user_id,
                organization_memberships.c.is_active.is_(True),
                organization_events.c.event_id == event_id,
            )
            .distinct()
            .limit(2)
        )
        with self._engine.connect() as connection:
            organization_ids = tuple(connection.scalars(statement))
        return organization_ids[0] if len(organization_ids) == 1 else None

    def find_organization_context(
        self,
        *,
        user_id: str,
        organization_id: str,
        event_id: str,
    ) -> OrganizationContextCandidate | None:
        relationship_join = organization_memberships.join(
            organization_events,
            sa.and_(
                organization_events.c.organization_id
                == organization_memberships.c.organization_id,
                organization_events.c.event_id == event_id,
            ),
        ).outerjoin(
            department_memberships,
            sa.and_(
                department_memberships.c.organization_id
                == organization_memberships.c.organization_id,
                department_memberships.c.membership_id
                == organization_memberships.c.membership_id,
                department_memberships.c.user_id == organization_memberships.c.user_id,
            ),
        )
        statement = (
            sa.select(
                organization_memberships.c.user_id,
                organization_memberships.c.organization_id,
                organization_memberships.c.membership_id,
                organization_memberships.c.is_active.label("membership_is_active"),
                organization_events.c.event_id,
                organization_events.c.organization_id.label("event_organization_id"),
                department_memberships.c.relationship_id,
                department_memberships.c.department_id,
                department_memberships.c.is_active.label(
                    "department_membership_is_active"
                ),
            )
            .select_from(relationship_join)
            .where(
                organization_memberships.c.user_id == user_id,
                organization_memberships.c.organization_id == organization_id,
                organization_events.c.organization_id == organization_id,
                organization_events.c.event_id == event_id,
            )
            .order_by(department_memberships.c.relationship_id)
        )
        with self._engine.connect() as connection:
            rows = connection.execute(statement).mappings().all()
        if not rows:
            return None

        first = cast(Mapping[str, object], rows[0])
        relationships = tuple(
            DepartmentRelationshipCandidate(
                relationship_id=cast(str, row["relationship_id"]),
                user_id=cast(str, row["user_id"]),
                membership_id=cast(str, row["membership_id"]),
                organization_id=cast(str, row["organization_id"]),
                department_id=cast(str, row["department_id"]),
                is_active=cast(bool, row["department_membership_is_active"]),
            )
            for row in rows
            if row["relationship_id"] is not None
        )
        return OrganizationContextCandidate(
            user_id=cast(str, first["user_id"]),
            organization_id=cast(str, first["organization_id"]),
            membership_id=cast(str, first["membership_id"]),
            membership_is_active=cast(bool, first["membership_is_active"]),
            event_id=cast(str, first["event_id"]),
            event_organization_id=cast(str, first["event_organization_id"]),
            department_relationships=relationships,
        )

    def find_purchase_request_context(
        self,
        *,
        user_id: str,
        organization_id: str,
        membership_id: str,
        event_id: str,
    ) -> PurchaseRequestRelationshipContext | None:
        statement = (
            sa.select(
                organization_events.c.name.label("event_name"),
                vada_users.c.display_name.label("requester_name"),
                department_memberships.c.department_id,
                organization_departments.c.name.label("department_name"),
                department_memberships.c.is_department_head,
                event_finance_contexts.c.available_budget,
            )
            .select_from(
                organization_memberships.join(
                    vada_users,
                    vada_users.c.user_id == organization_memberships.c.user_id,
                )
                .join(
                    organization_events,
                    organization_events.c.organization_id
                    == organization_memberships.c.organization_id,
                )
                .join(
                    event_finance_contexts,
                    sa.and_(
                        event_finance_contexts.c.organization_id
                        == organization_events.c.organization_id,
                        event_finance_contexts.c.event_id
                        == organization_events.c.event_id,
                    ),
                )
                .join(
                    department_memberships,
                    sa.and_(
                        department_memberships.c.organization_id
                        == organization_memberships.c.organization_id,
                        department_memberships.c.membership_id
                        == organization_memberships.c.membership_id,
                        department_memberships.c.user_id
                        == organization_memberships.c.user_id,
                    ),
                )
                .join(
                    organization_departments,
                    sa.and_(
                        organization_departments.c.organization_id
                        == department_memberships.c.organization_id,
                        organization_departments.c.department_id
                        == department_memberships.c.department_id,
                    ),
                )
            )
            .where(
                organization_memberships.c.user_id == user_id,
                organization_memberships.c.organization_id == organization_id,
                organization_memberships.c.membership_id == membership_id,
                organization_memberships.c.is_active.is_(True),
                organization_events.c.organization_id == organization_id,
                organization_events.c.event_id == event_id,
                department_memberships.c.organization_id == organization_id,
                department_memberships.c.is_active.is_(True),
            )
            .order_by(department_memberships.c.department_id)
        )
        with self._engine.connect() as connection:
            rows = connection.execute(statement).mappings().all()
            is_finance_member = (
                connection.scalar(
                    sa.select(organization_finance_memberships.c.relationship_id)
                    .where(
                        organization_finance_memberships.c.organization_id
                        == organization_id,
                        organization_finance_memberships.c.membership_id
                        == membership_id,
                        organization_finance_memberships.c.user_id == user_id,
                        organization_finance_memberships.c.is_active.is_(True),
                    )
                    .limit(1)
                )
                is not None
            )
        if len(rows) != 1:
            return None

        row = cast(Mapping[str, object], rows[0])
        department_id = cast(str, row["department_id"])
        return PurchaseRequestRelationshipContext(
            event_name=cast(str, row["event_name"]),
            requester_name=cast(str, row["requester_name"]),
            request_department_id=department_id,
            request_department_name=cast(str, row["department_name"]),
            available_budget=cast(Decimal, row["available_budget"]),
            department_head_of=(
                frozenset({department_id})
                if cast(bool, row["is_department_head"])
                else frozenset()
            ),
            is_finance_member=is_finance_member,
        )

    def find_display_names(
        self, *, organization_id: str, event_id: str, requester_user_id: str
    ) -> RelationshipDisplayNames | None:
        statement = (
            sa.select(
                organization_events.c.name.label("event_name"),
                vada_users.c.display_name.label("requester_name"),
            )
            .select_from(
                organization_memberships.join(
                    vada_users,
                    vada_users.c.user_id == organization_memberships.c.user_id,
                ).join(
                    organization_events,
                    organization_events.c.organization_id
                    == organization_memberships.c.organization_id,
                )
            )
            .where(
                organization_memberships.c.organization_id == organization_id,
                organization_memberships.c.user_id == requester_user_id,
                organization_events.c.organization_id == organization_id,
                organization_events.c.event_id == event_id,
            )
        )
        with self._engine.connect() as connection:
            row = connection.execute(statement).mappings().one_or_none()
        if row is None:
            return None
        return RelationshipDisplayNames(
            event_name=cast(str, row["event_name"]),
            requester_name=cast(str, row["requester_name"]),
        )

    def find_member_display_names(
        self, *, organization_id: str, user_ids: frozenset[str]
    ) -> dict[str, str]:
        """조직 구성원의 표시 이름을 한 번에 읽는다.

        처리 기록이 사건마다 처리자 이름을 보여야 하는데, 사건 수만큼 조회하면
        같은 사람을 여러 번 읽는다. 조직 범위 안에서 한 번에 가져온다.
        """

        if not user_ids:
            return {}
        statement = (
            sa.select(
                organization_memberships.c.user_id,
                vada_users.c.display_name,
            )
            .select_from(
                organization_memberships.join(
                    vada_users,
                    vada_users.c.user_id == organization_memberships.c.user_id,
                )
            )
            .where(
                organization_memberships.c.organization_id == organization_id,
                organization_memberships.c.user_id.in_(sorted(user_ids)),
            )
        )
        with self._engine.connect() as connection:
            rows = connection.execute(statement).mappings().all()
        return {
            cast(str, row["user_id"]): cast(str, row["display_name"]) for row in rows
        }

    def find_department_names(
        self, *, organization_id: str, department_ids: frozenset[str]
    ) -> dict[str, str]:
        """조직 부서의 표시 이름을 한 번에 읽는다.

        행사 재정의 품목 목록이 요청 부서 이름을 보여야 하는데, 품목 수만큼
        조회하면 같은 부서를 여러 번 읽는다. 조직 범위 안에서 한 번에 가져온다.
        """

        if not department_ids:
            return {}
        statement = sa.select(
            organization_departments.c.department_id,
            organization_departments.c.name,
        ).where(
            organization_departments.c.organization_id == organization_id,
            organization_departments.c.department_id.in_(sorted(department_ids)),
        )
        with self._engine.connect() as connection:
            rows = connection.execute(statement).mappings().all()
        return {cast(str, row["department_id"]): cast(str, row["name"]) for row in rows}
