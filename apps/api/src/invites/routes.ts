import { eq } from 'drizzle-orm'
import { Hono } from 'hono'
import {
  EmptyRequestSchema,
  InviteCodeSchema,
  JoinCouncilSchema,
  type InviteCodeResponse,
  type InvitePreviewResponse,
  type JoinCouncilResponse,
} from '@vada/contracts'
import { actorOf } from '../access/actor.js'
import { authorize, councilIdOf, inCouncilChange } from '../access/authorize.js'
import { requireSession, type SessionEnv, type SessionReader } from '../auth/require-session.js'
import { myCouncils } from '../councils/queries.js'
import { inviteCode } from '../db/schema.js'
import { ApiError } from '../http/errors.js'
import { json } from '../http/validate.js'
import { clockNow } from '../records/records.js'
import type { Db } from '../db/types.js'
import { freshInviteCode } from './code.js'
import { invitedCouncil, joinCouncil } from './service.js'

// 초대: 초대 확인과 들어오기(로그인한 누구나), 초대 코드 보기와 바꾸기(회장단, DEC-47).
export function createInviteRoutes(
  db: Db,
  getSession: SessionReader,
  clock: () => Date = () => new Date(),
) {
  const routes = new Hono<SessionEnv>()
  const auth = requireSession(getSession)
  routes.get('/invites/:code', auth, async c => {
    const code = InviteCodeSchema.safeParse(c.req.param('code'))
    if (!code.success) throw new ApiError('NOT_FOUND', 404)
    const found = await invitedCouncil(db, code.data)
    const joined = (await actorOf(db, c.get('userId'), found.id, clock())) !== null
    return c.json({ council: found, joined } satisfies InvitePreviewResponse)
  })
  routes.post('/organizations/join', json(JoinCouncilSchema), auth, async c => {
    const now = clock()
    const userId = c.get('userId')
    // 응답도 같은 거래 안에서 만든다. 커밋한 뒤에 읽다가 실패하면 들어와졌는데 요청은 500이 된다.
    const council = await db.transaction(async tx => {
      const councilId = await joinCouncil(tx, userId, c.req.valid('json').code, now)
      const joined = (await myCouncils(tx, userId, now)).find(item => item.id === councilId)
      if (!joined) throw new Error('Council missing after join')
      return joined
    })
    return c.json({ council } satisfies JoinCouncilResponse)
  })
  routes.get('/organizations/:councilId/invite', auth, async c => {
    const councilId = councilIdOf(c.req.param('councilId'))
    await authorize(db, c.get('userId'), councilId, 'invite.manage', clock())
    const [row] = await db
      .select({ code: inviteCode.code })
      .from(inviteCode)
      .where(eq(inviteCode.councilId, councilId))
    if (!row) throw new Error('Invite code missing')
    return c.json({ code: row.code } satisfies InviteCodeResponse)
  })
  // 바꾸면 옛 코드로는 들어올 수 없다. 이미 들어온 운영진은 그대로다(DEC-47).
  routes.post(
    '/organizations/:councilId/invite/rotate',
    json(EmptyRequestSchema),
    auth,
    async c => {
      const code = await inCouncilChange(
        db,
        c.get('userId'),
        c.req.param('councilId'),
        'invite.manage',
        clock(),
        async (tx, actor) => {
          const next = await freshInviteCode(tx)
          await tx
            .update(inviteCode)
            .set({ code: next, createdBy: actor.memberId, createdAt: clockNow })
            .where(eq(inviteCode.councilId, actor.councilId))
          return next
        },
      )
      return c.json({ code } satisfies InviteCodeResponse)
    },
  )
  return routes
}
