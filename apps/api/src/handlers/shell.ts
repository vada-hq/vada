import { orgOf, type Handlers } from '../deps.ts'
import { organizationName, viewerLine } from '../org/shell.ts'
import {
  myBelonging,
  myColleges,
  myDepartments,
  myProfile,
  saveMyProfile,
} from '../org/my-profile.ts'
import { NotFound } from '../errors.ts'

// 셸이 읽는 둘. **화면의 요소가 아니라 화면을 감싼 것의 값이다** — 학생회 이름과
// 보는 사람은 어느 화면에서나 같은 자리에 그려진다.
//
// 그리고 그 자리에서 열리는 화면 하나(MY-INFO-01). 왼쪽 아래 이름을 누르면 나오므로
// 어느 갈피에도 속하지 않는다 — 셸의 것이라 여기 둔다.

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

  // ── 내 정보(MY-INFO-01) ────────────────────────────────────────────────
  //
  // **온보딩에서 받아 둔 것을 되돌려 준다.** 받아 놓고 보여 주는 자리가 없던 동안
  // 사람은 자기가 무엇을 적었는지 확인할 길이 없었다(2026-09-09에 물었다).
  'my.profile': async (c, d) => {
    const who = c.get('sender')!
    // 보는 사람 자신의 학적이다 — 그 사람이 정보주체다.
    c.set('auditSubject', { type: 'user', id: who.userId })
    return myProfile(d.db, orgOf(c), who.userId)
  },
  // **고치는 것과 읽는 것을 가른다.** 소속 부서와 직책은 조직도가 정하므로 학적과
  // 같은 자리에 담으면 '되돌아갈 값'과 '보여 줄 값'의 구분이 사라진다.
  'my.belonging': async (c, d) => {
    const who = c.get('sender')!
    c.set('auditSubject', { type: 'user', id: who.userId })
    return myBelonging(d.db, orgOf(c), who.userId)
  },
  'my.saveProfile': async (c, d) => {
    const who = c.get('sender')!
    c.set('auditSubject', { type: 'user', id: who.userId })
    await saveMyProfile(d.db, orgOf(c), who.userId, await c.req.json())
    return {}
  },
  // **학교를 화면이 넘기지 않는다.** 내 학생회의 대표 학교 아래에서 고르는 것이고,
  // 그 학교는 서버가 안다 — `education.*`와 갈리는 것이 이 한 가지다.
  'my.colleges.options': async (c, d) => myColleges(d.db, orgOf(c)),
  'my.departments.options': async (c, d) => {
    const collegeId = c.req.query('collegeId')
    if (collegeId === undefined) throw new NotFound('단과대학을 먼저 골라 주세요')
    return myDepartments(d.db, orgOf(c), collegeId)
  },
}
