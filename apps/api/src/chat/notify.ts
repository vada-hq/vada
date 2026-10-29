import { and, eq, ne } from 'drizzle-orm'
import { chatRoomTag, chatRoomUrl, type RoomType } from '@vada/contracts'
import {
  chatRoom,
  department,
  event,
  member,
  message,
  notification,
  record,
  roomMembership,
} from '../db/schema.js'
import type { Db } from '../db/types.js'
import { loginAccountsOf } from '../push/accounts.js'
import { createFanout } from '../push/fanout.js'
import { createPendingPush, type PendingPush } from '../push/pending.js'
import type { PushMessage, PushSender } from '../push/sender.js'
import { isArchivedEvent } from './archive.js'
import { currentMembersAmong } from './current-members.js'
import { excerptOf } from './excerpt.js'
import { createPresence } from './presence.js'
import { displayNameOf } from '../team/display-name.js'

// 종류로만 이름이 붙는 방의 알림 제목. 부서방은 부서 이름, 1:1은 보낸 사람이다.
const ROOM_TITLES: Partial<Record<RoomType, string>> = {
  all_members: '공지방',
  leadership: '회장단방',
  inter_department: '부서 간 방',
}
// 시연 기준으로 늘 보낸다. 나중에 화면이 보이고 초점이 있을 때만(Slack 방식) 제외하도록 다시 켤 수 있다.
const SUPPRESS_WHILE_VIEWING = false

async function sentMessage(db: Db, messageId: string) {
  const [row] = await db
    .select({
      roomId: message.roomId,
      body: message.body,
      councilId: record.councilId,
      senderId: record.createdBy,
      senderName: displayNameOf(member, record.councilId),
      roomType: chatRoom.type,
      departmentName: department.name,
      eventId: chatRoom.eventId,
      eventName: event.name,
    })
    .from(message)
    .innerJoin(record, eq(record.id, message.id))
    // 보낸 사람 없는 끼룩이 글(chat/kkiruk-post.ts)은 운영진 행이 없다.
    .leftJoin(member, eq(member.id, record.createdBy))
    .innerJoin(chatRoom, eq(chatRoom.id, message.roomId))
    .leftJoin(department, eq(department.id, chatRoom.departmentId))
    .leftJoin(event, eq(event.id, chatRoom.eventId))
    .where(eq(message.id, messageId))
  return row
}

// 그 방의 지금 참여자 중 보낸 사람과 학생회를 떠난 사람(지난 기수 포함)을 뺀 사람. 1:1의 줄은 떠난 뒤에도 남아 따로 거른다.
// 보낸 사람 없는 끼룩이 글은 그 글을 일으킨 사람(skip)을 뺀다. 내가 한 일을 내게 알리지 않는 대화 관례다.
async function audienceOf(db: Db, sent: Sent, now: Date, skip: string | null) {
  const rows = await db
    .select({ memberId: roomMembership.memberId })
    .from(roomMembership)
    .where(
      and(
        eq(roomMembership.roomId, sent.roomId),
        skip ? ne(roomMembership.memberId, skip) : undefined,
      ),
    )
  const alive = await currentMembersAmong(
    db,
    sent.councilId!,
    rows.map(row => row.memberId),
    now,
  )
  return rows.map(row => row.memberId).filter(id => alive.has(id))
}

type Sent = NonNullable<Awaited<ReturnType<typeof sentMessage>>>
type ChatNotice = { messageId: string; now: Date; except: string | undefined }
// except는 자동 공지를 일으킨 사람이다. 발신자가 없는 글도 공지로 세어 except 없는 자동 글을 포함한다.
const kindOf = (sent: Sent | undefined, except: string | undefined) =>
  except !== undefined || (sent && !sent.senderId) ? 'notice' : 'chat'

// 알림 제목: 1:1은 보낸 사람, 부서방은 부서 이름, 나머지는 방 종류 이름이다(끼룩이 글은 공지방).
// 행사 방은 앞에 행사 이름을 붙인다('{행사} 공지방', '{행사} {부서}', 022 정한 것 1).
const roomTitleOf = (sent: Sent) =>
  (sent.roomType === 'direct' ? sent.senderName : sent.departmentName) ??
  ROOM_TITLES[sent.roomType as RoomType] ??
  '대화'
const titleOf = (sent: Sent) =>
  sent.eventName ? `${sent.eventName} ${roomTitleOf(sent)}` : roomTitleOf(sent)

async function calledOf(db: Db, messageId: string) {
  const rows = await db
    .select({ recipientId: notification.recipientId })
    .from(notification)
    .where(and(eq(notification.recordId, messageId), eq(notification.type, 'mention')))
  return new Set(rows.map(row => row.recipientId))
}

// 메시지를 보낸 뒤의 휴대폰 알림. 커밋 뒤에 떼어 부르고 응답은 기다리지 않는다(notify는 던지지 않는다).
// 받는 사람: 그 방의 지금 참여자 - 보낸 사람. 부름 받은 사람은 부름 문구로 한 번만 받는다.
export function createChatPush(
  db: Db,
  send: PushSender,
  pending: PendingPush = createPendingPush(),
) {
  const presence = createPresence()
  const fanout = createFanout(db, send)
  async function run(sent: Sent | undefined, { messageId, now, except }: ChatNotice) {
    const kind = kindOf(sent, except)
    // 보내자마자 지운 메시지와 보관된 행사 방의 글은 알리지 않는다(DEC-54, DEC-90). 보관 전에 보낸 글의 알림이 늦게 가도 빠진다.
    if (!sent?.councilId || sent.body === null) return fanout.skip(kind, 'deleted')
    if (await isArchivedEvent(db, sent.eventId)) return fanout.skip(kind, 'archived')
    const viewers = (await audienceOf(db, sent, now, sent.senderId ?? except ?? null)).filter(
      id => !SUPPRESS_WHILE_VIEWING || !presence.isViewing(sent.roomId, id, now),
    )
    const called = await calledOf(db, messageId)
    const url = chatRoomUrl(sent.councilId, sent.roomId, sent.eventId)
    const tag = chatRoomTag(sent.roomId)
    const excerpt = excerptOf(sent.body)
    const normal: PushMessage = { title: titleOf(sent), body: excerpt, url, tag }
    const mention: PushMessage = {
      title: `${sent.senderName}님이 나를 불렀어요`,
      body: excerpt,
      url,
      tag,
    }
    const messages = new Map<string, PushMessage>()
    for (const { memberId, userId } of await loginAccountsOf(db, viewers))
      messages.set(userId, called.has(memberId) ? mention : normal)
    await fanout.deliver(messages, { kind, recipients: viewers.length })
  }
  async function notify(messageId: string, now: Date, except: string | undefined) {
    let sent: Sent | undefined
    try {
      sent = await sentMessage(db, messageId)
      await run(sent, { messageId, now, except })
    } catch (error) {
      fanout.failed(kindOf(sent, except), error)
    }
  }
  return {
    // 방의 최신 쪽을 읽은 사람을 '보는 중'으로 적는다.
    seen: (roomId: string, memberId: string, now: Date) => {
      presence.see(roomId, memberId, now)
    },
    // except: 보낸 사람 없는 글을 일으킨 운영진. 그 사람은 받지 않는다.
    notify: (messageId: string, now: Date, options: { except?: string } = {}) =>
      pending.track(notify(messageId, now, options.except)),
  }
}
export type ChatPush = ReturnType<typeof createChatPush>
