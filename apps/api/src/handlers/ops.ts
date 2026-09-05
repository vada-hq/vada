import { orgOf, type Handlers } from '../deps.ts'
import { opsIntro, opsSpaceStats } from '../ops/space.ts'
import { NotFound } from '../routes.ts'

// 운영 공간 그 자체(OPS-00 · OPS-CAL-01).
//
// **회의와 가른다.** 회의는 `meetings.ts`가 답한다. 여기 오는 것은 회의가 아니라
// 운영 공간의 첫 화면과 달력처럼 **여러 표를 가로질러 세는 것**이다.
//
// 아직 안 붙은 것 넷: `ops.calendarMonth`·`ops.calendarDays`·`ops.calendarWeekRange`·
// `ops.calendarWeek`. 달력이 모으는 셋(행사·회의·마감) 중 마감의 규칙만 그림에 있고
// (`마감은 완료되지 않은 업무 기준`) 나머지는 다음 회차의 몫이다.

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
}
