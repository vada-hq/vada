from __future__ import annotations

import pytest

from vada_api.organization.roles import (
    LastPresidentProtectedError,
    MemberRole,
    MemberRoleState,
    RoleChangeCommand,
    RoleChangeConflictError,
    RoleUnchangedError,
    decide_role_change,
)


def _member(membership_id: str, role: MemberRole) -> MemberRoleState:
    return MemberRoleState(membership_id=membership_id, role=role)


def _organization(*members: MemberRoleState) -> tuple[MemberRoleState, ...]:
    return members


def test_promotes_a_member_to_department_head() -> None:
    members = _organization(
        _member("m-1", MemberRole.PRESIDENT),
        _member("m-2", MemberRole.MEMBER),
    )

    decided = decide_role_change(
        members,
        RoleChangeCommand(
            membership_id="m-2",
            role=MemberRole.DEPARTMENT_HEAD,
            expected_current_role=MemberRole.MEMBER,
        ),
    )

    assert decided.role is MemberRole.DEPARTMENT_HEAD
    assert decided.membership_id == "m-2"


def test_rejects_a_change_that_would_remove_the_last_president() -> None:
    members = _organization(
        _member("m-1", MemberRole.PRESIDENT),
        _member("m-2", MemberRole.MEMBER),
    )

    with pytest.raises(LastPresidentProtectedError):
        decide_role_change(
            members,
            RoleChangeCommand(
                membership_id="m-1",
                role=MemberRole.MEMBER,
                expected_current_role=MemberRole.PRESIDENT,
            ),
        )


def test_allows_demoting_a_president_when_another_president_remains() -> None:
    members = _organization(
        _member("m-1", MemberRole.PRESIDENT),
        _member("m-2", MemberRole.PRESIDENT),
    )

    decided = decide_role_change(
        members,
        RoleChangeCommand(
            membership_id="m-1",
            role=MemberRole.MEMBER,
            expected_current_role=MemberRole.PRESIDENT,
        ),
    )

    assert decided.role is MemberRole.MEMBER


def test_rejects_a_change_to_the_role_the_member_already_has() -> None:
    members = _organization(_member("m-1", MemberRole.PRESIDENT))

    with pytest.raises(RoleUnchangedError):
        decide_role_change(
            members,
            RoleChangeCommand(
                membership_id="m-1",
                role=MemberRole.PRESIDENT,
                expected_current_role=MemberRole.PRESIDENT,
            ),
        )


def test_rejects_a_change_when_the_seen_role_is_stale() -> None:
    members = _organization(
        _member("m-1", MemberRole.PRESIDENT),
        _member("m-2", MemberRole.DEPARTMENT_HEAD),
    )

    with pytest.raises(RoleChangeConflictError):
        decide_role_change(
            members,
            RoleChangeCommand(
                membership_id="m-2",
                role=MemberRole.PRESIDENT,
                expected_current_role=MemberRole.MEMBER,
            ),
        )


def test_reports_an_unknown_member_as_missing_rather_than_conflicting() -> None:
    members = _organization(_member("m-1", MemberRole.PRESIDENT))

    with pytest.raises(KeyError):
        decide_role_change(
            members,
            RoleChangeCommand(
                membership_id="m-9",
                role=MemberRole.MEMBER,
                expected_current_role=MemberRole.MEMBER,
            ),
        )


def test_promoting_the_last_president_to_president_is_still_unchanged() -> None:
    # 마지막 회장단 보호보다 "바꿀 것이 없다"가 먼저다. 회장단을 회장단으로 바꾸는
    # 요청은 회장단 수를 줄이지 않으므로 보호 규칙에 걸릴 이유가 없다.
    members = _organization(_member("m-1", MemberRole.PRESIDENT))

    with pytest.raises(RoleUnchangedError):
        decide_role_change(
            members,
            RoleChangeCommand(
                membership_id="m-1",
                role=MemberRole.PRESIDENT,
                expected_current_role=MemberRole.PRESIDENT,
            ),
        )
