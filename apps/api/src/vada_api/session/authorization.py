"""자기 신원을 읽을 권한. 계약 AUTH:session.read_self@R1이 정한 판정만 담는다."""

from __future__ import annotations

from enum import StrEnum
from typing import ClassVar

from vada_api.identity.context import TrustedOrganizationOnlyContext


class SessionPermission(StrEnum):
    READ_SELF = "session.read_self"


class SessionActionForbiddenError(Exception):
    """세션 동작을 거부하는, 관계를 드러내지 않는 결과."""

    http_status: ClassVar[int] = 403
    code: ClassVar[str] = "SESSION_ACTION_FORBIDDEN"
    problem_type: ClassVar[str] = (
        "https://vada.example/problems/session-action-forbidden"
    )
    title: ClassVar[str] = "이 세션 동작을 수행할 권한이 없습니다."

    def __init__(self) -> None:
        super().__init__(self.title)


def is_session_action_allowed(
    permission: SessionPermission | str,
    *,
    context: TrustedOrganizationOnlyContext | None,
) -> bool:
    """읽을 수 있는 것은 **자기 것뿐이다.** 남의 신원을 부를 통로가 없다.

    계약의 조건은 활성 소속 하나다. 지금은 맥락을 세우는 쪽이 그것을 먼저
    확인하므로 여기서 거절될 일이 없지만, 조건이 계약에 적혀 있으면 코드에도
    적혀 있어야 한다. 맥락의 종류가 느슨해지는 날 이 줄이 살아난다.
    """
    if context is None:
        return False

    try:
        resolved = SessionPermission(permission)
    except ValueError:
        # 모르는 권한 키는 통과시키지 않는다. 오타가 권한 우회가 되면 안 된다.
        return False

    if resolved is SessionPermission.READ_SELF:
        return context.has_active_organization_membership

    return False


def require_session_permission(
    permission: SessionPermission | str,
    *,
    context: TrustedOrganizationOnlyContext | None,
) -> None:
    if not is_session_action_allowed(permission, context=context):
        raise SessionActionForbiddenError
