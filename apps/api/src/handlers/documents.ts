import type { Handlers } from '../deps.ts'

// 문서(EVT-DOC-01 · OPS-MEET-03A/05A/07 · EVT-TASK-02).
//
// **행사 문서·회의 자료·업무 문서가 한 표다**(`documents`). 명세가 그렇게 말한다 —
// 회의 쪽은 '안건의 사전 자료와 회의록의 관련 자료가 같은 물건'이라 적었고, 업무
// 쪽은 참고 문서가 '행사의 공용 원본이라 여러 업무가 같은 것을 본다'고 적었다.
//
// 그래서 영역을 화면 이름이 아니라 표로 갈랐다 — 자리마다 갈라 지으면 같은 표가
// 화면마다 다른 모양으로 읽힌다.

export const documentHandlers: Handlers = {}
