import { Hono } from 'hono'
import { auditMiddleware, type AuditSink } from './audit.ts'
import { authorizeMiddleware } from './authorize.ts'
import type { Db } from './db/client.ts'
import type { Lookups, Viewer } from './permissions.ts'
import { attach, NotFound } from './routes.ts'
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
}

/** 이 사람이 어느 학생회의 것을 보고 있는가. 구성원이 아니면 여기까지 오지 않는다. */
function orgOf(deps: Deps): string {
  const membership = deps.who()?.membership
  if (membership === null || membership === undefined) {
    throw new NotFound('학생회를 찾지 못했습니다')
  }
  return membership.orgId
}

export function createApp(deps: Deps) {
  const app = new Hono()

  app.use('*', auditMiddleware(deps.audit))
  app.use('*', authorizeMiddleware({ viewer: () => deps.who(), lookups: deps.lookups }))

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
    'org.roleAssignmentCount': async (c, d) => {
      const orgId = orgOf(d)
      c.set('auditSubject', { type: 'organization', id: orgId })
      return roleAssignmentCount(d.db, orgId)
    },
  })

  return app
}
