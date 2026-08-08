from __future__ import annotations

import pytest

from vada_api.identity.authentication import CognitoPrincipal
from vada_api.identity.context import TrustedOrganizationOnlyContext
from vada_api.identity.errors import ResourceNotFoundError
from vada_api.organization.application import (
    MemberRoleService,
    MemberRoleView,
    RoleChangeRaceError,
)
from vada_api.organization.authorization import OrganizationActionForbiddenError
from vada_api.organization.roles import (
    LastPresidentProtectedError,
    MemberRole,
    MemberRoleState,
    RoleChangeCommand,
)

ORGANIZATION = "organization-a"


def organization_context(
    membership_id: str = "membership-president",
) -> TrustedOrganizationOnlyContext:
    return TrustedOrganizationOnlyContext(
        principal=CognitoPrincipal(
            issuer="https://cognito-idp.ap-northeast-2.amazonaws.com/pool-a",
            subject="subject-a",
        ),
        user_id="user-a",
        organization_id=ORGANIZATION,
        membership_id=membership_id,
    )


def member_view(
    membership_id: str, role: MemberRole, name: str = "구성원"
) -> MemberRoleView:
    return MemberRoleView(
        membership_id=membership_id,
        display_name=name,
        departments=("기획부",),
        role=role,
    )


class FakeStore:
    """조직 범위로 나뉜 구성원을 들고 있는 최소 저장소.

    다른 조직의 구성원을 일부러 함께 넣는다. 범위를 빼먹으면 응답에 섞여 나온다.
    """

    def __init__(self, *members: MemberRoleView, writes_succeed: bool = True) -> None:
        self.rows: dict[str, tuple[MemberRoleView, ...]] = {
            ORGANIZATION: members,
            "organization-b": (member_view("membership-other", MemberRole.PRESIDENT),),
        }
        self.writes_succeed = writes_succeed
        self.asked: list[str] = []
        self.written: list[tuple[str, MemberRole, MemberRole]] = []

    def list_members(self, *, organization_id: str) -> tuple[MemberRoleView, ...]:
        self.asked.append(organization_id)
        return self.rows.get(organization_id, ())

    def change_role_and_list(
        self,
        state: MemberRoleState,
        *,
        organization_id: str,
        expected_current_role: MemberRole,
    ) -> tuple[MemberRoleView, ...] | None:
        self.written.append((state.membership_id, expected_current_role, state.role))
        if not self.writes_succeed:
            return None
        self.rows[organization_id] = tuple(
            member_view(member.membership_id, state.role, member.display_name)
            if member.membership_id == state.membership_id
            else member
            for member in self.rows[organization_id]
        )
        return self.rows[organization_id]


def _service(
    *members: MemberRoleView, writes_succeed: bool = True
) -> MemberRoleService:
    return MemberRoleService(FakeStore(*members, writes_succeed=writes_succeed))


def _promote(membership_id: str = "membership-a") -> RoleChangeCommand:
    return RoleChangeCommand(
        membership_id=membership_id,
        role=MemberRole.DEPARTMENT_HEAD,
        expected_current_role=MemberRole.MEMBER,
    )


def test_the_president_sees_the_member_roles() -> None:
    service = _service(
        member_view("membership-president", MemberRole.PRESIDENT),
        member_view("membership-a", MemberRole.MEMBER),
    )

    members = service.list_member_roles(organization_context())

    assert [member.membership_id for member in members] == [
        "membership-president",
        "membership-a",
    ]


def test_a_department_head_cannot_see_the_member_roles() -> None:
    service = _service(member_view("membership-head", MemberRole.DEPARTMENT_HEAD))

    with pytest.raises(OrganizationActionForbiddenError):
        service.list_member_roles(organization_context("membership-head"))


def test_someone_outside_the_organization_is_refused() -> None:
    # 맥락의 membership_id가 이 조직 목록에 없으면 직급을 알 수 없다.
    service = _service(member_view("membership-president", MemberRole.PRESIDENT))

    with pytest.raises(OrganizationActionForbiddenError):
        service.list_member_roles(organization_context("membership-elsewhere"))


def test_reads_never_leave_the_caller_organization() -> None:
    store = FakeStore(member_view("membership-president", MemberRole.PRESIDENT))
    service = MemberRoleService(store)

    service.list_member_roles(organization_context())

    assert set(store.asked) == {ORGANIZATION}


def test_the_president_promotes_amember_view() -> None:
    service = _service(
        member_view("membership-president", MemberRole.PRESIDENT),
        member_view("membership-a", MemberRole.MEMBER),
    )

    members = service.change_member_role(
        organization_context(), membership_id="membership-a", command=_promote()
    )

    changed = next(m for m in members if m.membership_id == "membership-a")
    assert changed.role is MemberRole.DEPARTMENT_HEAD


def test_an_unknown_membership_is_not_found_rather_than_created() -> None:
    service = _service(member_view("membership-president", MemberRole.PRESIDENT))

    with pytest.raises(ResourceNotFoundError):
        service.change_member_role(
            organization_context(),
            membership_id="membership-elsewhere",
            command=_promote("membership-elsewhere"),
        )


def test_the_last_president_is_protected_across_the_whole_organization() -> None:
    # 조직 전체를 넘겨야 남은 회장단 수를 셀 수 있다.
    service = _service(
        member_view("membership-president", MemberRole.PRESIDENT),
        member_view("membership-a", MemberRole.MEMBER),
    )

    with pytest.raises(LastPresidentProtectedError):
        service.change_member_role(
            organization_context(),
            membership_id="membership-president",
            command=RoleChangeCommand(
                membership_id="membership-president",
                role=MemberRole.MEMBER,
                expected_current_role=MemberRole.PRESIDENT,
            ),
        )


def test_a_lost_race_does_not_overwrite() -> None:
    # 읽은 뒤 값이 바뀌면 저장소가 거절한다. 덮어쓰지 않는다.
    service = _service(
        member_view("membership-president", MemberRole.PRESIDENT),
        member_view("membership-a", MemberRole.MEMBER),
        writes_succeed=False,
    )

    with pytest.raises(RoleChangeRaceError):
        service.change_member_role(
            organization_context(), membership_id="membership-a", command=_promote()
        )


def test_a_change_reads_the_member_list_once() -> None:
    """명단은 권한을 판정하려고 한 번 읽는다. 바뀐 명단은 쓰기가 함께 돌려준다.

    쓰고 나서 다시 읽으면 왕복이 하나 더 들고, 그 사이 다른 회장단이 쓰면
    돌려주는 명단이 내가 쓴 결과가 아니게 된다.
    """
    store = FakeStore(
        member_view("membership-president", MemberRole.PRESIDENT),
        member_view("membership-a", MemberRole.MEMBER),
    )

    MemberRoleService(store).change_member_role(
        organization_context(), membership_id="membership-a", command=_promote()
    )

    assert store.asked == [ORGANIZATION]


def test_the_write_carries_the_expected_current_role() -> None:
    # 낙관적 잠금이다. 저장소가 기대한 값을 다시 확인하고 쓴다.
    store = FakeStore(
        member_view("membership-president", MemberRole.PRESIDENT),
        member_view("membership-a", MemberRole.MEMBER),
    )

    MemberRoleService(store).change_member_role(
        organization_context(), membership_id="membership-a", command=_promote()
    )

    assert store.written == [
        ("membership-a", MemberRole.MEMBER, MemberRole.DEPARTMENT_HEAD)
    ]
