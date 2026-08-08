"""기본 역할 관리의 사용 사례.

HTTP와 영속성 사이에서 인가와 판정을 조정한다. 계약 CB-ORG-001@R1이 기준이다.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol

from vada_api.identity.context import TrustedOrganizationOnlyContext
from vada_api.identity.errors import ResourceNotFoundError
from vada_api.organization.authorization import (
    OrganizationPermission,
    require_organization_permission,
)
from vada_api.organization.roles import (
    MemberRole,
    MemberRoleState,
    RoleChangeCommand,
    decide_role_change,
)


class OrganizationPersistenceError(Exception):
    """조직 저장소를 지금 쓸 수 없다. 실패를 성공으로 꾸미지 않는다."""


class RoleChangeRaceError(Exception):
    """읽은 뒤 값이 바뀌어 쓰지 못했다. 덮어쓰지 않는다."""


@dataclass(frozen=True, slots=True)
class MemberRoleView:
    """화면이 그리는 구성원 한 줄. 이름과 부서는 표시 전용이다."""

    membership_id: str
    display_name: str
    departments: tuple[str, ...]
    role: MemberRole


class MemberRoleStore(Protocol):
    """구성원의 기본 직급을 조직 범위로 읽고 바꾼다."""

    def list_members(self, *, organization_id: str) -> tuple[MemberRoleView, ...]: ...

    def change_role(
        self,
        state: MemberRoleState,
        *,
        organization_id: str,
        expected_current_role: MemberRole,
    ) -> bool: ...


class MemberRoleService:
    """역할 목록 조회와 역할 변경을 조정한다."""

    def __init__(self, store: MemberRoleStore) -> None:
        self._store = store

    def list_member_roles(
        self, context: TrustedOrganizationOnlyContext
    ) -> tuple[MemberRoleView, ...]:
        members = self._store.list_members(organization_id=context.organization_id)
        self._require_president(context, members)
        return members

    def change_member_role(
        self,
        context: TrustedOrganizationOnlyContext,
        *,
        membership_id: str,
        command: RoleChangeCommand,
    ) -> tuple[MemberRoleView, ...]:
        members = self._store.list_members(organization_id=context.organization_id)
        self._require_president(context, members)

        if not any(member.membership_id == membership_id for member in members):
            # 다른 조직의 구성원도 여기로 온다. 없는 것과 못 보는 것을 같은 답으로
            # 돌려보내야 다른 조직에 그 사람이 있는지 떠볼 수 없다.
            raise ResourceNotFoundError

        # 조직 전체를 넘긴다. 마지막 회장단 보호가 전체 회장단 수를 세기 때문이다.
        decided = decide_role_change(
            tuple(
                MemberRoleState(membership_id=member.membership_id, role=member.role)
                for member in members
            ),
            command,
        )

        # 읽은 뒤 바뀌었을 수 있다. 저장소가 기대한 값을 다시 확인하고 쓴다.
        if not self._store.change_role(
            decided,
            organization_id=context.organization_id,
            expected_current_role=command.expected_current_role,
        ):
            raise RoleChangeRaceError

        return self._store.list_members(organization_id=context.organization_id)

    def _require_president(
        self,
        context: TrustedOrganizationOnlyContext,
        members: tuple[MemberRoleView, ...],
    ) -> None:
        actor = next(
            (
                member
                for member in members
                if member.membership_id == context.membership_id
            ),
            None,
        )
        require_organization_permission(
            OrganizationPermission.MANAGE_MEMBER_ROLES,
            context=context,
            actor_role=actor.role if actor is not None else None,
        )
