import { orgOf, type Handlers } from '../deps.ts'
import { organizationName, viewerLine } from '../org/shell.ts'
import { NotFound } from '../routes.ts'

// 셸이 읽는 둘. **화면의 요소가 아니라 화면을 감싼 것의 값이다** — 학생회 이름과
// 보는 사람은 어느 화면에서나 같은 자리에 그려진다.

export const shellHandlers: Handlers = {
  // ── 셸 ────────────────────────────────────────────────────────────────
  'shell.organization': async (c, d) => {
    const orgId = orgOf(c)
    c.set('auditSubject', { type: 'organization', id: orgId })
    const row = await organizationName(d.db, orgId)
    if (row === null) throw new NotFound('학생회를 찾지 못했습니다')
    return row
  },
  'shell.viewer': async (c, d) => {
    const who = c.get('sender')!
    const orgId = orgOf(c)
    // 보는 사람 자신의 학적 정보를 읽는다 — 그 사람이 정보주체다.
    c.set('auditSubject', { type: 'user', id: who.userId })
    const row = await viewerLine(d.db, orgId, who.userId)
    if (row === null) throw new NotFound('이 학생회의 구성원이 아닙니다')
    return row
  },
}
