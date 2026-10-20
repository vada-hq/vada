import { Hono, type Context } from 'hono'
import {
  MessagePageQuerySchema,
  NO_CONTENT,
  NOTICE_LIST_MAX,
  ReadMarkerSchema,
  type MessagePageResponse,
  type NoticeListResponse,
  type RoomDetailResponse,
  type RoomListResponse,
} from '@vada/contracts'
import { authorize, councilIdOf, recordIdOf } from '../access/authorize.js'
import { requireSession, type SessionEnv, type SessionReader } from '../auth/require-session.js'
import { ApiError } from '../http/errors.js'
import { json } from '../http/validate.js'
import type { Actor } from '../access/actor.js'
import type { Db, Tx } from '../db/types.js'
import { messagePage, noticesOf } from './messages.js'
import { roomDetailOf, roomListOf } from './queries.js'
import { markRead } from './read-marker.js'
import { roomAccess } from './room-access.js'
import { ensureCouncilRooms } from './rooms.js'

const root = '/organizations/:councilId'

// 읽기는 한 시점의 모습이다. 권한 확인과 조회를 읽기 전용 REPEATABLE READ 거래 하나에서 한다(team 읽기와 같다).
const snapshot = { isolationLevel: 'repeatable read', accessMode: 'read only' } as const

// 길마다 같이 쓰는 것: 길 묶음, 로그인 확인, 권한 요청 만들기, 방을 여는 읽기.
interface Kit {
  routes: Hono<SessionEnv>
  auth: ReturnType<typeof requireSession>
  db: Db
  asked: (c: Context<SessionEnv>) => ReturnType<typeof requestOf>
  inRoom: <T>(
    c: Context<SessionEnv>,
    run: (tx: Tx, actor: Actor, roomId: string, now: Date) => Promise<T>,
  ) => Promise<T>
}

const requestOf = (c: Context<SessionEnv>, now: Date) => ({
  userId: c.get('userId'),
  councilId: councilIdOf(c.req.param('councilId')),
  action: 'council.view' as const,
  now,
})

function listRoutes({ routes, auth, db, asked }: Kit) {
  routes.get(`${root}/rooms`, auth, async c => {
    const request = asked(c)
    // 이 기능 전에 만든 학생회의 방을 채운다. 이미 있으면 쓰지 않는다.
    await ensureCouncilRooms(db, await authorize(db, request))
    const list = await db.transaction(
      async tx => roomListOf(tx, await authorize(tx, request), request.now),
      snapshot,
    )
    return c.json(list satisfies RoomListResponse)
  })
  routes.get(`${root}/notices`, auth, async c => {
    const request = asked(c)
    const notices = await db.transaction(
      async tx => noticesOf(tx, await authorize(tx, request), NOTICE_LIST_MAX),
      snapshot,
    )
    return c.json({ notices } satisfies NoticeListResponse)
  })
}

function roomRoutes({ routes, auth, db, asked, inRoom }: Kit) {
  routes.get(`${root}/rooms/:roomId`, auth, async c => {
    const detail = await inRoom(c, (tx, actor, id, now) => roomDetailOf(tx, actor, now, id))
    return c.json(detail satisfies RoomDetailResponse)
  })
  routes.get(`${root}/rooms/:roomId/messages`, auth, async c => {
    const query = MessagePageQuerySchema.safeParse(c.req.query())
    if (!query.success) throw new ApiError('INVALID_INPUT')
    const page = await inRoom(c, (tx, actor, id) => messagePage(tx, actor, id, query.data))
    return c.json(page satisfies MessagePageResponse)
  })
  routes.post(`${root}/rooms/:roomId/read`, json(ReadMarkerSchema), auth, async c => {
    const request = asked(c)
    const roomId = recordIdOf(c.req.param('roomId'))
    const { messageId } = c.req.valid('json')
    await db.transaction(async tx => markRead(tx, await authorize(tx, request), roomId, messageId))
    return c.body(null, NO_CONTENT)
  })
}

// 대화: 방 목록, 방, 메시지 읽기, 공지, 읽음. 방에 닿으려면 그 방 참여자여야 한다.
export function createChatRoutes(
  db: Db,
  getSession: SessionReader,
  clock: () => Date = () => new Date(),
) {
  const asked = (c: Context<SessionEnv>) => requestOf(c, clock())
  const kit: Kit = {
    routes: new Hono<SessionEnv>(),
    auth: requireSession(getSession),
    db,
    asked,
    // 방 참여자만 지나는 읽기. 방이 이 학생회 것이 아니면 404, 참여자가 아니면 403이다.
    inRoom: (c, run) => {
      const request = asked(c)
      const roomId = recordIdOf(c.req.param('roomId'))
      return db.transaction(async tx => {
        const actor = await authorize(tx, request)
        await roomAccess(tx, actor, roomId)
        return run(tx, actor, roomId, request.now)
      }, snapshot)
    },
  }
  listRoutes(kit)
  roomRoutes(kit)
  return kit.routes
}
