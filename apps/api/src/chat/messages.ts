import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm'
import {
  isUuid,
  MESSAGE_PAGE_SIZE,
  type ChatMessage,
  type MessagePageResponse,
} from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import { chatRoom, cohort, file, member, message, record, roomMembership } from '../db/schema.js'
import type { Db } from '../db/types.js'
import { ApiError } from '../http/errors.js'
import { isPlanRoom } from './plan-room.js'

type Reader = Pick<Db, 'select'>

// 메시지 한 줄과 보낸 사람. 보낸 사람은 기록을 만든 운영진이다.
const columns = {
  id: message.id,
  body: message.body,
  sentAt: message.sentAt,
  isNotice: message.isNotice,
  senderId: record.createdBy,
  senderName: member.name,
}
const rowsOf = (db: Reader) =>
  db
    .select(columns)
    .from(message)
    .innerJoin(record, eq(record.id, message.id))
    .leftJoin(member, eq(member.id, record.createdBy))

type Row = Awaited<ReturnType<ReturnType<typeof rowsOf>['limit']>>[number]

// 메시지에 붙은 사진 번호. 보낸 차례(만든 시각)대로다.
async function photosOf(db: Reader, messageIds: string[]) {
  const byMessage = new Map<string, { id: string }[]>()
  if (!messageIds.length) return byMessage
  const rows = await db
    .select({ id: file.id, messageId: file.attachedToId })
    .from(file)
    .innerJoin(record, eq(record.id, file.id))
    .where(inArray(file.attachedToId, messageIds))
    .orderBy(asc(record.createdAt), asc(file.id))
  for (const row of rows)
    byMessage.set(row.messageId!, [...(byMessage.get(row.messageId!) ?? []), { id: row.id }])
  return byMessage
}

async function chatMessagesOf(db: Reader, rows: Row[]): Promise<ChatMessage[]> {
  const photos = await photosOf(
    db,
    rows.map(row => row.id),
  )
  return rows.map(row => ({
    ...row,
    sentAt: row.sentAt.toISOString(),
    photos: photos.get(row.id) ?? [],
  }))
}

// 메시지 하나. 보낸 직후와 공지를 바꾼 직후의 응답이 쓴다.
export async function messageOf(db: Reader, messageId: string): Promise<ChatMessage> {
  const [row] = await rowsOf(db).where(eq(message.id, messageId))
  return (await chatMessagesOf(db, [row!]))[0]!
}

// 들어온 뒤의 메시지(DEC-20). 시각은 참여 줄과 DB 안에서 비교한다. Date로 옮기면 마이크로초가 깎여 경계가 어긋난다.
export const sinceJoined = (memberId: string) =>
  sql`${message.sentAt} >= (select ${roomMembership.joinedAt} from ${roomMembership}
    where ${roomMembership.roomId} = ${message.roomId} and ${roomMembership.memberId} = ${memberId}::uuid)`

// 커서는 메시지 번호다. 이 방에서 내가 볼 수 있는 메시지가 아니면(들어오기 전, 다른 방, 없는 것, 형식 틀림) 같은 오류다.
async function assertCursor(db: Reader, memberId: string, roomId: string, cursor: string) {
  const [found] = isUuid(cursor)
    ? await db
        .select({ id: message.id })
        .from(message)
        .where(
          and(
            eq(message.id, cursor.toLowerCase()),
            eq(message.roomId, roomId),
            sinceJoined(memberId),
          ),
        )
    : []
  if (!found) throw new ApiError('INVALID_CURSOR')
}

// (보낸 시각, 번호) 순서로 커서 메시지의 앞이나 뒤. 시각이 같아도 번호가 가려 빠지거나 겹치지 않는다.
const beyond = (cursor: string, forward: boolean) =>
  sql`(${message.sentAt}, ${message.id}) ${sql.raw(forward ? '>' : '<')}
    (select m.sent_at, m.id from message m where m.id = ${cursor.toLowerCase()}::uuid)`

// 메시지 한 쪽. 커서가 없으면 가장 최근 쪽이고, before는 그 앞(더 오래된), after는 그 뒤(더 새)이다. 쪽 안은 오래된 것부터다.
export async function messagePage(
  db: Reader,
  actor: Actor,
  roomId: string,
  query: { before?: string | undefined; after?: string | undefined },
): Promise<MessagePageResponse> {
  const cursor = query.before ?? query.after
  if (cursor !== undefined) await assertCursor(db, actor.memberId, roomId, cursor)
  const forward = query.after !== undefined
  const rows = await rowsOf(db)
    .where(
      and(
        eq(message.roomId, roomId),
        sinceJoined(actor.memberId),
        cursor === undefined ? undefined : beyond(cursor, forward),
      ),
    )
    .orderBy(
      ...(forward
        ? [asc(message.sentAt), asc(message.id)]
        : [desc(message.sentAt), desc(message.id)]),
    )
    .limit(MESSAGE_PAGE_SIZE + 1)
  const more = rows.length > MESSAGE_PAGE_SIZE
  const page = rows.slice(0, MESSAGE_PAGE_SIZE)
  if (!forward) page.reverse()
  const hasCursor = cursor !== undefined
  return {
    messages: await chatMessagesOf(db, page),
    hasOlder: forward ? hasCursor : more,
    hasNewer: forward ? more : hasCursor,
  }
}

// 같은 기수의 공지(DEC-48): 전체방의 공지 표시가 붙은 메시지 중 보낸 시각의 한국 날짜가 내 지금 기수 기간에 드는 것.
// 들어오기 전 것도 보인다. 기수는 한국 날짜로 가른다(서버 시간대가 UTC여도 같다).
// 보이는 공지와 떼어 낼 수 있는 공지가 같은 조건에서 나오도록 이 한 곳에 둔다(조회와 공지 표시가 함께 쓴다). record, chat_room을 합친 조회에서 쓴다.
export const shownNotice = (actor: Actor) =>
  and(
    eq(record.councilId, actor.councilId),
    eq(chatRoom.type, 'all_members'),
    isPlanRoom,
    eq(message.isNotice, true),
    sql`(${message.sentAt} at time zone 'Asia/Seoul')::date
      between (select ${cohort.startsOn} from ${cohort} where ${cohort.id} = ${actor.cohortId}::uuid)
      and (select ${cohort.endsOn} from ${cohort} where ${cohort.id} = ${actor.cohortId}::uuid)`,
  )

// 같은 기수의 공지. 최근 것부터다.
export async function noticesOf(db: Reader, actor: Actor, limit: number): Promise<ChatMessage[]> {
  const rows = await rowsOf(db)
    .innerJoin(chatRoom, eq(chatRoom.id, message.roomId))
    .where(shownNotice(actor))
    .orderBy(desc(message.sentAt), desc(message.id))
    .limit(limit)
  return chatMessagesOf(db, rows)
}
