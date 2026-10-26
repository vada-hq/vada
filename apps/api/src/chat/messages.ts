import {
  and,
  asc,
  count,
  desc,
  eq,
  exists,
  inArray,
  isNotNull,
  isNull,
  max,
  or,
  sql,
  type SQL,
} from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import {
  isUuid,
  MESSAGE_PAGE_SIZE,
  type ChatMessage,
  type MessagePageResponse,
} from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import { cohortOfDay } from '../access/current-cohort.js'
import { chatRoom, cohort, file, member, message, record, roomMembership } from '../db/schema.js'
import type { Db } from '../db/types.js'
import { ApiError } from '../http/errors.js'
import { madeOf } from './made.js'
import { inNoticeRoom } from './plan-room.js'
import { displayNameOf } from '../team/display-name.js'

type Reader = Pick<Db, 'select'>

// 메시지 한 줄과 보낸 사람. 보낸 사람은 기록을 만든 운영진이다.
const columns = {
  id: message.id,
  body: message.body,
  sentAt: message.sentAt,
  deletedAt: message.deletedAt,
  senderId: record.createdBy,
  senderName: displayNameOf(member, record.councilId),
}
const rowsOf = (db: Reader) =>
  db
    .select(columns)
    .from(message)
    .innerJoin(record, eq(record.id, message.id))
    .innerJoin(chatRoom, eq(chatRoom.id, message.roomId))
    .leftJoin(member, eq(member.id, record.createdBy))

type Row = Awaited<ReturnType<ReturnType<typeof rowsOf>['limit']>>[number]

// 메시지에 붙은 사진 번호. 보낸 차례(만든 시각)대로다. 지운 메시지의 사진(저장소 위치를 비운 파일)은 없다.
async function photosOf(db: Reader, messageIds: string[]) {
  const byMessage = new Map<string, { id: string }[]>()
  if (!messageIds.length) return byMessage
  const rows = await db
    .select({ id: file.id, messageId: file.attachedToId })
    .from(file)
    .innerJoin(record, eq(record.id, file.id))
    .where(and(inArray(file.attachedToId, messageIds), isNotNull(file.storageKey)))
    .orderBy(asc(record.createdAt), asc(file.id))
  for (const row of rows)
    byMessage.set(row.messageId!, [...(byMessage.get(row.messageId!) ?? []), { id: row.id }])
  return byMessage
}

// 원글마다 내가 볼 수 있는 답글 수와 마지막 답글 시각(DEC-90). 답글도 방 흐름과 같은 조건(visibleMessage)으로 센다.
async function replyStatsOf(db: Reader, actor: Actor, messageIds: string[]) {
  if (!messageIds.length) return new Map<string, { replies: number; lastAt: Date | null }>()
  const rows = await db
    .select({ originalId: message.replyToId, replies: count(), lastAt: max(message.sentAt) })
    .from(message)
    .innerJoin(record, eq(record.id, message.id))
    .innerJoin(chatRoom, eq(chatRoom.id, message.roomId))
    .where(and(inArray(message.replyToId, messageIds), visibleMessage(actor)))
    .groupBy(message.replyToId)
  return new Map(rows.map(row => [row.originalId!, row]))
}

async function chatMessagesOf(db: Reader, actor: Actor, rows: Row[]): Promise<ChatMessage[]> {
  const ids = rows.map(row => row.id)
  const photos = await photosOf(db, ids)
  const made = await madeOf(db, actor, ids)
  const replies = await replyStatsOf(db, actor, ids)
  return rows.map(row => ({
    ...row,
    sentAt: row.sentAt.toISOString(),
    deletedAt: row.deletedAt?.toISOString() ?? null,
    photos: photos.get(row.id) ?? [],
    made: made.get(row.id) ?? [],
    replyCount: replies.get(row.id)?.replies ?? 0,
    lastReplyAt: replies.get(row.id)?.lastAt?.toISOString() ?? null,
  }))
}

// 메시지 하나. 보낸 직후의 응답이 쓴다.
export async function messageOf(db: Reader, actor: Actor, messageId: string): Promise<ChatMessage> {
  const [row] = await rowsOf(db).where(eq(message.id, messageId))
  return (await chatMessagesOf(db, actor, [row!]))[0]!
}

// 보낸 시각이 at인 이 방 메시지가 들어온 뒤의 것이다(DEC-20). 시각은 참여 줄과 DB 안에서 비교한다. Date로 옮기면 마이크로초가 깎여 경계가 어긋난다.
const sinceJoined = (memberId: string, at: SQL) =>
  sql`${at} >= (select ${roomMembership.joinedAt} from ${roomMembership}
    where ${roomMembership.roomId} = ${message.roomId} and ${roomMembership.memberId} = ${memberId}::uuid)`

// 이 방에서 내가 볼 수 있는 메시지 하나와 그 원글 번호(원글이면 null). 없거나 안 보이면 undefined다.
// 읽음 표시, 답글 달기와 답글 읽기가 쓴다.
export async function visibleInRoom(db: Reader, actor: Actor, roomId: string, messageId: string) {
  const [found] = await db
    .select({ id: message.id, replyToId: message.replyToId })
    .from(message)
    .innerJoin(record, eq(record.id, message.id))
    .innerJoin(chatRoom, eq(chatRoom.id, message.roomId))
    .where(and(eq(message.id, messageId), eq(message.roomId, roomId), visibleMessage(actor)))
  return found
}

