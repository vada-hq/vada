import type { Served } from './area'

/**
 * 기록(REC-01 · REC-02 · REC-02A).
 *
 * **발행은 검토를 통과하는 순간이다**(2026-09-05에 사람이 정했다). 발행된 문서는
 * 그때 굳힌 값(`event_archives.frozen`)에서 읽히고, 발행 전에는 읽을 때마다 지금
 * 값으로 만들어진다 — 그 갈림은 서버가 한 곳에 든다(`records/archive-body.ts`).
 *
 * 아직 안 올린 것 셋과 그 까닭:
 * - `record.archiveChecklist` — 무엇을 확인해야 하는지가 '그 행사의 인수인계 내용'에서
 *   나온다는데 항목이 어디서 오는지 명세가 말하지 않는다. 멈추는 자리다.
 * - `record.archiveReview` · `record.archiveReviewers` — **검토 단계가 명세에서 빠진다**
 *   (2026-09-05 밤). 짓지 않는다.
 * - 쓰기 둘(`record.archive.saveDraft` · `generateHandoverDraft`) — 서버에 답은 있지만
 *   계약이 권한을 `unstated`로 적어 두어 미들웨어가 아무에게도 열지 않는다. 여기 올리면
 *   눌렀을 때 '저장하지 못했습니다'가 뜨는데 그것은 고장이 아니라 아직 안 정한 것이다 —
 *   권한이 정해지는 날 올린다.
 */
export const record: Served = {
  reads: [
    'record.completedEventAlert',
    'record.completedEvents',
    // 문서 자체와 목차. 두 화면이 같은 것을 읽고 다르게 그린다.
    'record.archive',
    'record.archiveSections',
    // 자동으로 채워지는 본문. 굳은 값이 있으면 그것, 없으면 지금 값.
    'record.archiveAutoFilled',
    'record.archiveDetail',
    'record.archiveTimeline',
    'record.archiveEvidence',
    // 사람이 쓴 것. 쓰는 화면은 칸으로, 읽는 화면은 줄과 묶음으로.
    'record.archiveDraft',
    'record.archiveRetro',
    'record.archiveHandover',
    // 발행 조건. 목록과 채운 수가 서버의 한 셈에서 나온다.
    'record.archiveGate',
    'record.archiveGateConditions',
  ],
  // 회장단·부서장만 쓴다(`record.write`, 사람이 정함 2026-09-05). 발행은 명세를 고친 뒤 온다.
  writes: ['record.archive.saveDraft', 'record.archive.generateHandoverDraft'],
}
