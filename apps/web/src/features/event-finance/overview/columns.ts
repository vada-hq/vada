import type { EventBoardItem, ItemProgressState } from "./query";

/**
 * 와이어프레임 EVT-FIN-01의 품목 현황 8열을 그대로 쓴다.
 *
 * 뒤 6열은 채울 상태의 원본이 아직 없다. 열을 지우면 이 화면이 무엇으로 자랄지
 * 알 수 없게 되므로 자리는 두고 미도입임을 말한다. 0건으로 표시하지 않는다 —
 * "아직 없다"와 "그 단계가 없다"는 사용자에게 다른 뜻이다.
 */
export interface BoardColumn {
  label: string;
  description: string;
  /** 계약에 이 열을 채울 상태가 있으면 true. 없으면 미도입으로 말한다. */
  contracted: boolean;
  states: ItemProgressState[];
}

export const boardColumns: BoardColumn[] = [
  {
    label: "확인 필요",
    description: "보완·반려",
    contracted: true,
    // 반려도 여기다. 종결이지만 요청자가 결과를 확인해야 한다.
    states: ["needs_attention", "rejected"],
  },
  {
    label: "검토 중",
    description: "재정부 검토",
    contracted: true,
    states: ["under_review"],
  },
  {
    label: "구매 준비",
    description: "승인 후 주문 준비",
    contracted: false,
    states: [],
  },
  { label: "주문 완료", description: "주문·발주 완료", contracted: false, states: [] },
  {
    label: "진행 중",
    description: "배송·수령 또는 대여·용역 이행",
    contracted: false,
    states: [],
  },
  {
    label: "수령·이행 완료",
    description: "실제 완료 확인",
    contracted: false,
    states: [],
  },
  { label: "정산 중", description: "증빙·실제 금액 확인", contracted: false, states: [] },
  { label: "처리 완료", description: "실제 지출 반영", contracted: false, states: [] },
];

export function itemsInColumn(
  items: EventBoardItem[],
  column: BoardColumn,
): EventBoardItem[] {
  if (!column.contracted) return [];
  return items.filter((item) => column.states.includes(item.progressState));
}

/**
 * 배정이 0원이면 사용 가능액이 음수여도 예산 초과가 아니다. 배정을 만드는 흐름이
 * 아직 없다는 뜻이다. 그 둘을 같은 색으로 칠하면 사용자가 없는 문제를 쫓는다.
 */
export function budgetTone(summary: {
  allocatedTotal: number;
  availableTotal: number;
}): "unallocated" | "over" | "normal" {
  if (summary.allocatedTotal === 0) return "unallocated";
  return summary.availableTotal < 0 ? "over" : "normal";
}