// 커서는 메시지 번호다. 이 쪽(방 흐름이나 한 원글의 답글)에서 내가 볼 수 있는 메시지가 아니면
// (들어오기 전, 다른 기수, 다른 방, 다른 쪽, 없는 것, 형식 틀림) 같은 오류다.
async function assertCursor(db: Reader, actor: Actor, scope: SQL | undefined, cursor: string) {
  const [found] = isUuid(cursor)
    ? await db
        .select({ id: message.id })
        .from(message)
        .innerJoin(record, eq(record.id, message.id))
        .innerJoin(chatRoom, eq(chatRoom.id, message.roomId))
        .where(and(eq(message.id, cursor.toLowerCase()), scope, visibleMessage(actor)))
    : []
  if (!found) throw new ApiError('INVALID_CURSOR')
}

// (보낸 시각, 번호) 순서로 커서 메시지의 앞이나 뒤. 시각이 같아도 번호가 가려 빠지거나 겹치지 않는다.
const beyond = (cursor: string, forward: boolean) =>
  sql`(${message.sentAt}, ${message.id}) ${sql.raw(forward ? '>' : '<')}
    (select m.sent_at, m.id from message m where m.id = ${cursor.toLowerCase()}::uuid)`

type PageQuery = { before?: string | undefined; after?: string | undefined }

// 한 쪽(scope: 방 흐름의 원글들이나 한 원글의 답글들)에서 내가 볼 수 있는 메시지 한 쪽. 커서가 없으면 가장 최근 쪽이고,
// before는 그 앞(더 오래된), after는 그 뒤(더 새)이다. 쪽 안은 오래된 것부터다.
export async function pageIn(
  db: Reader,
  actor: Actor,
  scope: SQL | undefined,
  query: PageQuery,
): Promise<MessagePageResponse> {
  const cursor = query.before ?? query.after
  if (cursor !== undefined) await assertCursor(db, actor, scope, cursor)
  const forward = query.after !== undefined
  const rows = await rowsOf(db)
    .where(
      and(scope, visibleMessage(actor), cursor === undefined ? undefined : beyond(cursor, forward)),
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
    messages: await chatMessagesOf(db, actor, page),
    hasOlder: forward ? hasCursor : more,
    hasNewer: forward ? more : hasCursor,
  }
}

// 방 흐름의 한 쪽. 원글만 있고 답글은 원글을 열어 읽는다(DEC-90).
export const messagePage = (db: Reader, actor: Actor, roomId: string, query: PageQuery) =>
  pageIn(db, actor, and(eq(message.roomId, roomId), isNull(message.replyToId)), query)

const SENT_COHORT = 'sent_cohort'
const sentCohort = alias(cohort, SENT_COHORT)

// 보낸 날(한국 날짜)의 기수가 내 지금 기수다(DEC-48). 보낸 날의 기수는 그날까지 시작한 가장 늦은 기수다(DEC-57).
// 끝 날짜 뒤에 보낸 것도 다음 기수가 시작하기 전까지는 같은 기수다. 서버 시간대가 UTC여도 같다.
const sentInMyCohort = (actor: Actor, at: SQL) =>
  exists(
    sql`(select 1 from ${cohort} ${sql.identifier(SENT_COHORT)} where ${and(
      eq(sentCohort.id, actor.cohortId),
      cohortOfDay(sentCohort, sql`(${at} at time zone 'Asia/Seoul')::date`),
    )})`,
  )

// 그 방의 참여자다(들어온 시각과 상관없이).
const inMessageRoom = (memberId: string) =>
  exists(
    sql`(select 1 from ${roomMembership} where ${roomMembership.roomId} = ${message.roomId}
      and ${roomMembership.memberId} = ${memberId}::uuid)`,
  )

// 보낸 시각이 at인 이 방 메시지를 이 사람이 볼 수 있다: 들어온 뒤의 것이거나 공지방 메시지 가운데 같은 기수의 것(들어오기 전 것도).
const visibleAt = (actor: Actor, at: SQL) =>
  or(
    sinceJoined(actor.memberId, at),
    and(inNoticeRoom, inMessageRoom(actor.memberId), sentInMyCohort(actor, at)),
  )

// 답글의 원글이 보낸 시각. 원글은 외래 키로 같은 방이라 방 조건(참여, 공지방)을 그대로 쓴다.
const originalSentAt = sql`(select o.sent_at from message o where o.id = ${message.replyToId})`

// 이 사람이 볼 수 있는 메시지(DEC-20, DEC-48, DEC-90): 이 학생회의 메시지이고, 그 방에 들어온 뒤의 것이거나
// 공지방 메시지 가운데 같은 기수의 것(들어오기 전 것도). 답글은 원글도 그렇게 보여야 한다(원글이 안 보이면 답글도 안 보인다).
// 방 흐름, 답글, 커서, 읽음, 안 읽은 수, 사진, 근거 잇기, 업무 결과물 제목이 이 조건 하나를 쓴다(보이는 조건과 여는 조건이 갈라지지 않게).
// record, chat_room을 합친 조회에서 쓴다.
export const visibleMessage = (actor: Actor) =>
  and(
    eq(record.councilId, actor.councilId),
    visibleAt(actor, sql`${message.sentAt}`),
    or(isNull(message.replyToId), visibleAt(actor, originalSentAt)),
  )
