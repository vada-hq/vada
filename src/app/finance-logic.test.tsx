import { describe, it, expect } from "vitest";
import {
  getGeneralPurchaseProgress,
  getGeneralProgressForExecution,
  getFinanceStageForExecution,
  getRequestListStatus,
  withoutEventData,
  budgetLineOverages,
  EVIDENCE_STAGE_ENABLED,
} from "./App";

// 상태 전이 로직 단위 테스트 — 렌더 스모크로는 검증되지 않는 계산 규칙을 고정한다.
const req = (over: any = {}) => ({ id: "REQ-T", status: "구매 필요", requester: "홍길동", ...over } as any);
const item = (over: any = {}) => ({ id: 1, status: "승인", ...over } as any);
const exe = (over: any = {}) => ({ id: "1-EX1", itemId: 1, orderStatus: "주문 대기", receiptStatus: "해당 없음", serviceStatus: "해당 없음", evidenceStatus: "해당 없음", ...over } as any);

describe("Bug2 — 일반 사용자 대표 상태: 수령·이행 완료가 증빙 필요보다 우선", () => {
  it("품목: 수령 완료 + 증빙 필요 → 수령 완료(정산 중 아님)", () => {
    expect(getGeneralPurchaseProgress(req(), item({ orderStatus: "주문 완료", fulfillmentStatus: "수령 완료", evidenceStatus: "증빙 필요" }), "홍길동")).toBe("수령 완료");
  });
  it("품목: 증빙 정리 중 → 정산 중", () => {
    expect(getGeneralPurchaseProgress(req(), item({ fulfillmentStatus: "수령 완료", evidenceStatus: "증빙 정리 중" }), "홍길동")).toBe("정산 중");
  });
  it("품목: 이행 완료 + 증빙 필요 → 이행 완료", () => {
    expect(getGeneralPurchaseProgress(req(), item({ orderStatus: "주문 완료", fulfillmentStatus: "이행 완료", evidenceStatus: "증빙 필요" }), "홍길동")).toBe("이행 완료");
  });
  it("실행분: 수령 완료 + 증빙 필요 → 수령 완료", () => {
    expect(getGeneralProgressForExecution(exe({ orderStatus: "주문 완료", receiptStatus: "수령 완료", evidenceStatus: "증빙 필요" }))).toBe("수령 완료");
  });
  it("실행분: 증빙 정리 중 → 정산 중", () => {
    expect(getGeneralProgressForExecution(exe({ receiptStatus: "수령 완료", evidenceStatus: "증빙 정리 중" }))).toBe("정산 중");
  });
});

describe("Bug1 — 재주문 보류 실행분은 주문 대기 단계로 계산되지 않는다", () => {
  it("원본 취소분 환불 미확정이면 재주문 실행분은 재주문 보류", () => {
    const origin = exe({ id: "1-EX1", orderStatus: "주문 취소", paid: true, refundResult: "미확정" });
    const reorder = exe({ id: "1-RE2", orderStatus: "주문 대기", reorderOfExecutionId: "1-EX1" });
    expect(getFinanceStageForExecution(reorder, [origin, reorder])).toBe("재주문 보류");
  });
  it("원본 취소분 환불 확정·증빙 완료면 재주문 실행분은 주문 대기", () => {
    const origin = exe({ id: "1-EX1", orderStatus: "주문 취소", paid: true, refundResult: "환불 없음", evidenceStatus: "증빙 완료" });
    const reorder = exe({ id: "1-RE2", orderStatus: "주문 대기", reorderOfExecutionId: "1-EX1" });
    expect(getFinanceStageForExecution(reorder, [origin, reorder])).toBe("주문 대기");
  });
});

describe("Bug4 — 결제 전/후 취소 구분과 환불 2단계", () => {
  it("결제 후 취소(paid=true) → 환불 대기", () => {
    const ex = exe({ orderStatus: "주문 취소", paid: true, refundResult: "미확정" });
    expect(getFinanceStageForExecution(ex, [ex])).toBe("환불 대기");
  });
  it("결제 전 취소(paid=false) → 환불 건너뛰고 재주문 판단", () => {
    const ex = exe({ orderStatus: "주문 취소", paid: false });
    expect(getFinanceStageForExecution(ex, [ex])).toBe("재주문 판단");
  });
  it("환불 자료 확보(refundDocsReady=true) → 환불 확인", () => {
    const ex = exe({ orderStatus: "주문 취소", paid: true, refundResult: "미확정", refundDocsReady: true });
    expect(getFinanceStageForExecution(ex, [ex])).toBe("환불 확인");
  });
});

