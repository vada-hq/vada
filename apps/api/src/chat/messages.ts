import { and, asc, desc, eq, sql } from 'drizzle-orm'
import {
  isUuid,
  MESSAGE_PAGE_SIZE,
  type ChatMessage,
  type MessagePageResponse,
} from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import { chatRoom, cohort, member, message, record, roomMembership } from '../db/schema.js'
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
const chatMessageOf = (row: Row): ChatMessage => ({ ...row, sentAt: row.sentAt.toISOString() })

// 메시지 하나. 보낸 직후와 공지를 바꾼 직후의 응답이 쓴다.
export async function messageOf(db: Reader, messageId: string): Promise<ChatMessage> {
  const [row] = await rowsOf(db).where(eq(message.id, messageId))
  return chatMessageOf(row!)
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
    messages: page.map(chatMessageOf),
    hasOlder: forward ? hasCursor : more,
    hasNewer: forward ? more : hasCursor,
  }
}

// 같은 기수의 공지(DEC-48): 전체방의 공지 표시가 붙은 메시지 중 보낸 시각의 한국 날짜가 내 지금 기수 기간에 드는 것.
// 들어오기 전 것도 나온다. 기수는 한국 날짜로 가른다(서버 시간대가 UTC여도 같다). 최근 것부터다.
export async function noticesOf(db: Reader, actor: Actor, limit: number): Promise<ChatMessage[]> {
  const rows = await rowsOf(db)
    .innerJoin(chatRoom, eq(chatRoom.id, message.roomId))
    .innerJoin(cohort, eq(cohort.id, actor.cohortId))
    .where(
      and(
        eq(record.councilId, actor.councilId),
        eq(chatRoom.type, 'all_members'),
        isPlanRoom,
        eq(message.isNotice, true),
        sql`(${message.sentAt} at time zone 'Asia/Seoul')::date between ${cohort.startsOn} and ${cohort.endsOn}`,
      ),
    )
    .orderBy(desc(message.sentAt), desc(message.id))
    .limit(limit)
  return rows.map(chatMessageOf)
}
