import type { Context } from 'hono'
import { orgOf, type Handlers } from '../deps.ts'
import {
  archiveDraft,
  archiveGate,
  archiveGateConditions,
  archiveHandover,
  archiveRetro,
  archiveReview,
  archiveReviewers,
  archiveSections,
  recordArchive,
} from '../records/archive.ts'
import {
  archiveAutoFilled,
  archiveDetail,
  archiveEvidence,
  archiveTimeline,
} from '../records/archive-body.ts'
import {
  generateHandoverDraft,
  requestArchiveReview,
  saveArchiveDraft,
  type ArchiveWriter,
} from '../records/archive-write.ts'
import { completedEventAlert, completedEvents } from '../records/completed.ts'
import { NotFound } from '../routes.ts'

// 기록(REC-01 · REC-02 · REC-02A).
//
// 표는 `event_archives` 하나이고 나머지는 행사에 딸린 표들을 세어 만든다.
//
// **발행은 검토를 통과하는 순간이다**(2026-09-05에 사람이 정했다). 그 승인을 누르는
// 자리는 아직 그려지는 중이라 발행하는 변이는 여기 없다 — 다만 발행된 문서를 **읽는**
// 쪽은 있다: 굳은 값(`frozen`)이 있으면 거기서, 없으면 지금 값으로 답한다
// (`records/archive-body.ts`가 그 갈림을 든다).
//
// **검토 단계는 명세에서 빠진다**(같은 날 밤). 그래서 검토 요청·검토 의견·검토자
// 후보는 짓지 않는다.
//
// **쓰는 두 자리는 계약이 권한을 아직 안 정했다**(`x-authorize: unstated`). 답은
// 여기 붙어 있지만 미들웨어가 아무에게도 열지 않는다 — 누가 기록을 쓰는지가 정해지는
// 날 명세의 그 줄만 바뀌면 그대로 열린다.

/** 어느 행사의 아카이브인가. 계약이 주소에 박아 둔 인자다. */
function eventIdOf(c: Context): string {
  const eventId = c.req.param('eventId')
  if (eventId === undefined || eventId === '') throw new NotFound('그 행사를 찾지 못했습니다')
  c.set('auditSubject', { type: 'event', id: eventId })
  return eventId
}

/** 이 요청을 보낸 구성원. 구성원이 아니면 여기까지 오지 않는다(권한 미들웨어가 앞서 막는다). */
function writerOf(c: Context): ArchiveWriter {
  const membership = c.get('sender')?.membership
  if (membership === null || membership === undefined) {
    throw new NotFound('학생회를 찾지 못했습니다')
  }
  return { memberId: membership.memberId }
}

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

  // ── 아카이브 문서 (REC-02 · REC-02A) ───────────────────────────────────
  //
  // 문서 자체와 목차는 두 화면이 함께 읽고, 같은 목록을 다르게 그린다.
  'record.archive': async (c, d) => recordArchive(d.db, orgOf(c), eventIdOf(c)),
  'record.archiveSections': async (c, d) => archiveSections(d.db, orgOf(c), eventIdOf(c)),

  // ── 자동으로 채워지는 본문 ─────────────────────────────────────────────
  //
  // **굳은 값이 있으면 그것, 없으면 지금 값.** 넷이 한 갈림에서 집어 간다. 지금은
  // 업무의 지연을 가르는 데만 쓴다.
  'record.archiveDetail': async (c, d) =>
    archiveDetail(d.db, orgOf(c), eventIdOf(c), d.invite.now()),
  'record.archiveTimeline': async (c, d) =>
    archiveTimeline(d.db, orgOf(c), eventIdOf(c), d.invite.now()),
  'record.archiveEvidence': async (c, d) =>
    archiveEvidence(d.db, orgOf(c), eventIdOf(c), d.invite.now()),
  'record.archiveAutoFilled': async (c, d) =>
    archiveAutoFilled(d.db, orgOf(c), eventIdOf(c), d.invite.now()),

  // ── 사람이 쓴 것 ───────────────────────────────────────────────────────
  //
  // 쓰는 화면은 칸으로 읽고, 읽는 화면은 줄과 묶음으로 읽는다 — 같은 글이다.
  'record.archiveDraft': async (c, d) => archiveDraft(d.db, orgOf(c), eventIdOf(c)),
  'record.archiveRetro': async (c, d) => archiveRetro(d.db, orgOf(c), eventIdOf(c)),
  'record.archiveHandover': async (c, d) => archiveHandover(d.db, orgOf(c), eventIdOf(c)),

  // ── 발행 조건 (REC-02A) ────────────────────────────────────────────────
  //
  // **막는 것은 서버다.** 조건 목록과 채운 수가 한 셈에서 나오고 화면은 막힌 까닭만 그린다.
  'record.archiveGate': async (c, d) => archiveGate(d.db, orgOf(c), eventIdOf(c)),
  'record.archiveGateConditions': async (c, d) =>
    archiveGateConditions(d.db, orgOf(c), eventIdOf(c)),

  // ── 쓰기 (REC-02A) ─────────────────────────────────────────────────────
  //
  // 임시 저장은 덮어쓰기이고, 초안은 기록에서만 모은다. 둘 다 발행된 문서에는 닿지 않는다.
  'record.archive.saveDraft': async (c, d) => {
    const orgId = orgOf(c)
    const eventId = eventIdOf(c)
    const draft = (await c.req.json().catch(() => ({}))) as Record<string, unknown>
    return saveArchiveDraft(d.db, orgId, eventId, draft, writerOf(c), d.invite.now(), d.newId)
  },
  'record.archive.generateHandoverDraft': async (c, d) =>
    generateHandoverDraft(d.db, orgOf(c), eventIdOf(c), writerOf(c), d.invite.now(), d.newId),

  // ── 검토 (REC-02A) ─────────────────────────────────────────────────────
  //
  // 검토는 그림에 있다 — 검토자 고르기·검토 요청·검토 의견. 없는 것은 검토자가 승인을
  // 누르는 단추 하나이고, 그것이 발행이다(사람이 정함, 2026-09-05). 그때까지 문서는
  // '검토 중'에 머문다.
  'record.archiveReview': async (c, d) => archiveReview(d.db, orgOf(c), eventIdOf(c)),
  'record.archiveReviewers.options': async (c, d) =>
    archiveReviewers(d.db, orgOf(c), eventIdOf(c)),
  'record.archive.requestReview': async (c, d) => {
    const orgId = orgOf(c)
    const eventId = eventIdOf(c)
    const draft = (await c.req.json().catch(() => ({}))) as Record<string, unknown>
    return requestArchiveReview(d.db, orgId, eventId, draft, writerOf(c), d.invite.now(), d.newId)
  },
}
