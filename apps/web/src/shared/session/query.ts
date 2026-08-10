import { queryOptions } from "@tanstack/react-query";
import type { SessionViewer } from "@vada/api-client";

import { requestJson } from "../api/failure";

/**
 * 계약 CB-IDENTITY-001@R1. 특정 화면의 것이 아니라 앱 전체가 쓰는 교차 관심사다.
 *
 * 모양은 **계약에서 생성된다.** 여기 손으로 적으면 계약이 바뀌어도 이 파일은
 * 안 따라가고, 타입 검사를 통과한 채로 화면에 `undefined`가 뜬다.
 *
 * **역할 이름은 오지 않는다.** 서버가 판정 결과만 보낸다. 화면이 역할을 다시
 * 비교하면 같은 규칙이 파이썬과 타입스크립트 양쪽에 생기고, 언젠가 갈라진다.
 *
 * `capabilities`에는 조직 범위에서 전역으로 정해지는 판정만 담긴다. 행사별
 * 판정은 행사 응답이, 레코드별 판정은 그 레코드 응답이 들고 온다.
 */
export type { SessionViewer };
export type SessionCapabilities = SessionViewer["capabilities"];

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
