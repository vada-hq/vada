import { Hono } from 'hono'
import { auditMiddleware, type AuditSink } from './audit.ts'
import { authorizeMiddleware } from './authorize.ts'
import type { Db } from './db/client.ts'
import type { Lookups, Viewer } from './permissions.ts'
import { attach, NotFound } from './routes.ts'
import {
  checkKey,
  MissingKey,
  Replayed,
  type Attempts,
} from './idempotency.ts'
import {
  chartTitle,
  departmentTree,
  executives,
  unassignedHint,
  unassignedMembers,
} from './org/chart.ts'
import { currentInvite, regenerateInvite, type InviteSettings } from './org/invite.ts'
import { changeRole, roleAssignmentOf } from './org/role-change.ts'
import {
  permissionMatrix,
  roleAssignmentCount,
  roleAssignments,
  roleCounts,
} from './org/roles.ts'
import { organizationName, viewerLine } from './org/shell.ts'

// 서버의 얼개.
//
// **자리와 모양은 명세가 정한다.** `specs/figma/vada-wireframe/`의 카탈로그가
// method·path·인자·조각·값의 종류·권한·실패까지 갖고 있고, `npm run openapi`가 그것을
// OpenAPI로 옮긴다. 여기서 하는 일은 그 자리에 답을 놓는 것뿐이다.
//
// 지나가는 순서가 셋이다. **기록 → 권한 → 답.** 기록이 맨 앞인 까닭은 막힌 요청도
// 남아야 하기 때문이고(오히려 봐야 할 것이 그쪽이다), 권한이 답보다 앞인 까닭은
// 자리마다 손으로 검사하면 잊은 자리가 조용히 열리기 때문이다.

declare module 'hono' {
  interface ContextVariableMap {
    userId: string | undefined
    orgId: string | undefined
    /**
     * 이 요청이 **누구의 정보를 다뤘는가.** 핸들러가 알려 주고 감사 기록이 남긴다.
     *
     * 기준이 요구하는 것은 '누가 접속했나'만이 아니라 '누구의 것을 다뤘나'다.
     */
    auditSubject: { type: string; id: string } | undefined
  }
}

export interface Deps {
  audit: AuditSink
  db: Db
  /** 지금 묻는 사람. 인증이 붙기 전에는 밖에서 준다. */
  who: () => Viewer | null
  /** '그 행사의 조직원인가' 같은 것. 저장소가 답한다. */
  lookups: Lookups
  /** 두 번 보내진 것을 가리는 자리. */
  attempts: Attempts
  /** 초대 링크가 어디에 놓이는지와 때. 배포가 정하므로 밖에서 받는다. */
  invite: InviteSettings
}

/** 이 사람이 어느 학생회의 것을 보고 있는가. 구성원이 아니면 여기까지 오지 않는다. */
function orgOf(deps: Deps): string {
  const membership = deps.who()?.membership
  if (membership === null || membership === undefined) {
    throw new NotFound('학생회를 찾지 못했습니다')
  }
  return membership.orgId
}

/**
 * 초대를 다시 만드는 셋.
 *
 * 링크만·코드만·둘 다로 자리가 셋인데 **한 건이 둘을 함께 갖는다** — 코드를 바꾸면
 * 링크의 뒤쪽도 함께 바뀐다. 셋이 같은 일을 하는 것을 숨기지 않는다.
 */
function regenerate(c: import('hono').Context, d: Deps) {
  const orgId = orgOf(d)
  c.set('auditSubject', { type: 'organization', id: orgId })
  return regenerateInvite(d.db, orgId, d.invite)
}