describe("withoutEventData — 시연 초기화: 특정 행사 데이터만 제거", () => {
  it("지정한 eventId 항목만 제거하고 나머지는 보존한다", () => {
    const rows = [
      { id: "a", eventId: "EVT-WELCOME" },
      { id: "b", eventId: "SPORTS-2026" },
      { id: "c", eventId: "EVT-WELCOME" },
    ];
    expect(withoutEventData(rows, "EVT-WELCOME")).toEqual([{ id: "b", eventId: "SPORTS-2026" }]);
  });
  it("해당 행사 항목이 없으면 원소를 그대로 유지한다", () => {
    const rows = [{ id: "b", eventId: "SPORTS-2026" }];
    expect(withoutEventData(rows, "EVT-WELCOME")).toEqual(rows);
  });
});

describe("budgetLineOverages — 예산 항목별 승인액이 항목 사용 가능액을 넘는지", () => {
  const lines = [
    { name: "행사 운영비", allocated: 1000000, actual: 200000 },
    { name: "홍보비", allocated: 500000, actual: 0 },
  ];
  it("항목 사용 가능액을 넘는 항목만 초과액과 함께 반환한다", () => {
    // 운영비: 사용가능 = 1000000 - 200000 - 예약300000 = 500000, 승인예정 600000 → 초과 100000
    // 홍보비: 사용가능 = 500000 - 0 - 0 = 500000, 승인예정 100000 → 여유
    const reserved = (l: string) => (l === "행사 운영비" ? 300000 : 0);
    const approving = (l: string) => (l === "행사 운영비" ? 600000 : 100000);
    expect(budgetLineOverages(lines, reserved, approving)).toEqual([{ name: "행사 운영비", over: 100000 }]);
  });
  it("모든 항목이 사용 가능액 이내면 빈 배열을 반환한다", () => {
    const reserved = () => 0;
    const approving = (l: string) => (l === "행사 운영비" ? 500000 : 200000);
    expect(budgetLineOverages(lines, reserved, approving)).toEqual([]);
  });
  it("정확히 사용 가능액과 같으면 초과가 아니다", () => {
    const reserved = () => 0;
    const approving = (l: string) => (l === "행사 운영비" ? 800000 : 500000);
    expect(budgetLineOverages(lines, reserved, approving)).toEqual([]);
  });
});

