import type {
  EventListItem,
  EventRequestStatus,
} from "../../../mocks/event-finance-fixtures";

/**
 * 와이어프레임의 처리 단계 보드는 네 칸이다. 계약이 정의한 상태는 검토
 * 단계까지이므로 뒤 두 칸은 채울 상태가 없다. 없는 상태를 만들지 않고
 * 칸은 그대로 두되 비어 있음을 알린다.
 */
export interface Stage {
  label: string;
  /** 계약에 이 단계를 채울 상태가 아직 없으면 false다. */
  contracted: boolean;
  statuses: EventRequestStatus[];
}

export const stages: Stage[] = [
  {
    label: "검토 필요",
    contracted: true,
    statuses: ["review_pending", "revision_requested"],
  },
  {
    label: "구매 필요",
    contracted: true,
    statuses: ["approved", "partially_approved"],
  },
  { label: "증빙 필요", contracted: false, statuses: [] },
  { label: "정산 완료", contracted: false, statuses: [] },
];

export function itemsInStage(items: EventListItem[], stage: Stage) {
  if (!stage.contracted) return [];
  return items.filter((item) => stage.statuses.includes(item.status));
}

const statusLabels: Record<EventRequestStatus, string> = {
  review_pending: "검토 대기",
  approved: "승인",
  partially_approved: "부분 승인",
  revision_requested: "보완 요청",
  rejected: "반려",
};

export function formatRequestStatus(status: EventRequestStatus) {
  return statusLabels[status] ?? status;
}

export function reviewPendingCount(items: EventListItem[]) {
  return items.filter((item) => item.status === "review_pending").length;
}
