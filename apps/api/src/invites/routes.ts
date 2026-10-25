import { eq } from 'drizzle-orm'
import { Hono } from 'hono'
import {
  EmptyRequestSchema,
  InviteCodeSchema,
  JoinCouncilSchema,
  type InviteCodeResponse,
  type InvitePreviewResponse,
  type JoinCouncilRequest,
  type JoinCouncilResponse,
} from '@vada/contracts'
import { authorize, councilIdOf, inCouncilChange } from '../access/authorize.js'
import { requireSession, type SessionEnv, type SessionReader } from '../auth/require-session.js'
import { myCouncils } from '../councils/queries.js'
import { inviteCode } from '../db/schema.js'
import { ApiError } from '../http/errors.js'
import { json } from '../http/validate.js'
import type { Db } from '../db/types.js'
import { invitePreview, joinCouncil, rotateInviteCode } from './service.js'

// 응답도 같은 거래 안에서 만든다. 커밋한 뒤에 읽다가 실패하면 들어와졌는데 요청은 500이 된다.
async function joinedCouncil(db: Db, userId: string, input: JoinCouncilRequest, now: Date) {
  return db.transaction(async tx => {
    const councilId = await joinCouncil(tx, userId, input, now)
    const joined = (await myCouncils(tx, userId, now)).find(item => item.id === councilId)
    if (!joined) throw new Error('Council missing after join')
    return joined
  })
}

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
    if (!code.success) throw new ApiError('NOT_FOUND')
    const preview = await invitePreview(db, c.get('userId'), code.data, clock())
    return c.json(preview satisfies InvitePreviewResponse)
  })
  routes.post('/organizations/join', json(JoinCouncilSchema), auth, async c => {
    const council = await joinedCouncil(db, c.get('userId'), c.req.valid('json'), clock())
    return c.json({ council } satisfies JoinCouncilResponse)
  })
  routes.get('/organizations/:councilId/invite', auth, async c => {
    const councilId = councilIdOf(c.req.param('councilId'))
    await authorize(db, {
      userId: c.get('userId'),
      councilId,
      action: 'invite.manage',
      now: clock(),
    })
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
      const request = {
        userId: c.get('userId'),
        councilId: c.req.param('councilId'),
        action: 'invite.manage' as const,
        now: clock(),
      }
      const code = await inCouncilChange(db, request, rotateInviteCode)
      return c.json({ code } satisfies InviteCodeResponse)
    },
  )
  return routes
}
