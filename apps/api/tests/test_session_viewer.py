"""전역 판정 규칙. 계약 DATA:session.viewer@R1과 권한 매트릭스가 기준이다.

여기 담기는 것은 **기본 직급과 부서만 보고 정해지는** 판정뿐이다. 행사별·
레코드별 판정은 각 리소스 응답이 들고 온다.
"""

from __future__ import annotations

import pytest

from vada_api.organization.roles import MemberRole
from vada_api.session.viewer import decide_global_capabilities


def _for(role: MemberRole, *, finance: bool = False):
    return decide_global_capabilities(role=role, is_finance_member=finance)


class TestFinance:
    """재정 권한은 직급이 아니라 부서가 답한다."""

    def test_only_finance_members_manage_finance(self) -> None:
        assert _for(MemberRole.MEMBER, finance=True).can_manage_finance
        assert not _for(MemberRole.MEMBER).can_manage_finance

    def test_president_alone_does_not_manage_finance(self) -> None:
        # 회장단이라도 재정부가 아니면 총예산을 편성하지 못한다.
        # 직급으로 재정을 판정하면 이 줄이 조용히 뒤집힌다.
        assert not _for(MemberRole.PRESIDENT).can_manage_finance

    def test_purchase_requests_come_from_finance_or_department_heads(self) -> None:
        assert _for(MemberRole.DEPARTMENT_HEAD).can_submit_purchase_request
        assert _for(MemberRole.MEMBER, finance=True).can_submit_purchase_request
        assert not _for(MemberRole.MEMBER).can_submit_purchase_request
        # 회장단은 직급만으로는 요청을 내지 못한다(권한 매트릭스 §전역).
        assert not _for(MemberRole.PRESIDENT).can_submit_purchase_request


class TestPresidentOnly:
    @pytest.mark.parametrize(
        "capability",
        ["can_complete_event", "can_edit_organization", "can_manage_student_roster"],
    )
    def test_president_only(self, capability: str) -> None:
        assert getattr(_for(MemberRole.PRESIDENT), capability)
        assert not getattr(_for(MemberRole.DEPARTMENT_HEAD), capability)
        assert not getattr(_for(MemberRole.MEMBER, finance=True), capability)


class TestShared:
    def test_inviting_members_is_president_or_department_head(self) -> None:
        assert _for(MemberRole.PRESIDENT).can_invite_organization_member
        assert _for(MemberRole.DEPARTMENT_HEAD).can_invite_organization_member
        assert not _for(MemberRole.MEMBER, finance=True).can_invite_organization_member

    def test_fee_roster_is_finance_or_president(self) -> None:
        assert _for(MemberRole.PRESIDENT).can_manage_student_fee_roster
        assert _for(MemberRole.MEMBER, finance=True).can_manage_student_fee_roster
        assert not _for(MemberRole.DEPARTMENT_HEAD).can_manage_student_fee_roster
