import type { Handlers } from '../deps.ts'

// 구매 요청의 흐름(FIN-REQ-01 · REQ-02 · SUP-01 · REV-01 · PROC-01 · EVID-01의 쓰기).
// **아직 비어 있다** — 자리를 미리 열어 둔 것이다.
//
// **재정 영역과 가른다.** `finance.ts`는 학생회 재정의 겉면(전체 현황·장부·예산 편성)을
// 답하고, 여기는 **요청 한 건이 검토·구매·증빙·정산을 지나는 길**을 답한다. 보는 표는
// 같지만(`purchase_requests`와 그 딸림) 한 파일에 두면 나란히 붙일 때 같은 줄에서 부딪힌다.

export const purchaseHandlers: Handlers = {}
