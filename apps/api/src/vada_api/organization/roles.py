"""기본 역할 변경 규칙.

저장소도 HTTP도 모른다. 계약 CB-ORG-001@R1이 정한 판정만 담는다.
"""

from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass
from enum import StrEnum


class MemberRole(StrEnum):
    """VADA_PERMISSION_MATRIX.md의 기본 직급 셋.

    재정부는 여기 없다. 재정부는 직급이 아니라 부서 조건이므로 부서 소속이 답한다.
    """

    PRESIDENT = "president"
    DEPARTMENT_HEAD = "department_head"
    MEMBER = "member"


ROLE_LABELS: dict[MemberRole, str] = {
    MemberRole.PRESIDENT: "회장단",
    MemberRole.DEPARTMENT_HEAD: "부서장",
    MemberRole.MEMBER: "부원",
}


class RoleChangeError(Exception):
    """기본 역할 변경을 거부하는 이유의 공통 조상."""


class RoleChangeConflictError(RoleChangeError):
    """화면이 본 현재 역할이 저장된 값과 다르다."""


class RoleUnchangedError(RoleChangeError):
    """바꾸려는 역할이 현재 역할과 같아 바꿀 것이 없다."""


class LastPresidentProtectedError(RoleChangeError):
    """조직의 마지막 회장단을 다른 역할로 바꾸려 한다."""


@dataclass(frozen=True, slots=True)
class MemberRoleState:
    membership_id: str
    role: MemberRole


@dataclass(frozen=True, slots=True)
class RoleChangeCommand:
    membership_id: str
    role: MemberRole
    expected_current_role: MemberRole


def decide_role_change(
    members: Iterable[MemberRoleState],
    command: RoleChangeCommand,
) -> MemberRoleState:
    """바뀐 뒤의 구성원 상태를 돌려주거나 거부한다.

    members는 한 조직의 구성원 전부여야 한다. 마지막 회장단 보호가 조직 전체의
    회장단 수를 세기 때문이다. 일부만 넘기면 남은 회장단을 못 보고 잘못 막는다.
    """
    current = {member.membership_id: member for member in members}
    target = current[command.membership_id]

    if target.role is not command.expected_current_role:
        raise RoleChangeConflictError(
            f"{command.membership_id}: 그 사이 역할이 바뀌었습니다. 다시 읽어야 합니다."
        )

    if command.role is target.role:
        # 바꿀 것이 없다를 마지막 회장단 보호보다 먼저 본다. 회장단을 회장단으로
        # 바꾸는 요청은 회장단 수를 줄이지 않으므로 보호 규칙에 걸릴 이유가 없다.
        raise RoleUnchangedError(
            f"{command.membership_id}: 이미 {ROLE_LABELS[command.role]}입니다."
        )

    if _removes_last_president(current.values(), target=target, next_role=command.role):
        raise LastPresidentProtectedError(
            "마지막 회장단은 다른 역할로 바꿀 수 없습니다. "
            "먼저 다른 구성원에게 회장단을 부여하세요."
        )

    return MemberRoleState(membership_id=target.membership_id, role=command.role)


def _removes_last_president(
    members: Iterable[MemberRoleState],
    *,
    target: MemberRoleState,
    next_role: MemberRole,
) -> bool:
    if target.role is not MemberRole.PRESIDENT or next_role is MemberRole.PRESIDENT:
        return False
    presidents = sum(1 for member in members if member.role is MemberRole.PRESIDENT)
    return presidents <= 1
