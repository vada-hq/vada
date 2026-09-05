import type { Served } from './area'

/**
 * 기록(REC-01).
 *
 * 발행된 아카이브의 본문은 여기 오지 않는다. 발행이 무엇인지 아직 안 정했다 —
 * `record.archive.requestReview`가 '발행이 아니다'라고 못 박았고 발행 단추도
 * 그려지지 않았다.
 *
 * 여기 있는 것은 **완료된 행사를 세는 자리**다. 발행이 무엇인지 몰라도 '아직
 * 발행되지 않았다'는 셀 수 있다 — 표의 `event_archives.status`가 그 사실을 든다.
 */
export const record: Served = {
  reads: ['record.completedEventAlert', 'record.completedEvents'],
  writes: [],
}
