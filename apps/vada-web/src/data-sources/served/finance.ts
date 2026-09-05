import type { Served } from './area'

/**
 * 재정(FIN-PLAN-01 · FIN-REV-01 · FIN-PROC-01 · FIN-EVID-01 · MY-REQ-01).
 *
 * **예산 편성(FIN-PLAN-01)이 바탕이다.** 재정 28자리가 전부 이 화면이 넣는 금액 위에
 * 선다 — 기간·수입원·상시 항목·행사별 항목 한 벌을 읽고, 한 벌을 통째로 덮어쓴다.
 * 이 자리가 없던 동안 배정액이 늘 비어 있어 `finance.orgOverview`·`event.financeSummary`
 * 같은 자리는 붙여도 사람이 볼 것이 없었다(백로그 '결정 대기'). 이제 그 자리들이
 * 순서대로 열린다 — 총예산 카드가 먼저, 장부와 구매 요청이 그다음.
 *
 * **화면 넷이 한 요청을 단계별로 본다.** 검토하고 → 사고 → 증빙을 붙이는 흐름이
 * `purchase_requests`의 한 줄을 따라가고, 화면마다 다른 것은 그 줄의 어느 곁가지를
 * 함께 읽느냐뿐이다(품목 · 발주 · 결제).
 *
 * **`event.myPurchaseRequest*`도 여기 있다.** 이름이 `event.`로 시작하지만 같은
 * 요청 표를 읽으므로 한 사람이 든다 — 이름의 머리와 파일 이름은 갈려도 된다.
 *
 * **구매 요청 쪽의 쓰기는 아직 없다.** 요청을 내고 판정을 보내는 동작이 명세에 있지만
 * 그 회차는 읽는 자리만 붙였다 — 그래서 그 표들은 비어 있고, 화면은 빈 상태로 그려진다.
 * 그것이 맞는 결과다.
 */
export const finance: Served = {
  reads: [
    // 예산 편성(FIN-PLAN-01). 초안 한 벌과, 예산을 배정할 수 있는 행사 고르기.
    'finance.budgetPlanDraft',
    'finance.budgetEvents',
    // 구매 요청 검토(FIN-REV-01). 판정의 단위가 품목이라 머리와 목록이 갈려 있다.
    'finance.reviewSummary',
    'finance.reviewItems',
    // 구매·발주 처리(FIN-PROC-01). 묶음 하나가 업체 하나다.
    'finance.purchaseOrderSummary',
    'finance.purchaseOrders',
    // 결제·증빙 정리(FIN-EVID-01). 묶음 하나가 결제 하나다.
    'finance.paymentEvidenceSummary',
    'finance.paymentEvidences',
    // 내 구매 요청(MY-REQ-01).
    'event.myPurchaseRequestSummary',
    'event.myPurchaseRequests',
  ],
  writes: [
    // 예산 편성 저장(FIN-PLAN-01). 덮어쓰기 — 화면이 한 벌 전부를 보낸다.
    'finance.budgetPlan.save',
  ],
}
