import { Hono, type Context } from 'hono'
import { auditMiddleware, type AuditSink } from './audit.ts'
import { authorizeMiddleware } from './authorize.ts'
import type { Db } from './db/client.ts'
import { can, type Lookups, type Viewer } from './permissions.ts'
import { attach, NotFound } from './routes.ts'
import {
  checkKey,
  MissingKey,
  Replayed,
  type Attempts,
  type Scope,
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
import { checkIn, checkInForm, checkInResult } from './public/attendance.ts'
import { publicRateLimit, type Counter } from './public/rate-limit.ts'
import {
  apply,
  applyForm,
  applyResult,
  collegeOptions,
  departmentOptions,
  linkState,
} from './public/survey.ts'
import { hashToken, tokenOfRequest } from './public/tokens.ts'
import {
  attendanceQr,
  deactivateAttendanceQr,
  regenerateAttendanceQr,
} from './events/attendance-qr.ts'
import {
  createEvent,
  eventBasics,
  eventList,
  eventSummary,
  eventWorkspace,
} from './events/events.ts'
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
    /** 이 요청을 보낸 사람. **요청마다 한 번만 정해진다.** */
    sender: Viewer | null
  }
}

export interface Deps {
  audit: AuditSink
  db: Db
  /** 지금 묻는 사람. 인증이 붙기 전에는 밖에서 준다. */
  /**
   * 세션을 읽어 이 요청을 보낸 사람을 알아낸다.
   *
   * 검사는 곧바로 답하고 서버는 표를 읽는다 — 이 자리가 갈리는 곳이다.
   */
  who: (c: Context) => Promise<Viewer | null>
  /** '그 행사의 조직원인가' 같은 것. 저장소가 답한다. */
  lookups: Lookups
  /** 두 번 보내진 것을 가리는 자리. */
  attempts: Attempts
  /** 초대 링크가 어디에 놓이는지와 때. 배포가 정하므로 밖에서 받는다. */
  invite: InviteSettings
  /** 새로 만드는 것의 이름표. 밖에서 받으므로 검사가 정할 수 있다. */
  newId: () => string
  /** 밖에서 열리는 자리를 두드리는 것을 세는 곳. */
  counter: Counter
}

/** 이 사람이 어느 학생회의 것을 보고 있는가. 구성원이 아니면 여기까지 오지 않는다. */
function orgOf(c: Context): string {
  const membership = c.get('sender')?.membership
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
  const orgId = orgOf(c)
  c.set('auditSubject', { type: 'organization', id: orgId })
  return regenerateInvite(d.db, orgId, d.invite)
}

/**
 * 화면에 내려보내는 판정. **막는 검사와 같은 함수에서 나온다** — 두 곳에서 나오면
 * 언젠가 갈리고, 갈리는 쪽은 늘 화면이다(단추를 그렸는데 눌리면 막힌다).
 */
function canDo(
  c: Context,
  deps: Deps,
  area: string,
  object: string | null = null,
): Promise<boolean> {
  return can(c.get('sender'), area, object, deps.lookups)
}

/**
 * 이 요청의 시도를 **어느 칸에** 담는가.
 *
 * 안쪽은 학생회가 칸을 가른다. 밖에서 오는 자리에는 가를 것이 없으므로 **그 링크가
 * 칸이 된다** — 한 설문의 키가 다른 설문의 답을 열지 못하게 하는 최소한이다.
 *
 * **밖에서는 이 미들웨어가 유일한 문지기다.** 오랫동안 여기서 구성원이 아니면
 * 그냥 지나갔는데, 그러면 계약이 `Idempotency-Key`를 요구한다고 적어 둔 두 자리
 * (참석·신청)가 그 요구를 아무도 지키지 않은 채 돌았다.
 */
function scopeOf(c: Context): Scope | null {
  const membership = c.get('sender')?.membership
  if (membership !== null && membership !== undefined) {
    return { name: `org:${membership.orgId}`, fromOutside: false }
  }
  if (!c.req.path.startsWith('/api/public/')) return null
  const token = tokenOfRequest(c)
  if (token === null) return null
  // 세는 자리에 열쇠를 그대로 두지 않는다.
  return { name: `public:${hashToken(token)}`, fromOutside: true }
}

