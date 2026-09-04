import type { Context } from 'hono'
import { orgOf, type Deps, type Handlers } from '../deps.ts'
import {
  chartTitle,
  departmentTree,
  executives,
  unassignedHint,
  unassignedMembers,
} from '../org/chart.ts'
import { currentInvite, regenerateInvite } from '../org/invite.ts'
import { changeRole, roleAssignmentOf } from '../org/role-change.ts'
import {
  permissionMatrix,
  roleAssignmentCount,
  roleAssignments,
  roleCounts,
} from '../org/roles.ts'
import {
  areaSummaries,
  duesTermOptions,
  orgDepartmentOptions,
  roster,
  rosterPaging,
  rosterScope,
} from '../org/roster.ts'
import { NotFound } from '../routes.ts'

// 학생회를 보고 고치는 자리들 — 명단·조직도·초대·역할.
//
// 여기 있는 것은 전부 **이미 어느 학생회의 구성원인 사람**이 부른다. 그래서 하나같이
// `orgOf(c)`로 시작한다 — 들어오는 쪽(`joining.ts`)이 그것을 안 쓰는 것과 갈린다.

/**
 * 초대를 다시 만드는 셋.
 *
 * 링크만·코드만·둘 다로 자리가 셋인데 **한 건이 둘을 함께 갖는다** — 코드를 바꾸면
 * 링크의 뒤쪽도 함께 바뀐다. 셋이 같은 일을 하는 것을 숨기지 않는다.
 */
function regenerate(c: Context, d: Deps) {
  const orgId = orgOf(c)
  c.set('auditSubject', { type: 'organization', id: orgId })
  return regenerateInvite(d.db, orgId, d.invite)
}

export const orgHandlers: Handlers = {
  // ── 학생 명단 (ORG-07A · ORG-00) ───────────────────────────────────────
  //
  // **거르는 것도 세는 것도 서버가 한다.** 천 명짜리 명단을 통째로 보내면 화면이
  // 그것을 들고 거르게 되고, 그때부터 '몇 명인가'의 답이 화면마다 갈린다.
  'org.students': async (c, d) =>
    roster(d.db, orgOf(c), {
      query: c.req.query('query'),
      grade: c.req.query('grade'),
      duesStatus: c.req.query('duesStatus'),
      page: c.req.query('page'),
    }),
  'org.studentPaging': async (c, d) =>
    rosterPaging(d.db, orgOf(c), {
      query: c.req.query('query'),
      grade: c.req.query('grade'),
      duesStatus: c.req.query('duesStatus'),
    }),
  'org.rosterScope': async (c, d) => rosterScope(d.db, orgOf(c)),
  'org.areaSummaries': async (c, d) => areaSummaries(d.db, orgOf(c)),
  // **조직도가 읽는 자리와 다른 자리다.** 저기는 나무를 주고 여기는 값과 글만 준다.
  'org.departments.options': async (c, d) => orgDepartmentOptions(d.db, orgOf(c)),
  // **학기 표는 없다.** 운영 연도에서 나오는 것이라, 표를 두면 그 표를 채우는
  // 화면이 또 있어야 하는데 그 화면이 명세에 없다.
  'org.duesTerms.options': async (c, d) => duesTermOptions(d.db, orgOf(c)),


  // ── 조직도 (ORG-03A · ORG-03B) ─────────────────────────────────────────
  'org.chartTitle': async (c, d) => {
    const orgId = orgOf(c)
    const row = await chartTitle(d.db, orgId)
    if (row === null) throw new NotFound('학생회를 찾지 못했습니다')
    return row
  },
  'org.executives': async (c, d) => {
    const orgId = orgOf(c)
    c.set('auditSubject', { type: 'organization', id: orgId })
    return executives(d.db, orgId)
  },
  'org.departments': async (c, d) => {
    const orgId = orgOf(c)
    c.set('auditSubject', { type: 'organization', id: orgId })
    return departmentTree(d.db, orgId, c.req.query('query'))
  },
  'org.unassignedMembers': async (c, d) => {
    const orgId = orgOf(c)
    c.set('auditSubject', { type: 'organization', id: orgId })
    return unassignedMembers(d.db, orgId, c.req.query('query'))
  },
  'org.unassignedHint': async (c, d) => unassignedHint(d.db, orgOf(c)),


  // ── 초대 (ORG-03C) ─────────────────────────────────────────────────────
  'org.invite': async (c, d) => {
    const orgId = orgOf(c)
    const row = await currentInvite(d.db, orgId, d.invite)
    if (row === null) throw new NotFound('초대를 찾지 못했습니다')
    return row
  },
  // 셋 다 되돌릴 수 없고 셋 다 멱등 키를 받는다.
  'org.regenerateInvite': regenerate,
  'org.regenerateInviteCode': regenerate,
  'org.regenerateInviteLink': regenerate,


  // ── 역할 및 권한 (ORG-04) ──────────────────────────────────────────────
  'org.roleCounts': async (c, d) => {
    const orgId = orgOf(c)
    c.set('auditSubject', { type: 'organization', id: orgId })
    return roleCounts(d.db, orgId)
  },
  // **저장소를 열지 않는다.** 행렬은 모든 학생회가 같으므로 정책이 곧 답이다.
  'org.permissionMatrix': async () => permissionMatrix(),


  // ── 역할 바꾸기가 읽는 것 (ORG-04B) ────────────────────────────────────
  'org.roleAssignments': async (c, d) => {
    const orgId = orgOf(c)
    // 남의 학적 정보를 다루는 자리다. 누구의 것을 다뤘는지 남긴다.
    c.set('auditSubject', { type: 'organization', id: orgId })
    return roleAssignments(d.db, orgId)
  },
  // 고른 사람 한 건. **누구인지는 자리가 말한다** — 서버가 기억하지 않는다.
  'org.selectedRoleAssignment': async (c, d) => {
    const orgId = orgOf(c)
    const memberId = c.req.param('memberId')!
    c.set('auditSubject', { type: 'member', id: memberId })
    const row = await roleAssignmentOf(d.db, orgId, memberId)
    if (row === null) throw new NotFound('그 구성원을 찾지 못했습니다')
    return row
  },
  // **법이 이 자리를 3년 본다.** 권한을 바꾼 기록은 따로 남는다.
  'org.changeRole': async (c, d) => {
    const orgId = orgOf(c)
    const memberId = c.req.param('memberId')!
    c.set('auditSubject', { type: 'member', id: memberId })
    const body = (await c.req.json().catch(() => ({}))) as { baseRole?: unknown }
    await changeRole(d.db, orgId, {
      memberId,
      baseRole: body.baseRole,
      actorUserId: c.get('sender')?.userId ?? null,
      now: d.invite.now,
    })
    return {}
  },
  'org.roleAssignmentCount': async (c, d) => {
    const orgId = orgOf(c)
    c.set('auditSubject', { type: 'organization', id: orgId })
    return roleAssignmentCount(d.db, orgId)
  },
}
