import { orgOf, type Handlers } from '../deps.ts'
import {
  opsCalendarDays,
  opsCalendarMonth,
  opsCalendarWeek,
  opsCalendarWeekRange,
  readCalendarType,
} from '../ops/calendar.ts'
import { opsIntro, opsSpaceStats } from '../ops/space.ts'
import { NotFound } from '../routes.ts'

// 운영 공간 그 자체(OPS-00 · OPS-CAL-01).
//
// **회의와 가른다.** 회의는 `meetings.ts`가 답한다. 여기 오는 것은 회의가 아니라
// 운영 공간의 첫 화면과 달력처럼 **여러 표를 가로질러 세는 것**이다.
//
// **달력은 원본이 아니라 비친 것이다**(`db/schema.ts` 머리). 표가 없고, 그려지는
// 것은 행사의 일시·회의의 일시·업무의 기한이다 — 모으는 일을 `ops/calendar.ts`가 한다.

export const opsHandlers: Handlers = {
  // ── 운영 허브 (OPS-00) ────────────────────────────────────────────────
  'ops.intro': async (c, d) => {
    const orgId = orgOf(c)
    const membership = c.get('sender')?.membership
    if (membership === null || membership === undefined) {
      throw new NotFound('학생회를 찾지 못했습니다')
    }
    // 보는 사람 자신의 이름이 들어가는 문장이다 — 그 사람이 정보주체다.
    c.set('auditSubject', { type: 'user', id: c.get('sender')!.userId })
    return opsIntro(d.db, orgId, membership.memberId)
  },
  'ops.spaceStats': async (c, d) => {
    const orgId = orgOf(c)
    c.set('auditSubject', { type: 'organization', id: orgId })
    return opsSpaceStats(d.db, orgId, d.invite.now())
  },

  // ── 캘린더 (OPS-CAL-01) ────────────────────────────────────────────────
  //
  // **보고 있는 달도 이번 주도 오늘이 정한다.** 달을 옮기는 어휘가 명세에 아직
  // 없어 화면이 넘길 값이 없다 — 인자를 받지 않는 까닭이다.
  'ops.calendarMonth': async (c, d) => {
    c.set('auditSubject', { type: 'organization', id: orgOf(c) })
    return opsCalendarMonth(d.invite.now())
  },
  'ops.calendarWeekRange': async (c, d) => {
    c.set('auditSubject', { type: 'organization', id: orgOf(c) })
    return opsCalendarWeekRange(d.invite.now())
  },
  'ops.calendarDays': async (c, d) => {
    const orgId = orgOf(c)
    c.set('auditSubject', { type: 'organization', id: orgId })
    // **거르는 일은 서버가 한다.** 받아온 것을 화면이 다시 거르면 격자에 그려지는
    // 것과 걸러진 것이 갈린다.
    return opsCalendarDays(d.db, orgId, readCalendarType(c.req.query('type')), d.invite.now())
  },
  'ops.calendarWeek': async (c, d) => {
    const orgId = orgOf(c)
    c.set('auditSubject', { type: 'organization', id: orgId })
    return opsCalendarWeek(d.db, orgId, readCalendarType(c.req.query('type')), d.invite.now())
  },
}
