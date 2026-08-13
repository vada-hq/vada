import { describe, it, expect } from "vitest";
import {
  getGeneralPurchaseProgress,
  getGeneralProgressForExecution,
  getFinanceStageForExecution,
  withoutEventData,
  budgetLineOverages,
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
