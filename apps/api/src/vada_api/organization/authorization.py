"""기본 역할 관리 권한.

계약 AUTH:organization.manage_member_roles@R1이 정한 판정만 담는다.
"""

from __future__ import annotations

from enum import StrEnum
from typing import ClassVar

from vada_api.identity.context import TrustedOrganizationOnlyContext
from vada_api.organization.roles import MemberRole


class OrganizationPermission(StrEnum):
    """조직 관리 동작 키. 계약 CB-ORG-001@R1이 정한다."""

    MANAGE_MEMBER_ROLES = "organization.manage_member_roles"


class OrganizationActionForbiddenError(Exception):
    """조직 동작을 거부하는, 관계를 드러내지 않는 결과."""

    http_status: ClassVar[int] = 403
    code: ClassVar[str] = "ORGANIZATION_ACTION_FORBIDDEN"
    problem_type: ClassVar[str] = (
        "https://vada.example/problems/organization-action-forbidden"
    )
    title: ClassVar[str] = "이 조직 동작을 수행할 권한이 없습니다."

    def __init__(self) -> None:
        super().__init__(self.title)


def is_organization_action_allowed(
    permission: OrganizationPermission | str,
    *,
    context: TrustedOrganizationOnlyContext | None,
    actor_role: MemberRole | None,
) -> bool:
    """승인된 동작 하나를 판정한다. 모르는 사실은 닫는 쪽으로 답한다.

    actor_role은 서버가 저장소에서 읽은 그 조직에서의 기본 직급이다. 화면이
    보내온 값이 아니다.
    """
    if context is None or actor_role is None:
        return False

    try:
        resolved = OrganizationPermission(permission)
    except ValueError:
        # 모르는 권한 키는 통과시키지 않는다. 오타가 권한 우회가 되면 안 된다.
        return False

    if not context.has_active_organization_membership:
        return False

    if resolved is OrganizationPermission.MANAGE_MEMBER_ROLES:
        # 기본 역할 변경은 회장단만 한다(VADA_PERMISSION_MATRIX.md ORG-04B).
        # 부서장은 자기 부서를 운영하지만 남의 직급을 바꾸지는 못한다.
        return actor_role is MemberRole.PRESIDENT

    return False


def require_organization_permission(
    permission: OrganizationPermission | str,
    *,
    context: TrustedOrganizationOnlyContext | None,
    actor_role: MemberRole | None,
) -> None:
    """거부할 때 어떤 관계가 모자란지 알리지 않는다."""

    if not is_organization_action_allowed(
        permission, context=context, actor_role=actor_role
    ):
        raise OrganizationActionForbiddenError
