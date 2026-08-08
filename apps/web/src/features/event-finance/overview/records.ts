import type { EventBoardItem } from "./query";

/**
 * 기록 · 구매 요청은 요청 단위 표다. 계약 CB-FIN-002@R1에는 요청 단위 조회가
 * 없고 품목 목록만 있으므로 여기서 묶어 만든다. 서버가 준 값만 쓰고 없는 값을
 * 지어내지 않는다 — 그래서 제목과 신청일이 없다.
 */
export interface RequestRecord {
  requestId: string;
  requesterName: string;
  requestDepartmentName: string;
  itemCount: number;
  estimatedTotal: number;
  needsAttention: number;
}

export function requestRecords(items: EventBoardItem[]): RequestRecord[] {
  const byRequest = new Map<string, RequestRecord>();

  for (const item of items) {
    const record = byRequest.get(item.requestId) ?? {
      requestId: item.requestId,
      requesterName: item.requesterName,
      requestDepartmentName: item.requestDepartmentName,
      itemCount: 0,
      estimatedTotal: 0,
      needsAttention: 0,
    };
    record.itemCount += 1;
    record.estimatedTotal += item.estimatedTotalPrice;
    if (item.progressState === "needs_attention") record.needsAttention += 1;
    byRequest.set(item.requestId, record);
  }

  // 서버가 준 순서를 유지한다. 클라이언트가 다시 정렬하면 서버의 정렬 규칙과
  // 어긋나고, 그 어긋남은 화면마다 다르게 나타난다.
  return [...byRequest.values()];
}

/**
 * 재정부가 지금 처리해야 하는 품목. `financeStage`가 있는 것이 그 판정 결과다.
 * 화면이 역할이나 상태를 다시 비교하지 않는다.
 */
export function financeQueue(items: EventBoardItem[]): EventBoardItem[] {
  return items.filter((item) => item.financeStage !== undefined);
}

/**
 * 응답에 `financeStage`가 하나라도 있으면 보는 사람이 재정부다. 계약이 그렇게
 * 정했다 — 필드의 존재 자체가 권한 판정 결과다.
 *
 * 처리 대기 품목이 하나도 없으면 재정부도 일반 구성원처럼 보인다. 그때는 처리
 * 단계와 기록이 어차피 비어 있어 잃는 정보가 없다. 세션 계약이 구현되면
 * (CB-IDENTITY-001) 이 추론을 걷어낸다.
 */
export function viewerIsFinance(items: EventBoardItem[]): boolean {
  return items.some((item) => item.financeStage !== undefined);
}

/** 같은 요청의 카드가 한 열에 2개 이상이면 스택으로 묶는다. */
export function stackByRequest(items: EventBoardItem[]) {
  const stacks = new Map<string, EventBoardItem[]>();
  for (const item of items) {
    stacks.set(item.requestId, [...(stacks.get(item.requestId) ?? []), item]);
  }
  return [...stacks.entries()].map(([requestId, stacked]) => ({
    requestId,
    items: stacked,
  }));
}
