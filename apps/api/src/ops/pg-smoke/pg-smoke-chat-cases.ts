import { and, eq } from 'drizzle-orm'
import { authorize } from '../../access/authorize.js'
import { sendMessage } from '../../chat/send.js'
import { syncRooms } from '../../chat/rooms.js'
import { chatRoom, record, roomMembership } from '../../db/schema.js'
import type { Db } from '../../db/types.js'
import { removeMember } from '../../team/service.js'
import type { SmokeSql } from './pg-smoke-connection.js'
import {
  changer,
  createdCouncil,
  fail,
  googleUser,
  inviteCodeOf,
  joined,
  memberIdOf,
  outcomeOf,
  pass,
  unexpectedFailures,
  withConnections,
  type SmokeCase,
  type SmokeContext,
} from './pg-smoke-kit.js'

// 대화 보내기를 둘러싼 동시 처리 사례 g, h. 서비스 함수를 그대로 불러 운영과 같은 잠금을 쓴다.

const allRoomOf = async (db: Db, councilId: string) => {
  const [room] = await db
    .select({ id: chatRoom.id })
    .from(chatRoom)
    .innerJoin(record, eq(record.id, chatRoom.id))
    .where(and(eq(record.councilId, councilId), eq(chatRoom.type, 'all_members')))
  if (!room) throw new Error('All room missing')
  return room.id
}

// 라우트가 보내기에 쓰는 것과 같은 모양: READ COMMITTED 거래 하나에서 권한을 보고 보낸다.
const sentBy = (
  db: Db,
  context: SmokeContext,
  who: { userId: string; councilId: string },
  input: { roomId: string; body: string; mentions: string[] },
) =>
  db.transaction(async tx =>
    sendMessage(
      tx,
      await authorize(tx, { ...who, action: 'council.view', now: context.now }),
      input,
      context.now,
    ),
  )

const messageRows = (sql: SmokeSql, roomId: string) =>
  sql.unsafe('SELECT id, sent_at::text AS sent_at FROM message WHERE room_id = $1', [roomId])

// 사례 g: 보내기와 그 사람 내보내기를 동시에 ----------------------------------------

// 보내기가 먼저면 내보내기가 그 거래가 끝나기를 기다리고, 내보내기가 먼저면 보내기는 지워진 참여 줄을 찾지 못해 FORBIDDEN이다.
const SEND_REMOVE_EXPECTED = new Set(['FORBIDDEN'])
const ROUNDS = 5

const G = { host: 'smoke-g-host' }

export const sendAndRemoveCase: SmokeCase = {
  name: '글 보내기와 그 사람 내보내기를 동시에',
  run: context =>
    withConnections(context, async open => {
      const main = open()
      await googleUser(main.db, G.host)
      const councilId = await createdCouncil(main.db, context, G.host, '점검 g 학생회')
      const code = await inviteCodeOf(main.db, councilId)
      const roomId = await allRoomOf(main.db, councilId)
      let delivered = 0
      for (let round = 0; round < ROUNDS; round++) {
        const guest = `smoke-g-guest${round}`
        await googleUser(main.db, guest)
        await joined(main.db, context, guest, code)
        const guestMember = await memberIdOf(main.db, guest)
        const [left, right] = [open(), open()]
        const results = await Promise.allSettled([
          sentBy(
            left.db,
            context,
            { userId: guest, councilId },
            { roomId, body: `글 ${round}`, mentions: [] },
          ),
          changer(right.db, context, { userId: G.host, councilId })(
            'member.manage',
            async (tx, actor) => {
              await removeMember(tx, actor, guestMember)
              await syncRooms(tx, actor)
            },
          ),
        ])
        const bad = unexpectedFailures(results, SEND_REMOVE_EXPECTED)
        if (bad.length > 0) return fail('보내기나 내보내기가 예상하지 못한 오류로 끝났다', bad[0])
        if (outcomeOf(results[1]) !== 'ok') return fail('내보내기가 끝나지 않았다')
        if (results[0].status === 'fulfilled') delivered++
        const remaining = await main.db
          .select({ roomId: roomMembership.roomId })
          .from(roomMembership)
          .where(eq(roomMembership.memberId, guestMember))
        if (remaining.length > 0)
          return fail(`내보낸 사람의 참여 줄이 ${remaining.length}개 남았다`)
      }
      const stored = (await messageRows(main.sql, roomId)).length
      return stored === delivered
        ? pass(`${ROUNDS}번 모두 참여 줄이 지워졌고 보낸 글 ${delivered}개가 그대로 남았다`)
        : fail(`보내졌다고 한 글 ${delivered}개, 저장된 글 ${stored}개`)
    }),
}

// 사례 h: 같은 방에서 동시에 보내기 -----------------------------------------------

const H = { host: 'smoke-h-host', guest: 'smoke-h-guest' }
const SENDERS = 8

// 방 행 잠금이 같은 방의 보내기를 줄 세우므로 보낸 시각이 겹치지 않고 커밋 순서를 따른다(커서와 읽음이 기댄다).
export const sendTogetherCase: SmokeCase = {
  name: '같은 방에서 동시에 글 보내기',
  run: context =>
    withConnections(context, async open => {
      const main = open()
      await googleUser(main.db, H.host)
      await googleUser(main.db, H.guest)
      const councilId = await createdCouncil(main.db, context, H.host, '점검 h 학생회')
      await joined(main.db, context, H.guest, await inviteCodeOf(main.db, councilId))
      const roomId = await allRoomOf(main.db, councilId)
      const users = [H.host, H.guest]
      const results = await Promise.allSettled(
        Array.from({ length: SENDERS }, (_, index) =>
          sentBy(
            open().db,
            context,
            { userId: users[index % users.length]!, councilId },
            { roomId, body: `글 ${index}`, mentions: [] },
          ),
        ),
      )
      const bad = unexpectedFailures(results, new Set())
      if (bad.length > 0) return fail('보내다 예상하지 못한 오류', bad[0])
      const rows = await messageRows(main.sql, roomId)
      if (rows.length !== SENDERS)
        return fail(`글 ${rows.length}개가 남았다(${SENDERS}개를 보냈다)`)
      const times = new Set(rows.map(row => row.sent_at))
      return times.size === SENDERS
        ? pass(`글 ${SENDERS}개의 보낸 시각이 모두 다르다`)
        : fail(`보낸 시각이 겹친다(서로 다른 시각 ${times.size}개)`)
    }),
}
