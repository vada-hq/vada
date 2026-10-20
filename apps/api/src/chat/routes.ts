import { Hono, type Context } from 'hono'
import {
  MarkNoticeSchema,
  MessagePageQuerySchema,
  NO_CONTENT,
  NOTICE_LIST_MAX,
  OpenDirectSchema,
  ReadMarkerSchema,
  SendMessageSchema,
  type Action,
  type ChatMessage,
  type OpenDirectResponse,
  type MessagePageResponse,
  type NoticeListResponse,
  type RoomDetailResponse,
  type RoomListResponse,
} from '@vada/contracts'
import { authorize, councilIdOf, inCouncilChange, recordIdOf } from '../access/authorize.js'
import { requireSession, type SessionEnv, type SessionReader } from '../auth/require-session.js'
import { ApiError } from '../http/errors.js'
import { createRateLimiter, type RateLimiter } from '../http/rate-limit.js'
import { json } from '../http/validate.js'
import type { Actor } from '../access/actor.js'
import type { Db, Tx } from '../db/types.js'
import { openDirect } from './direct.js'
import { messagePage, noticesOf } from './messages.js'
import { markNotice } from './notice.js'
import type { ChatPush } from './notify.js'
import { roomDetailOf, roomListOf } from './queries.js'
import { markRead } from './read-marker.js'
import { roomAccess } from './room-access.js'
import { ensureCouncilRooms } from './rooms.js'
import { SEND_LIMIT, sendMessage } from './send.js'

const root = '/organizations/:councilId'
const CREATED = 201

// 읽기는 한 시점의 모습이다. 권한 확인과 조회를 읽기 전용 REPEATABLE READ 거래 하나에서 한다(team 읽기와 같다).
const snapshot = { isolationLevel: 'repeatable read', accessMode: 'read only' } as const

// 길마다 같이 쓰는 것: 길 묶음, 로그인 확인, 권한 요청 만들기, 방을 여는 읽기.
interface Kit {
  routes: Hono<SessionEnv>
  auth: ReturnType<typeof requireSession>
  db: Db
  asked: (c: Context<SessionEnv>) => ReturnType<typeof requestOf>
  sendLimiter: RateLimiter
  push: ChatPush | undefined
  clock: () => Date
  // 학생회 행을 잠그고 권한(action)을 다시 본 뒤 바꾸는 거래
  change: <T>(
    c: Context<SessionEnv>,
    action: Action,
    run: (tx: Tx, actor: Actor, now: Date) => Promise<T>,
  ) => Promise<T>
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

function roomRoutes({ routes, auth, db, asked, inRoom, push }: Kit) {
  routes.get(`${root}/rooms/:roomId`, auth, async c => {
    const detail = await inRoom(c, (tx, actor, id, now) => roomDetailOf(tx, actor, now, id))
    return c.json(detail satisfies RoomDetailResponse)
  })
  routes.get(`${root}/rooms/:roomId/messages`, auth, async c => {
    const query = MessagePageQuerySchema.safeParse(c.req.query())
    if (!query.success) throw new ApiError('INVALID_INPUT')
    const page = await inRoom(c, async (tx, actor, id, now) => {
      const read = await messagePage(tx, actor, id, query.data)
      // 최신까지 읽으면 그 방을 보는 중이다. 화면은 열린 방을 after 커서로 이어 읽으므로 그것도 센다.
      // 이전 쪽(before)을 거슬러 읽는 것과 최신까지 닿지 못한 읽기는 보는 중이 아니다.
      if (query.data.before === undefined && !read.hasNewer) push?.seen(id, actor.memberId, now)
      return read
    })
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

function writeRoutes({ routes, auth, db, asked, sendLimiter, change, push, clock }: Kit) {
  routes.post(`${root}/rooms/:roomId/messages`, json(SendMessageSchema), auth, async c => {
    const request = asked(c)
    // 계정마다 센다. 로그인한 사람만 세므로 인증 뒤에 둔다.
    if (!sendLimiter.take(request.userId, request.now)) throw new ApiError('TOO_MANY_REQUESTS')
    const roomId = recordIdOf(c.req.param('roomId'))
    const { body, mentions } = c.req.valid('json')
    // READ COMMITTED 거래: 보내기가 줄을 잠그고 기다린 뒤의 값을 봐야 한다(send.ts).
    const sent = await db.transaction(async tx =>
      sendMessage(tx, await authorize(tx, request), { roomId, body, mentions }, request.now),
    )
    // 알림은 커밋 뒤에 떼어 보낸다. 응답은 기다리지 않고, notify는 던지지 않는다.
    void push?.notify(sent.id, clock())
    return c.json(sent satisfies ChatMessage, CREATED)
  })
  routes.post(`${root}/messages/:messageId/notice`, json(MarkNoticeSchema), auth, async c => {
    const messageId = recordIdOf(c.req.param('messageId'))
    const { isNotice } = c.req.valid('json')
    const marked = await change(c, 'chat.notice', (tx, actor) =>
      markNotice(tx, actor, messageId, isNotice),
    )
    return c.json(marked satisfies ChatMessage)
  })
  routes.post(`${root}/direct`, json(OpenDirectSchema), auth, async c => {
    const { memberId } = c.req.valid('json')
    const roomId = await change(c, 'chat.direct', (tx, actor, now) =>
      openDirect(tx, actor, memberId, now),
    )
    return c.json({ roomId } satisfies OpenDirectResponse)
  })
}

// 대화: 방 목록, 방, 메시지 읽기와 보내기, 공지, 읽음, 1:1. 방에 닿으려면 그 방 참여자여야 한다.
export function createChatRoutes(
  db: Db,
  getSession: SessionReader,
  options: { clock?: () => Date; sendLimiter?: RateLimiter; push?: ChatPush | undefined } = {},
) {
  const clock = options.clock ?? (() => new Date())
  const asked = (c: Context<SessionEnv>) => requestOf(c, clock())
  const kit: Kit = {
    routes: new Hono<SessionEnv>(),
    auth: requireSession(getSession),
    db,
    asked,
    sendLimiter: options.sendLimiter ?? createRateLimiter(SEND_LIMIT),
    push: options.push,
    clock,
    change: (c, action, run) => {
      const now = clock()
      return inCouncilChange(
        db,
        { userId: c.get('userId'), councilId: c.req.param('councilId'), action, now },
        (tx, actor) => run(tx, actor, now),
      )
    },
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
  writeRoutes(kit)
  return kit.routes
}
