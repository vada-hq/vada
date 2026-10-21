import { and, eq, ne } from 'drizzle-orm'
import {
  chatRoomTag,
  chatRoomUrl,
  PUSH_BODY_MAX,
  PUSH_PHOTO_BODY,
  type RoomType,
} from '@vada/contracts'
import {
  chatRoom,
  department,
  member,
  message,
  notification,
  record,
  roomMembership,
} from '../db/schema.js'
import type { Db } from '../db/types.js'
import { sqlState } from '../http/on-error.js'
import { loginAccountsOf } from '../push/accounts.js'
import { createFanout } from '../push/fanout.js'
import type { PushMessage, PushSender } from '../push/sender.js'
import { currentMembersAmong } from './current-members.js'
import { createPresence } from './presence.js'

// 종류로만 이름이 붙는 방의 알림 제목. 부서방은 부서 이름, 1:1은 보낸 사람이다.
const ROOM_TITLES: Partial<Record<RoomType, string>> = {
  all_members: '전체방',
  leadership: '회장단방',
  inter_department: '부서 간 방',
}

// 잠금 화면에 보이는 글자는 앞 100자다. 글자 수는 코드 포인트로 세어 이모지가 반쪽으로 잘리지 않는다.
const excerptOf = (body: string) =>
  body ? Array.from(body).slice(0, PUSH_BODY_MAX).join('') : PUSH_PHOTO_BODY

async function sentMessage(db: Db, messageId: string) {
  const [row] = await db
    .select({
      roomId: message.roomId,
      body: message.body,
      councilId: record.councilId,
      senderId: record.createdBy,
      senderName: member.name,
      roomType: chatRoom.type,
      departmentName: department.name,
    })
    .from(message)
    .innerJoin(record, eq(record.id, message.id))
    .innerJoin(member, eq(member.id, record.createdBy))
    .innerJoin(chatRoom, eq(chatRoom.id, message.roomId))
    .leftJoin(department, eq(department.id, chatRoom.departmentId))
    .where(eq(message.id, messageId))
  return row
}

// 그 방의 지금 참여자 중 보낸 사람과 학생회를 떠난 사람(지난 기수 포함)을 뺀 사람. 1:1의 줄은 떠난 뒤에도 남아 따로 거른다.
async function audienceOf(
  db: Db,
  sent: NonNullable<Awaited<ReturnType<typeof sentMessage>>>,
  now: Date,
) {
  const rows = await db
    .select({ memberId: roomMembership.memberId })
    .from(roomMembership)
    .where(and(eq(roomMembership.roomId, sent.roomId), ne(roomMembership.memberId, sent.senderId!)))
  const alive = await currentMembersAmong(
    db,
    sent.councilId!,
    rows.map(row => row.memberId),
    now,
  )
  return rows.map(row => row.memberId).filter(id => alive.has(id))
}

async function calledOf(db: Db, messageId: string) {
  const rows = await db
    .select({ recipientId: notification.recipientId })
    .from(notification)
    .where(and(eq(notification.recordId, messageId), eq(notification.type, 'mention')))
  return new Set(rows.map(row => row.recipientId))
}

// 메시지를 보낸 뒤의 휴대폰 알림. 커밋 뒤에 떼어 부르고 응답은 기다리지 않는다(notify는 던지지 않는다).
// 받는 사람: 그 방의 지금 참여자 - 보낸 사람 - 10초 안에 그 방을 본 사람. 부름 받은 사람은 부름 문구로 한 번만 받는다.
// 재시작 중이면 그 알림은 사라진다(outbox는 '나중', 기능 003 '위험').
export function createChatPush(db: Db, send: PushSender) {
  const presence = createPresence()
  const fanout = createFanout(db, send)
  async function run(messageId: string, now: Date) {
    const sent = await sentMessage(db, messageId)
    if (!sent?.senderId || !sent.councilId) return
    const viewers = (await audienceOf(db, sent, now)).filter(
      id => !presence.isViewing(sent.roomId, id, now),
    )
    const called = await calledOf(db, messageId)
    const url = chatRoomUrl(sent.councilId, sent.roomId)
    const tag = chatRoomTag(sent.roomId)
    const excerpt = excerptOf(sent.body)
    const title =
      sent.roomType === 'direct'
        ? sent.senderName
        : (sent.departmentName ?? ROOM_TITLES[sent.roomType as RoomType] ?? '대화')
    const normal: PushMessage = { title, body: excerpt, url, tag }
    const mention: PushMessage = {
      title: `${sent.senderName}님이 나를 불렀어요`,
      body: excerpt,
      url,
      tag,
    }
    const messages = new Map<string, PushMessage>()
    for (const { memberId, userId } of await loginAccountsOf(db, viewers))
      messages.set(userId, called.has(memberId) ? mention : normal)
    await fanout.deliver(messages)
  }
  return {
    // 방의 최신 쪽을 읽은 사람을 '보는 중'으로 적는다.
    seen: (roomId: string, memberId: string, now: Date) => {
      presence.see(roomId, memberId, now)
    },
    async notify(messageId: string, now: Date) {
      try {
        await run(messageId, now)
      } catch (error) {
        console.warn(JSON.stringify({ event: 'push_send_failed', sqlState: sqlState(error) }))
      }
    },
  }
}
export type ChatPush = ReturnType<typeof createChatPush>
