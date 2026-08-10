import type { SessionViewer } from "../shared/session/query";

/**
 * 계약 CB-IDENTITY-001@R1의 모양을 그대로 옮긴 화면용 예제다.
 * 값은 `apps/api/scripts/seed_local.py`의 재정부 구성원과 같게 둔다 —
 * 목으로 보는 화면과 실제 데이터베이스로 보는 화면이 달라지면 목이 거짓말이 된다.
 */
export const sessionViewerExample = {
  userId: "user-finance",
  displayName: "최유나",
  organizationId: "organization-vada",
  organizationName: "소프트웨어융합대학 학생회",
  capabilities: {
    canManageFinance: true,
    canSubmitPurchaseRequest: true,
    canCompleteEvent: false,
    canEditOrganization: false,
    canInviteOrganizationMember: false,
    canManageStudentRoster: false,
    canManageStudentFeeRoster: true,
  },
  // `satisfies`라 값이 계약 타입을 만족하는지 검사받으면서도 각 필드의 구체적인
  // 값 타입이 남는다. `: SessionViewer`로 적으면 계약에서 선택인 필드가 여기서도
  // `string | undefined`가 되어, 이 예제가 그 값을 확실히 갖는다는 사실을 잃는다.
} satisfies SessionViewer;
