import type { Served } from './area'

/**
 * 문서(EVT-DOC-01 · OPS-MEET-03A/05A/07 · EVT-TASK-02). 세 영역이 한 표를 본다.
 *
 * **화면 이름이 아니라 표를 따라 갈랐다.** 명세가 그렇게 말한다 — 회의 쪽은
 * '안건의 사전 자료와 회의록의 관련 자료가 같은 물건'이라 적었고, 업무 쪽은 참고
 * 문서가 '업무의 것이 아니라 행사의 공용 원본이라 여러 업무가 같은 것을 본다'고
 * 적었다. 자리마다 갈라 지으면 같은 표가 화면마다 다른 모양으로 읽힌다.
 *
 * **쓰기가 없다.** 문서를 만들거나 올리는 동작을 명세가 주지 않았고(회의의 '자료
 * 첨부'는 무엇으로 고르는지 그려진 프레임이 없다고 적혀 있다), 표도 파일을 담지
 * 않는다 — 이름과 상태뿐이다.
 */
export const documents: Served = {
  reads: [
    // 행사 문서 표와 그 머리의 타일·거르개 옆의 개수(EVT-DOC-01).
    'event.documents',
    'event.documentStats',
    'event.documentStatusCounts',
    // 화면 셋이 같은 자리를 부른다(OPS-MEET-03A · 05A · 07).
    'meeting.documents',
    // 업무가 따르는 원본과 업무가 내놓은 것(EVT-TASK-02).
    'task.referenceDocuments',
    'task.workDocuments',
  ],
  writes: [],
}
