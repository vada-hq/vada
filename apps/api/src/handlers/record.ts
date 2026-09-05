import { orgOf, type Handlers } from '../deps.ts'
import { completedEventAlert, completedEvents } from '../records/completed.ts'

// 기록(REC-01).
//
// 아카이브의 **발행**은 아직 없다(백로그 '결정 대기'). `record.archive.requestReview`가
// '발행이 아니다'라고 못 박았고 발행 단추가 안 그려졌으므로, 발행된 아카이브의 본문을
// 주는 자리는 짓지 않는다 — 지으면 그 모양을 짓는 것이 아니라 **정하는 일**이 된다.
//
// 여기 있는 것은 **완료된 행사를 세는 자리**다. 발행이 무엇인지 몰라도 '아직 발행되지
// 않았다'는 셀 수 있다 — 표의 `event_archives.status`가 그 사실을 든다.

export const recordHandlers: Handlers = {
  // ── 완료된 행사 (REC-01) ───────────────────────────────────────────────
  //
  // **거르는 것은 서버가 한다.** 화면은 받아온 것을 다시 자르지 않는다.
  'record.completedEvents': async (c, d) => {
    const orgId = orgOf(c)
    c.set('auditSubject', { type: 'organization', id: orgId })
    return completedEvents(d.db, orgId, { query: c.req.query('query') })
  },
  // **검색어를 받지 않는다.** 목록이 걸러져도 미발행 건수는 걸러지지 않는다.
  'record.completedEventAlert': async (c, d) => {
    const orgId = orgOf(c)
    c.set('auditSubject', { type: 'organization', id: orgId })
    return completedEventAlert(d.db, orgId)
  },
}