export function createApp(deps: Deps) {
  const app = new Hono()

  app.use('*', auditMiddleware(deps.audit))
  app.use('*', authorizeMiddleware({ viewer: () => deps.who(), lookups: deps.lookups }))

  // **두 번 눌린 것을 여기서 가린다.** 계약이 어느 자리에 키가 필요한지 알고 있으므로
  // 자리마다 손으로 부르지 않는다 — 부르면 잊는 자리가 생기고, 잊은 자리는 두 번 돈다.
  app.use('*', async (c, next) => {
    const membership = deps.who()?.membership
    if (membership === null || membership === undefined) return next()
    let checked
    try {
      checked = await checkKey(c, membership.orgId, deps.attempts)
    } catch (error) {
      if (error instanceof MissingKey) return c.json({ message: error.message }, 422)
      throw error
    }
    if (checked instanceof Replayed) {
      // 처음의 답을 그대로 준다. 두 번째가 다른 답을 받으면 두 번 눌린 것이
      // 두 가지 사실이 된다.
      return c.json(checked.answered as never, 200)
    }
    await next()
    if (checked !== null && c.res.status === 200) {
      await deps.attempts.remember(
        membership.orgId,
        checked.operationId,
        checked.key,
        await c.res.clone().json(),
      )
    }
  })

  attach(app, deps, {
    // ── 셸 ────────────────────────────────────────────────────────────────
    'shell.organization': async (c, d) => {
      const orgId = orgOf(d)
      c.set('auditSubject', { type: 'organization', id: orgId })
      const row = await organizationName(d.db, orgId)
      if (row === null) throw new NotFound('학생회를 찾지 못했습니다')
      return row
    },
    'shell.viewer': async (c, d) => {
      const who = d.who()!
      const orgId = orgOf(d)
      // 보는 사람 자신의 학적 정보를 읽는다 — 그 사람이 정보주체다.
      c.set('auditSubject', { type: 'user', id: who.userId })
      const row = await viewerLine(d.db, orgId, who.userId)
      if (row === null) throw new NotFound('이 학생회의 구성원이 아닙니다')
      return row
    },

    // ── 조직도 (ORG-03A · ORG-03B) ─────────────────────────────────────────
    'org.chartTitle': async (_c, d) => {
      const orgId = orgOf(d)
      const row = await chartTitle(d.db, orgId)
      if (row === null) throw new NotFound('학생회를 찾지 못했습니다')
      return row
    },
    'org.executives': async (c, d) => {
      const orgId = orgOf(d)
      c.set('auditSubject', { type: 'organization', id: orgId })
      return executives(d.db, orgId)
    },
    'org.departments': async (c, d) => {
      const orgId = orgOf(d)
      c.set('auditSubject', { type: 'organization', id: orgId })
      return departmentTree(d.db, orgId, c.req.query('query'))
    },
    'org.unassignedMembers': async (c, d) => {
      const orgId = orgOf(d)
      c.set('auditSubject', { type: 'organization', id: orgId })
      return unassignedMembers(d.db, orgId, c.req.query('query'))
    },
    'org.unassignedHint': async (_c, d) => unassignedHint(d.db, orgOf(d)),

    // ── 초대 (ORG-03C) ─────────────────────────────────────────────────────
    'org.invite': async (_c, d) => {
      const orgId = orgOf(d)
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
      const orgId = orgOf(d)
      c.set('auditSubject', { type: 'organization', id: orgId })
      return roleCounts(d.db, orgId)
    },
    // **저장소를 열지 않는다.** 행렬은 모든 학생회가 같으므로 정책이 곧 답이다.
    'org.permissionMatrix': async () => permissionMatrix(),

    // ── 역할 바꾸기가 읽는 것 (ORG-04B) ────────────────────────────────────
    'org.roleAssignments': async (c, d) => {
      const orgId = orgOf(d)
      // 남의 학적 정보를 다루는 자리다. 누구의 것을 다뤘는지 남긴다.
      c.set('auditSubject', { type: 'organization', id: orgId })
      return roleAssignments(d.db, orgId)
    },
    // 고른 사람 한 건. **누구인지는 자리가 말한다** — 서버가 기억하지 않는다.
    'org.selectedRoleAssignment': async (c, d) => {
      const orgId = orgOf(d)
      const memberId = c.req.param('memberId')!
      c.set('auditSubject', { type: 'member', id: memberId })
      const row = await roleAssignmentOf(d.db, orgId, memberId)
      if (row === null) throw new NotFound('그 구성원을 찾지 못했습니다')
      return row
    },
    // **법이 이 자리를 3년 본다.** 권한을 바꾼 기록은 따로 남는다.
    'org.changeRole': async (c, d) => {
      const orgId = orgOf(d)
      const memberId = c.req.param('memberId')!
      c.set('auditSubject', { type: 'member', id: memberId })
      const body = (await c.req.json().catch(() => ({}))) as { baseRole?: unknown }
      await changeRole(d.db, orgId, {
        memberId,
        baseRole: body.baseRole,
        actorUserId: d.who()?.userId ?? null,
        now: d.invite.now,
      })
      return {}
    },
    'org.roleAssignmentCount': async (c, d) => {
      const orgId = orgOf(d)
      c.set('auditSubject', { type: 'organization', id: orgId })
      return roleAssignmentCount(d.db, orgId)
    },
  })

  return app
}
