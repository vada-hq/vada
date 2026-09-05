import type { Served } from './area'

/**
 * 재정(FIN-REV-01 · FIN-PROC-01 · FIN-EVID-01 · MY-REQ-01).
 *
 * **화면 넷이 한 요청을 단계별로 본다.** 검토하고 → 사고 → 증빙을 붙이는 흐름이
 * `purchase_requests`의 한 줄을 따라가고, 화면마다 다른 것은 그 줄의 어느 곁가지를
 * 함께 읽느냐뿐이다(품목 · 발주 · 결제).
 *
 * **`event.myPurchaseRequest*`도 여기 있다.** 이름이 `event.`로 시작하지만 같은
 * 요청 표를 읽으므로 한 사람이 든다 — 이름의 머리와 파일 이름은 갈려도 된다.
 *
 * **쓰기는 아직 없다.** 요청을 내고 판정을 보내는 동작이 명세에 있지만 이 회차는
 * 읽는 자리만 붙였다 — 그래서 이 표들은 비어 있고, 화면은 빈 상태로 그려진다.
 * 그것이 맞는 결과다.
 *
 * **금액의 바탕이 되는 자리는 아직 여기 없다**(`finance.orgOverview`·
 * `event.financeSummary`). 예산을 정하는 화면이 명세에 없어 배정액이 늘 비어 있고,
 * 그 위에 선 자리는 붙여도 사람이 볼 것이 없다(백로그 '결정 대기').
 */
export const finance: Served = {
  reads: [
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
  writes: [],
}
