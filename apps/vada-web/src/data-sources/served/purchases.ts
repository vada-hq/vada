import type { Served } from './area'

/**
 * 구매 요청의 흐름(FIN-REQ-01 · REQ-02 · SUP-01의 읽기와 REQ-01 · SUP-01 · REV-01 · EVID-01의 쓰기).
 *
 * 재정의 겉면(`finance.ts`)과 가른다. 요청 한 건이 작성 → 검토 → 구매 → 증빙 → 정산을 지나는 길이
 * 여기다 — 저쪽은 그 길의 각 자리를 **보는** 화면(검토·구매·증빙·내 요청)이고, 여기는 그 길을
 * **가게 하는** 쓰기 여섯과 요청자가 보는 읽기 아홉이다.
 *
 * **다시 받을 칸과 파일 자리는 서버가 빈 목록으로 답한다.** 재정부가 무엇을 다시 묻는지 적는 자리가
 * FIN-REV-01에 없고 명세도 유형별 목록을 들지 않아, 서버가 지어내지 않고 비워 둔다 — 그래서
 * FIN-SUP-01의 그 두 묶음은 비어 있는 채로 그려진다. 그것이 지금의 참이다.
 */
export const purchases: Served = {
  reads: [
    // 구매 요청 작성·수정(FIN-REQ-01). 예산 항목 고르기와, 새로 쓰거나 고치는 요청 한 건.
    'finance.budgetItems',
    'finance.purchaseRequestDraft',
    // 구매 요청 상세·진행 상태(FIN-REQ-02).
    'finance.purchaseRequestDetail',
    'finance.purchaseRequestItems',
    'finance.purchaseRequestHistory',
    // 보완 요청 확인·재제출(FIN-SUP-01).
    'finance.supplementRequest',
    'finance.supplementItems',
    'finance.supplementInputFields',
    'finance.supplementAttachments',
  ],
  writes: [
    // 작성·수정(FIN-REQ-01). 임시 저장은 덮어쓰기이고 제출은 검토로 넘긴다 — 서버가 번호를 만든다.
    'finance.purchaseRequest.saveDraft',
    'finance.purchaseRequest.submit',
    // 검토(FIN-REV-01). 전부 승인이면 구매로, 보완이 하나라도 있으면 보완 요청이다.
    'finance.purchaseRequest.sendReview',
    // 보완 답변(FIN-SUP-01). 적어 두거나 다시 낸다.
    'finance.purchaseRequest.saveSupplement',
    'finance.purchaseRequest.resubmitSupplement',
    // 결제·증빙 정리(FIN-EVID-01). 서류가 다 붙었으면 처리 완료다.
    'finance.purchaseRequest.completeEvidence',
  ],
}