export function createApp(deps: Deps) {
  const app = new Hono()

  // **가장 먼저 돈다.** 막힌 요청도 남아야 하고, 누가 보냈는지는 여기서 한 번
  // 확정해 문맥에 담는다 — 구성원이 아니어도 누구인지는 남는다.
  app.use('*', auditMiddleware(deps.audit, { who: (c) => deps.who(c) }))
  // **밖에서 열리는 자리는 세션이 벽이 아니다.** 토큰이 유일한 벽이므로 마구 넣어
  // 보는 것을 막지 않으면 그 벽이 벽이 아니다. 권한보다 앞에 둔다 — 막을 것은
  // 판정에 닿기 전에 막는다.
  app.use('*', publicRateLimit({ counter: deps.counter, now: () => deps.invite.now().getTime() }))

  app.use('*', authorizeMiddleware({ lookups: deps.lookups }))

  // **두 번 눌린 것을 여기서 가린다.** 계약이 어느 자리에 키가 필요한지 알고 있으므로
  // 자리마다 손으로 부르지 않는다 — 부르면 잊는 자리가 생기고, 잊은 자리는 두 번 돈다.
  app.use('*', async (c, next) => {
    const scope = scopeOf(c)
    if (scope === null) return next()
    let checked
    try {
      checked = await checkKey(c, scope, deps.attempts)
    } catch (error) {
      if (error instanceof MissingKey) return c.json({ message: error.message }, 422)
      throw error
    }
    if (checked instanceof Replayed) {
      // 처음의 답을 그대로 준다. 두 번째가 다른 답을 받으면 두 번 눌린 것이
      // 두 가지 사실이 된다.
      //
      // **밖에서 온 답에는 영수증이 들어 있다.** 처음 답과 같은 조건으로 준다 —
      // 한쪽만 쌓이지 않게 하면 그 답이 어딘가에 남는다.
      if (scope.fromOutside) c.header('Cache-Control', 'no-store')
      return c.json(checked.answered as never, 200)
    }
    await next()
    if (checked !== null && c.res.status === 200) {
      await deps.attempts.remember(
        scope.name,
        checked.operationId,
        checked.key,
        await c.res.clone().json(),
      )
    }
  })

  attach(app, deps, {
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

    // ── 밖에서 오는 사람 (EXT-01A · EXT-01B) ───────────────────────────────
    //
    // 로그인이 없다. 어느 QR인지는 주소가, 누가 냈는지는 폼이 말한다.
    'attendance.checkInForm': async (c, d) =>
      checkInForm(d.db, c.req.query('checkInToken') ?? '', d.invite),
    // **영수증으로만 연다.** QR 토큰으로 열면 같은 QR을 찍은 남의 결과가 열린다.
    'attendance.checkInResult': async (c, d) => {
      c.header('Cache-Control', 'no-store')
      return checkInResult(d.db, c.req.query('receiptToken') ?? '', d.invite)
    },
    'attendance.checkIn': async (c, d) => {
      const draft = (await c.req.json().catch(() => ({}))) as {
        name?: unknown
        studentNumber?: unknown
      }
      const made = await checkIn(d.db, c.req.param('checkInToken')!, draft, {
        newId: d.newId,
        now: d.invite.now,
      })
      // **영수증을 기록에 남기지 않는다.** 감사 기록이 새면 그것으로 결과가 열린다.
      c.set('auditSubject', { type: 'studentNumber', id: String(draft.studentNumber ?? '') })
      // 열쇠를 담은 답은 어디에도 쌓이면 안 된다.
      c.header('Cache-Control', 'no-store')
      return made
    },

    // ── 링크로 온 신청자 (EXT-02A · EXT-02B · EXT-02C) ─────────────────────
    //
    // **막힌 링크와 열린 링크가 서로 다른 자리로 간다.** 판정은 한 곳에 있고
    // 두 자리가 그것을 뒤집어 쓴다 — 갈림이 두 곳에 적히면 둘 다 답하는 때가 온다.
    'survey.applyForm': async (c, d) =>
      applyForm(d.db, c.req.query('surveyToken') ?? '', d.invite),
    'survey.linkState': async (c, d) => linkState(d.db, c.req.query('surveyToken') ?? '', d.invite),
    // **영수증으로만 연다.** 같은 링크를 여럿이 연다.
    'survey.applyResult': async (c, d) => {
      c.header('Cache-Control', 'no-store')
      return applyResult(d.db, c.req.query('receiptToken') ?? '', d.invite)
    },
    'survey.apply': async (c, d) => {
      const draft = (await c.req.json().catch(() => ({}))) as Record<string, unknown>
      const made = await apply(d.db, c.req.param('surveyToken')!, draft, {
        newId: d.newId,
        now: d.invite.now,
      })
      // 누구의 것을 다뤘는지는 남기고 영수증은 남기지 않는다.
      c.set('auditSubject', { type: 'studentNumber', id: String(draft.studentNumber ?? '') })
      c.header('Cache-Control', 'no-store')
      return made
    },
    'survey.colleges.options': async (c, d) =>
      collegeOptions(d.db, c.req.query('surveyToken') ?? ''),
    'survey.departments.options': async (c, d) =>
      departmentOptions(d.db, c.req.query('surveyToken') ?? '', c.req.query('collegeId') ?? ''),

    // ── 행사 (EVT-00A · EVT-00B · EVT-02) ──────────────────────────────────
    'event.list': async (c, d) => {
      const orgId = orgOf(c)
      c.set('auditSubject', { type: 'organization', id: orgId })
      return eventList(
        d.db,
        orgId,
        { query: c.req.query('query'), status: c.req.query('status') },
        d.invite,
      )
    },
    // 만들 수 있는 사람에게만 머리에 그 단추가 그려진다. **역할 이름이 아니라
    // 할 수 있는 일로 가른다** — 판정은 정책 하나에서 나온다.
    'event.listViewer': async (c, d) =>
      canDo(c, d, 'event.create').then((canCreateEvent) => ({ canCreateEvent })),
    'event.summary': async (c, d) => {
      const eventId = c.req.query('eventId')!
      c.set('auditSubject', { type: 'event', id: eventId })
      const row = await eventSummary(d.db, orgOf(c), eventId, d.invite)
      if (row === null) throw new NotFound('그 행사를 찾지 못했습니다')
      return row
    },
    'event.workspace': async (c, d) => {
      const eventId = c.req.query('eventId')!
      c.set('auditSubject', { type: 'event', id: eventId })
      const row = await eventWorkspace(d.db, orgOf(c), eventId, {
        canManage: await canDo(c, d, 'event.manage', eventId),
      })
      if (row === null) throw new NotFound('그 행사를 찾지 못했습니다')
      return row
    },
    'event.basics': async (c, d) => {
      const eventId = c.req.query('eventId')!
      c.set('auditSubject', { type: 'event', id: eventId })
      const row = await eventBasics(d.db, orgOf(c), eventId)
      if (row === null) throw new NotFound('그 행사를 찾지 못했습니다')
      return row
    },
    // ── 참석 확인 QR (EVT-04B) ─────────────────────────────────────────────
    //
    // 밖에서 오는 사람 쪽은 이미 지었다. 여기는 그 QR을 **만들고 죽이는** 쪽이다.
    'event.attendanceQr': async (c, d) => {
      const eventId = c.req.param('eventId')!
      c.set('auditSubject', { type: 'event', id: eventId })
      return attendanceQr(d.db, orgOf(c), eventId, d.invite)
    },
    // **되돌릴 수 없다.** 뿌린 포스터의 QR이 전부 죽는다.
    'event.attendanceQr.regenerate': async (c, d) => {
      const eventId = c.req.param('eventId')!
      c.set('auditSubject', { type: 'event', id: eventId })
      return regenerateAttendanceQr(d.db, orgOf(c), eventId, {
        newId: d.newId,
        now: d.invite.now,
      })
    },
    'event.attendanceQr.deactivate': async (c, d) => {
      const eventId = c.req.param('eventId')!
      c.set('auditSubject', { type: 'event', id: eventId })
      return deactivateAttendanceQr(d.db, orgOf(c), eventId)
    },
    'event.create': async (c, d) => {
      const orgId = orgOf(c)
      const draft = (await c.req.json().catch(() => ({}))) as { title?: unknown }
      const made = await createEvent(d.db, orgId, draft, { id: d.newId, now: d.invite.now })
      c.set('auditSubject', { type: 'event', id: made.id })
      return made
    },

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
  })

  return app
}
