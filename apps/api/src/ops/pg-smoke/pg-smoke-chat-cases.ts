import { and, eq, sql } from 'drizzle-orm'
import { authorize } from '../../access/authorize.js'
import { sendMessage } from '../../chat/send.js'
import { syncRooms } from '../../chat/rooms.js'
import { chatRoom, record, roomMembership } from '../../db/schema.js'
import type { Db } from '../../db/types.js'
import type { SmokeConnection } from './pg-smoke-connection.js'
import { removeMember } from '../../team/service.js'
import {
  changer,
  createdCouncil,
  fail,
  googleUser,
  inviteCodeOf,
  joined,
  memberIdOf,
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
// beforeCommit은 글을 만든 뒤 커밋 직전에 불린다(잠금을 아직 쥔 때). 사례 h가 커밋 순서를 적는 데 쓴다.
const sentBy = (
  db: Db,
  context: SmokeContext,
  who: { userId: string; councilId: string; beforeCommit?: (messageId: string) => Promise<void> },
  input: { roomId: string; body: string; mentions: string[] },
) =>
  db.transaction(async tx => {
    const actor = await authorize(tx, {
      userId: who.userId,
      councilId: who.councilId,
      action: 'council.view',
      now: context.now,
    })
    const sent = await sendMessage(tx, actor, { ...input, photos: [] }, context.now)
    await who.beforeCommit?.(sent.id)
    return sent
  })

const pause = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

// 사례 g: 보내기와 그 사람 내보내기를 동시에 ----------------------------------------

// 보내기가 먼저면 내보내기가 그 거래가 끝나기를 기다리고, 내보내기가 먼저면 보내기는 지워진 참여 줄을 찾지 못해 FORBIDDEN이다.
// 잠금이 없으면 지운 줄이 아직 커밋 전이라 보내기가 지나가고 그 글의 시각이 지운 시각보다 뒤가 된다. 그것을 잡는다.
const SEND_REMOVE_EXPECTED = new Set(['FORBIDDEN'])
const ROUNDS = 6
const HOLD_MS = 500
const ALTERNATE = 2

const G = { host: 'smoke-g-host' }

// 내보내기 거래: 줄을 지운 직후의 DB 시각(removedAt)을 받아 두고, 보낼 쪽이 그 사이에 들어올 수 있게 잠시 거래를 쥔다.
async function removeHolding(
  removal: ReturnType<typeof changer>,
  guestMember: string,
  hold: { deleted: () => void; ms: number },
) {
  let removedAt = ''
  await removal('member.manage', async (tx, actor) => {
    await removeMember(tx, actor, guestMember)
    await syncRooms(tx, actor)
    const [row] = await tx
      .select({ at: sql<string>`clock_timestamp()::text` })
      .from(chatRoom)
      .limit(1)
    removedAt = row!.at
    hold.deleted()
    await pause(hold.ms)
  })
  return removedAt
}

type Open = () => SmokeConnection
type Council = { main: SmokeConnection; councilId: string; roomId: string; code: string }

// 한 판: 손님이 들어오고, 보내기와 내보내기가 겹친다. 문제가 있으면 그 글을, 없으면 undefined를 돌려준다.
async function roundOf(open: Open, context: SmokeContext, council: Council, round: number) {
  const { main, councilId, roomId } = council
  const guest = `smoke-g-guest${round}`
  await googleUser(main.db, guest)
  await joined(main.db, context, guest, council.code)
  const guestMember = await memberIdOf(main.db, guest)
  // 짝수 번은 내보내기가 줄을 지운 뒤 커밋을 쥔 사이에 보내고, 홀수 번은 둘을 함께 시작한다.
  const together = round % ALTERNATE === 1
  let deleted = () => {}
  const afterDelete = new Promise<void>(resolve => {
    deleted = resolve
  })
  const [left, right] = [open(), open()]
  const removal = removeHolding(
    changer(right.db, context, { userId: G.host, councilId }),
    guestMember,
    { deleted, ms: together ? 0 : HOLD_MS },
  )
  // 내보내기가 실패로 끝나도 보내는 쪽이 영영 기다리지 않게 한다.
  void removal.then(deleted, deleted)
  const input = { roomId, body: `글 ${round}`, mentions: [] }
  const sending = (together ? Promise.resolve() : afterDelete).then(() =>
    sentBy(left.db, context, { userId: guest, councilId }, input),
  )
  const results = await Promise.allSettled([sending, removal])
  const bad = unexpectedFailures(results, SEND_REMOVE_EXPECTED)
  if (bad.length > 0) return fail('보내기나 내보내기가 예상하지 못한 오류로 끝났다', bad[0])
  if (results[1].status !== 'fulfilled') return fail('내보내기가 끝나지 않았다')
  const [late] = await main.sql.unsafe(
    `SELECT count(*)::text AS n FROM message m JOIN record r ON r.id = m.id
      WHERE r.created_by = $1 AND m.sent_at >= $2::timestamptz`,
    [guestMember, results[1].value],
  )
  if (late?.n !== '0') return fail(`${round}번째: 내보낸 뒤의 시각으로 글이 남았다`)
  const rows = await main.db
    .select({ roomId: roomMembership.roomId })
    .from(roomMembership)
    .where(eq(roomMembership.memberId, guestMember))
  return rows.length > 0 ? fail(`내보낸 사람의 참여 줄이 ${rows.length}개 남았다`) : undefined
}

export const sendAndRemoveCase: SmokeCase = {
  name: '글 보내기와 그 사람 내보내기를 동시에',
  run: context =>
    withConnections(context, async open => {
      const main = open()
      await googleUser(main.db, G.host)
      const councilId = await createdCouncil(main.db, context, G.host, '점검 g 학생회')
      const council = {
        main,
        councilId,
        roomId: await allRoomOf(main.db, councilId),
        code: await inviteCodeOf(main.db, councilId),
      }
      for (let round = 0; round < ROUNDS; round++) {
        const problem = await roundOf(open, context, council, round)
        if (problem) return problem
      }
      return pass(`${ROUNDS}번 모두 내보낸 뒤의 시각으로 남은 글이 없고 참여 줄이 지워졌다`)
    }),
}

// 사례 h: 같은 방에서 동시에 보내기 -----------------------------------------------

const H = { host: 'smoke-h-host', guest: 'smoke-h-guest' }
const SENDERS = 8
const STAGGER_MS = 40

// 방 행 잠금이 같은 방의 보내기를 줄 세우므로 보낸 시각이 겹치지 않고 커밋 순서를 따른다(커서와 읽음이 기댄다).
// 커밋 직전(잠금을 쥔 채)에 순번을 적는다. 뒤에 들어온 거래가 더 짧게 쉬게 해, 잠금이 없으면 순번이 시각과 거꾸로 되도록 한다.
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
      const order = new Map<string, number>()
      const results = await Promise.allSettled(
        Array.from({ length: SENDERS }, (_, index) =>
          sentBy(
            open().db,
            context,
            {
              userId: users[index % users.length]!,
              councilId,
              beforeCommit: async messageId => {
                await pause((SENDERS - index) * STAGGER_MS)
                order.set(messageId, order.size)
              },
            },
            { roomId, body: `글 ${index}`, mentions: [] },
          ),
        ),
      )
      const bad = unexpectedFailures(results, new Set())
      if (bad.length > 0) return fail('보내다 예상하지 못한 오류', bad[0])
      const rows = await main.sql.unsafe(
        'SELECT id, sent_at::text AS sent_at FROM message WHERE room_id = $1 ORDER BY sent_at, id',
        [roomId],
      )
      if (rows.length !== SENDERS)
        return fail(`글 ${rows.length}개가 남았다(${SENDERS}개를 보냈다)`)
      if (new Set(rows.map(row => row.sent_at)).size !== SENDERS) return fail('보낸 시각이 겹친다')
      const commits = rows.map(row => order.get(String(row.id)) ?? -1)
      return commits.every((value, index) => value === index)
        ? pass(`글 ${SENDERS}개의 보낸 시각이 모두 다르고 커밋 순서와 같다`)
        : fail(`보낸 시각 순서와 커밋 순서가 다르다(${commits.join(',')})`)
    }),
}
