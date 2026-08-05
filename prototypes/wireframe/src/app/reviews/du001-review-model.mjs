export const REVIEW_CONTEXT = Object.freeze({
  eventName: "2026 가을 축제",
  requesterName: "김바다",
  departmentName: "기획부",
});

export const REVIEW_REQUEST = Object.freeze({
  requestId: "request-001",
  title: "가을 축제 운영 물품",
  neededDate: "2026-09-15",
  purpose: "가을 축제 부스 운영",
  priority: "urgent",
  status: "review_pending",
  estimatedTotal: 390000,
  overBudget: false,
  items: [
    {
      itemId: "item-001",
      name: "명찰 케이스",
      category: "행사용품",
      budgetItem: "행사운영비",
      purchaseType: "general",
      quantity: 2,
      unit: "세트",
      estimatedUnitPrice: 15000,
      estimatedAmount: 30000,
      evidence: "상품 URL",
    },
    {
      itemId: "item-002",
      name: "행사 음향 운영",
      category: "용역",
      budgetItem: "행사운영비",
      purchaseType: "service",
      quantity: 1,
      unit: "건",
      estimatedUnitPrice: 360000,
      estimatedAmount: 360000,
      evidence: "업체 견적 메모",
    },
  ],
});

export const REVIEW_SCENARIOS = Object.freeze([
  {
    id: "happy-path",
    label: "정상 제출",
    summary: "다품목 요청을 제출하고 목록·상세에서 다시 확인합니다.",
  },
  {
    id: "restored-draft",
    label: "서버 초안 복원",
    summary: "같은 계정으로 돌아와 서버에 저장된 개인 초안을 이어서 작성합니다.",
  },
  {
    id: "validation-error",
    label: "입력 오류",
    summary: "필수 가격 근거가 없을 때 입력을 보존하고 오류 위치를 안내합니다.",
  },
  {
    id: "server-unavailable",
    label: "서버 장애",
    summary: "저장·제출 실패를 성공으로 표시하지 않고 재시도할 수 있게 합니다.",
  },
  {
    id: "forbidden",
    label: "권한 없음",
    summary: "작성 권한이 없으면 폼과 보호 데이터를 노출하지 않습니다.",
  },
]);

const scenarioIds = new Set(REVIEW_SCENARIOS.map(({ id }) => id));

export function createReviewState(scenarioId) {
  if (!scenarioIds.has(scenarioId)) throw new Error(`알 수 없는 검토 시나리오입니다: ${scenarioId}`);
  if (scenarioId === "forbidden") return { scenarioId, view: "forbidden", status: "forbidden" };
  return {
    scenarioId,
    view: "editor",
    status: scenarioId === "restored-draft" ? "draft-restored" : "ready",
  };
}

export function transitionReviewState(state, action) {
  if (state.view === "forbidden") return state;
  if (action === "reset") return createReviewState(state.scenarioId);
  if (action === "back-to-editor") return { ...state, view: "editor", status: "ready" };
  if (action === "back-to-list") return { ...state, view: "list", status: "submitted" };
  if (action === "open-detail" && state.view === "list") return { ...state, view: "detail", status: "loaded" };
  if (action === "refresh-detail" && state.view === "detail") return { ...state, status: "reloaded" };

  if (state.view !== "editor") return state;
  if (action === "save-draft") {
    if (state.scenarioId === "server-unavailable") return { ...state, status: "server-unavailable" };
    return { ...state, status: "draft-saved" };
  }
  if (action === "submit") {
    if (state.scenarioId === "validation-error") return { ...state, status: "validation-error" };
    if (state.scenarioId === "server-unavailable") return { ...state, status: "server-unavailable" };
    return { ...state, view: "list", status: "submitted" };
  }
  return state;
}
