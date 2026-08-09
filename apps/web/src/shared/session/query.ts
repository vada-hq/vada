import { queryOptions } from "@tanstack/react-query";

import { requestJson } from "../api/failure";

/**
 * 계약 CB-IDENTITY-001@R1. 특정 화면의 것이 아니라 앱 전체가 쓰는 교차 관심사다.
 * 생성 클라이언트가 이 계약을 포함하면 여기 타입을 그것으로 교체한다.
 *
 * **역할 이름은 오지 않는다.** 서버가 판정 결과만 보낸다. 화면이 역할을 다시
 * 비교하면 같은 규칙이 파이썬과 타입스크립트 양쪽에 생기고, 언젠가 갈라진다.
 */
export interface SessionCapabilities {
  canManageFinance: boolean;
  canSubmitPurchaseRequest: boolean;
  canCompleteEvent: boolean;
  canEditOrganization: boolean;
  canInviteOrganizationMember: boolean;
  canManageStudentRoster: boolean;
  canManageStudentFeeRoster: boolean;
}

export interface SessionViewer {
  userId: string;
  /** 표시 전용. 이것으로 사람을 가리키지 않는다. */
  displayName: string;
  organizationId: string;
  organizationName: string;
  /**
   * 조직 범위에서 전역으로 정해지는 판정만 담긴다. 행사별 판정은 행사 응답이,
   * 레코드별 판정은 그 레코드 응답이 들고 온다.
   */
  capabilities: SessionCapabilities;
}

export function sessionViewerQueryKey() {
  return ["session", "viewer"] as const;
}

export function sessionViewerQueryOptions() {
  return queryOptions({
    queryKey: sessionViewerQueryKey(),
    // 오래 들고 있지 않는다. 신원은 거의 안 바뀌지만 권한은 자주 바뀌고,
    // 캐시된 판정에는 회수된 권한이 남는다. 서버가 행동마다 다시 판정하므로
    // 화면이 틀려도 안전하지만, 없는 버튼을 보여 주는 것은 그 자체로 결함이다.
    retry: false,
    queryFn: ({ signal }) =>
      requestJson<SessionViewer>("/session/viewer", { signal }),
  });
}
