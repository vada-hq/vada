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
