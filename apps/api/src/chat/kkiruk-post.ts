import { and, eq } from 'drizzle-orm'
import { chatRoom, record } from '../db/schema.js'
import type { Tx } from '../db/types.js'
import { createRecord } from '../records/records.js'
import { inCouncilNoticeRoom, inNoticeRoom } from './plan-room.js'
import { syncRooms } from './rooms.js'
import { lockedSentAt } from './sent-at.js'

// 보낸 사람 없는 끼룩이 글(DEC-87, DEC-90, DEC-93): VADA가 저절로 한 일을 공지방에 글 하나로 알린다.
// 본문은 부르는 쪽이 규칙으로 만든 정해진 글이다(AI가 쓰지 않는다, DEC-71). 기록의 만든 사람은 비운다(record.created_by).
// 부르는 쪽의 거래 안에서 쓴다: 그 거래가 되돌아가면 글도 남지 않고, 글이 실패하면 그 거래도 되돌아간다.
// 학생회 행을 잠근 거래(inCouncilChange)에서 부른다. 공지방이 아직 없는 학생회는 그 잠금 아래에서 방을 맞춘 뒤 쓴다.
// 휴대폰 알림은 커밋 뒤에 부르는 쪽이 대화 알림(chat/notify.ts)으로 보낸다.

type Scope = { councilId: string; cohortId: string; eventId: string | null }

async function roomWhere(tx: Tx, councilId: string, where: ReturnType<typeof and>) {
  const [room] = await tx
    .select({ id: chatRoom.id })
    .from(chatRoom)
    .innerJoin(record, eq(record.id, chatRoom.id))
    .where(and(eq(record.councilId, councilId), where))
  return room?.id
}

// 방 고르기: 그 행사의 공지방이 있으면 그것, 없으면 우리 학생회 공지방이다(DEC-93).
async function noticeRoomOf(tx: Tx, { councilId, cohortId, eventId }: Scope) {
  const eventRoom = eventId
    ? await roomWhere(tx, councilId, and(inNoticeRoom, eq(chatRoom.eventId, eventId)))
    : undefined
  if (eventRoom) return eventRoom
  const councilRoom = await roomWhere(tx, councilId, inCouncilNoticeRoom)
  if (councilRoom) return councilRoom
  // 대화 기능 전에 만든 학생회는 방 목록을 처음 읽을 때 방이 생긴다(ensureCouncilRooms). 그 전에 쓰는 글도 잃지 않게 여기서 맞춘다.
  await syncRooms(tx, { councilId, cohortId, memberId: null })
  return (await roomWhere(tx, councilId, inCouncilNoticeRoom))!
}

// 글 하나를 쓰고 그 번호를 돌려준다.
export async function postKkirukNotice(tx: Tx, scope: Scope, body: string): Promise<string> {
  const roomId = await noticeRoomOf(tx, scope)
  const sentAt = await lockedSentAt(tx, roomId)
  return createRecord(tx, {
    kind: 'message',
    councilId: scope.councilId,
    actor: null,
    // is_notice 칸은 남아 있지만 읽는 코드가 없다(DEC-90). 새 메시지는 늘 false다.
    values: { roomId, body, sentAt, isNotice: false },
  })
}