// MVP 제품화 범위에서 증빙 단계를 제외했다(VADA_MVP_SPEC.md 6.1, 2026-08-19).
// 증빙을 다시 켜면(EVIDENCE_STAGE_ENABLED = true) 이 describe는 통째로 건너뛴다.
describe.skipIf(EVIDENCE_STAGE_ENABLED)("증빙 제외 — 수령·이행 완료 다음은 금액 확인이고, 금액이 확정돼야 종결이다", () => {
  it("수령 완료 → 금액 확인 (증빙 필요로 가지 않는다)", () => {
    expect(getFinanceStageForExecution(exe({ orderStatus: "주문 완료", receiptStatus: "수령 완료" }), [])).toBe("금액 확인");
  });
  it("이행 완료 → 금액 확인", () => {
    expect(getFinanceStageForExecution(exe({ orderStatus: "주문 완료", receiptStatus: "해당 없음", serviceStatus: "이행 완료" }), [])).toBe("금액 확인");
  });
  it("실지출 금액을 확정하면 정산 완료로 종결한다", () => {
    expect(getFinanceStageForExecution(exe({ orderStatus: "주문 완료", receiptStatus: "수령 완료", actualAmount: 80000 }), [])).toBe("정산 완료");
    expect(getFinanceStageForExecution(exe({ orderStatus: "주문 완료", receiptStatus: "해당 없음", serviceStatus: "이행 완료", actualAmount: 105600 }), [])).toBe("정산 완료");
  });
  it("0원도 확정으로 본다 — 무상·전액 할인 실행분이 금액 확인에 영원히 남지 않게 한다", () => {
    expect(getFinanceStageForExecution(exe({ orderStatus: "주문 완료", receiptStatus: "수령 완료", actualAmount: 0 }), [])).toBe("정산 완료");
  });
  it("증빙 상태가 이미 붙은 실행분도 같은 규칙을 탄다 — 어느 영역에도 안 잡혀 사라지는 것을 막는다", () => {
    expect(getFinanceStageForExecution(exe({ orderStatus: "주문 완료", receiptStatus: "수령 완료", evidenceStatus: "증빙 필요" }), [])).toBe("금액 확인");
    expect(getFinanceStageForExecution(exe({ orderStatus: "주문 완료", receiptStatus: "수령 완료", evidenceStatus: "증빙 정리 중" }), [])).toBe("금액 확인");
    expect(getFinanceStageForExecution(exe({ orderStatus: "주문 완료", receiptStatus: "수령 완료", evidenceStatus: "증빙 필요", actualAmount: 80000 }), [])).toBe("정산 완료");
  });
  it("요청자에게는 금액 확인이 보이지 않고, 금액이 확정되면 처리 완료가 된다", () => {
    expect(getGeneralProgressForExecution(exe({ orderStatus: "주문 완료", receiptStatus: "수령 완료" }))).toBe("수령 완료");
    expect(getGeneralProgressForExecution(exe({ orderStatus: "주문 완료", receiptStatus: "수령 완료", actualAmount: 80000 }))).toBe("처리 완료");
  });
  it("수령 확인 필요는 아직 종결이 아니다", () => {
    expect(getFinanceStageForExecution(exe({ orderStatus: "주문 완료", receiptStatus: "수령 확인 필요" }), [])).toBe("수령 확인 필요");
  });
  it("재주문 보류 게이트는 환불 미확정만으로 판정한다 — 증빙은 더 이상 막지 않는다", () => {
    const origin = exe({ id: "1-EX1", orderStatus: "주문 취소", paid: true, refundResult: "전액 환불", evidenceStatus: "증빙 필요" });
    const reorder = exe({ id: "1-EX2", orderStatus: "주문 대기", reorderOfExecutionId: "1-EX1" });
    expect(getFinanceStageForExecution(reorder, [origin, reorder])).toBe("주문 대기");
  });
  it("환불이 미확정이면 재주문은 여전히 보류된다", () => {
    const origin = exe({ id: "1-EX1", orderStatus: "주문 취소", paid: true });
    const reorder = exe({ id: "1-EX2", orderStatus: "주문 대기", reorderOfExecutionId: "1-EX1" });
    expect(getFinanceStageForExecution(reorder, [origin, reorder])).toBe("재주문 보류");
  });
  it("취소 실행분은 환불 확정 후 증빙을 거치지 않고 재주문 판단으로 간다", () => {
    const ex = exe({ id: "1-EX1", orderStatus: "주문 취소", paid: true, refundResult: "전액 환불", evidenceStatus: "증빙 필요" });
    expect(getFinanceStageForExecution(ex, [ex])).toBe("재주문 판단");
  });
});

// `내 구매 요청` 목록이 요청 상태만 보고 있어 승인 이후의 진행이 전부 `승인 완료`로 뭉쳤다.
// 이미 수령한 요청이 승인 단계로 보이면 요청자가 "내 요청 어떻게 됐지"에 답을 얻지 못한다(MVP 가설 3).
describe("요청 목록 대표 상태 — 실행분 진행에서 계산한다", () => {
  const withExec = (over: any = {}) => req({
    status: "승인",
    items: [item({ id: 1, status: "승인", executions: [exe({ ...over })] })],
  });

  it("승인만 되고 주문 전이면 승인 완료", () => {
    expect(getRequestListStatus(withExec({ orderStatus: "주문 대기" }))).toBe("승인 완료");
  });
  it("주문 이후는 구매 진행", () => {
    expect(getRequestListStatus(withExec({ orderStatus: "주문 완료", receiptStatus: "배송 중" }))).toBe("구매 진행");
  });
  it("수령 완료도 구매 진행 — 승인 완료로 되돌아가지 않는다", () => {
    expect(getRequestListStatus(withExec({ orderStatus: "주문 완료", receiptStatus: "수령 완료" }))).toBe("구매 진행");
  });
  it("실지출 금액이 확정되면 처리 완료", () => {
    expect(getRequestListStatus(withExec({ orderStatus: "주문 완료", receiptStatus: "수령 완료", actualAmount: 80000 }))).toBe("처리 완료");
  });
  it("검토 전·보완·종결은 요청 상태를 그대로 따른다", () => {
    expect(getRequestListStatus(req({ status: "검토 대기", items: [] }))).toBe("검토 대기");
    expect(getRequestListStatus(req({ status: "보완 요청", items: [] }))).toBe("보완 필요");
    expect(getRequestListStatus(req({ status: "반려", items: [] }))).toBe("반려");
    expect(getRequestListStatus(req({ status: "요청 취소", items: [] }))).toBe("요청 취소");
  });
  it("승인된 품목이 아직 없으면 검토 대기", () => {
    expect(getRequestListStatus(req({ status: "승인", items: [item({ status: "검토 대기" })] }))).toBe("검토 대기");
  });
});
