"""조직 범위에서 전역으로 정해지는 판정. 계약 DATA:session.viewer@R1이 정한다.

저장소도 HTTP도 모른다.

**여기 담는 것은 기본 직급과 부서만 보고 정해지는 것뿐이다.** 행사별 판정은
그 행사에서의 맥락 역할에 달렸으므로 행사 조회 응답이 들고 오고, 레코드별
판정은 그 레코드 응답이 들고 온다. 여기 담으면 화면이 세션 하나로 전부
판단하려 들고, 그때 회수된 권한이 남는다.

**역할 이름을 화면에 내려보내지 않는다.** 내려보내면 같은 규칙이 파이썬과
타입스크립트 양쪽에 생기고, 언젠가 한쪽만 바뀐다.
"""

from __future__ import annotations

from dataclasses import dataclass

from vada_api.organization.roles import MemberRole


@dataclass(frozen=True, slots=True)
class GlobalCapabilities:
    can_manage_finance: bool
    can_submit_purchase_request: bool
    can_complete_event: bool
    can_edit_organization: bool
    can_invite_organization_member: bool
    can_manage_student_roster: bool
    can_manage_student_fee_roster: bool


def decide_global_capabilities(
    *, role: MemberRole, is_finance_member: bool
) -> GlobalCapabilities:
    """VADA_PERMISSION_MATRIX.md의 전역 판정 일곱을 한 번에 정한다.

    `is_finance_member`는 직급이 아니라 부서 소속이다. 재정부는 기본 직급에
    없다 — 회장단이라도 재정부가 아니면 총예산을 편성하지 못한다.
    """
    president = role is MemberRole.PRESIDENT
    department_head = role is MemberRole.DEPARTMENT_HEAD

    return GlobalCapabilities(
        # 총예산 편성, 구매 검토·승인·주문, 증빙 처리
        can_manage_finance=is_finance_member,
        # 구매 요청 작성·보완 재제출
        can_submit_purchase_request=is_finance_member or department_head,
        # 행사 최종 완료. 행사 맥락 역할은 보지 않는다 — `canEndEvent`와 다르다.
        can_complete_event=president,
        can_edit_organization=president,
        can_invite_organization_member=president or department_head,
        can_manage_student_roster=president,
        can_manage_student_fee_roster=is_finance_member or president,
    )
