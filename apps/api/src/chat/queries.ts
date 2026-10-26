import { and, asc, count, desc, eq, gt, inArray, isNull, ne, or, sql } from 'drizzle-orm'
import {
  type RoomDetailResponse,
  type RoomListResponse,
  type RoomSummary,
  type RoomType,
} from '@vada/contracts'
import type { Actor } from '../access/actor.js'
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
import { completedEventIdsAmong } from '../policy/locks.js'
import { currentMembersAmong } from './current-members.js'
import { previewOf } from './excerpt.js'
import { visibleMessage } from './messages.js'
import { displayNameOf, joinedDisplayNameOf } from '../team/display-name.js'

type Reader = Pick<Db, 'select'>
// 방 목록은 방마다 마지막 메시지 하나를 DISTINCT ON으로 고른다.
type ListReader = Pick<Db, 'select' | 'selectDistinctOn'>

// 내가 참여한 방. 방은 이 학생회의 기록이다.
async function myRooms(db: Reader, actor: Actor) {
  return db
    .select({
      id: chatRoom.id,
      type: chatRoom.type,
      departmentId: chatRoom.departmentId,
      departmentName: department.name,
      eventId: chatRoom.eventId,
      eventName: event.name,
    })
    .from(roomMembership)
    .innerJoin(chatRoom, eq(chatRoom.id, roomMembership.roomId))
    .innerJoin(record, eq(record.id, chatRoom.id))
    .leftJoin(department, eq(department.id, chatRoom.departmentId))
    .leftJoin(event, eq(event.id, chatRoom.eventId))
    .where(and(eq(roomMembership.memberId, actor.memberId), eq(record.councilId, actor.councilId)))
}

// 방마다 안 읽은 수(내가 읽은 뒤 남이 보낸 것)와 마지막 메시지 시각. 내가 볼 수 있는 메시지만 센다(visibleMessage):
// 들어온 뒤의 것과 공지방의 같은 기수 메시지라, 늦게 들어온 사람에게는 공지방이 안 읽은 방으로 나온다(DEC-90).
// 답글도 안 읽은 수에 든다(방 단위 읽음, DEC-90). 마지막 메시지 시각은 방 줄의 미리보기와 같은 원글만 본다
// (답글은 방 흐름에 없어 미리보기에도 없다, 022 정한 것 8. Slack도 스레드 답글로 채널 줄이 바뀌지 않는다).
async function messageStats(db: Reader, actor: Actor) {
  const rows = await db
    .select({
      roomId: message.roomId,
      unread:
        sql<number>`count(*) filter (where ${record.createdBy} is distinct from ${actor.memberId}::uuid
        and (${roomMembership.lastReadAt} is null or ${message.sentAt} > ${roomMembership.lastReadAt}))`.mapWith(
          Number,
        ),
      lastAt:
        sql<Date | null>`max(${message.sentAt}) filter (where ${message.replyToId} is null)`.mapWith(
          message.sentAt,
        ),
    })
    .from(message)
    .innerJoin(record, eq(record.id, message.id))
    .innerJoin(chatRoom, eq(chatRoom.id, message.roomId))
    .innerJoin(
      roomMembership,
      and(eq(roomMembership.roomId, message.roomId), eq(roomMembership.memberId, actor.memberId)),
    )
    .where(visibleMessage(actor))
    .groupBy(message.roomId)
  return new Map(rows.map(row => [row.roomId, row]))
}

// 방마다 내가 볼 수 있는 마지막 원글(보낸 시각, 번호 차례로 마지막)의 보낸 사람과 미리보기. 답글은 넣지 않는다(022 정한 것 8).
// 방 흐름과 같은 조건(visibleMessage)이라 들어오기 전 부서방 메시지는 미리보기에도 없다(DEC-20, DEC-90).
// 내 방의 보이는 메시지를 다 훑는다. 메시지가 많아져 느려지면 방마다 LATERAL로 하나씩 읽고 (room_id, sent_at, id) 인덱스를 둔다.
async function lastMessages(db: ListReader, actor: Actor) {
  const rows = await db
    .selectDistinctOn([message.roomId], {
      roomId: message.roomId,
      body: message.body,
      senderName: displayNameOf(member, record.councilId),
    })
    .from(message)
    .innerJoin(record, eq(record.id, message.id))
    .innerJoin(chatRoom, eq(chatRoom.id, message.roomId))
    .innerJoin(
      roomMembership,
      and(eq(roomMembership.roomId, message.roomId), eq(roomMembership.memberId, actor.memberId)),
    )
    .leftJoin(member, eq(member.id, record.createdBy))
    .where(and(visibleMessage(actor), isNull(message.replyToId)))
    .orderBy(message.roomId, desc(message.sentAt), desc(message.id))
  return new Map(
    rows.map(row => [row.roomId, { senderName: row.senderName, preview: previewOf(row.body) }]),
  )
}

// 방마다 참여 인원. 방 하나를 열 때의 참여자 목록과 같은 줄을 센다.
async function memberCounts(db: Reader, roomIds: string[]) {
  if (!roomIds.length) return new Map<string, number>()
  const rows = await db
    .select({ roomId: roomMembership.roomId, members: count() })
    .from(roomMembership)
    .where(inArray(roomMembership.roomId, roomIds))
    .groupBy(roomMembership.roomId)
  return new Map(rows.map(row => [row.roomId, row.members]))
}

// 방마다 나를 부른 안 읽은 메시지 수. 내가 볼 수 있는 메시지만 센다(visibleMessage): 들어오기 전 것과 원글이 안 보이는 답글은 없다.
async function mentionCounts(db: Reader, actor: Actor) {
  const rows = await db
    .select({ roomId: message.roomId, mentions: count() })
    .from(notification)
    .innerJoin(message, eq(message.id, notification.recordId))
    .innerJoin(record, eq(record.id, message.id))
    .innerJoin(chatRoom, eq(chatRoom.id, message.roomId))
    .innerJoin(
      roomMembership,
      and(eq(roomMembership.roomId, message.roomId), eq(roomMembership.memberId, actor.memberId)),
    )
    .where(
      and(
        eq(notification.recipientId, actor.memberId),
        eq(notification.type, 'mention'),
        // 지운 메시지의 부름은 세지 않는다(DEC-54, 그 자리에는 '삭제된 메시지'뿐이다).
        isNull(message.deletedAt),
        visibleMessage(actor),
        or(isNull(roomMembership.lastReadAt), gt(message.sentAt, roomMembership.lastReadAt)),
      ),
    )
    .groupBy(message.roomId)
  return new Map(rows.map(row => [row.roomId, row.mentions]))
}

// 1:1의 상대와 그 사람이 지금 이 학생회의 운영진인지. 상대가 떠나면 그 방은 보기만 된다.
async function directPeers(db: Reader, actor: Actor, now: Date, roomIds: string[]) {
  if (!roomIds.length) return new Map<string, { name: string; current: boolean }>()
  const peers = await db
    .select({
      roomId: roomMembership.roomId,
      memberId: roomMembership.memberId,
      name: joinedDisplayNameOf(member, actor.councilId),
    })
    .from(roomMembership)
    .innerJoin(member, eq(member.id, roomMembership.memberId))
    .where(
      and(inArray(roomMembership.roomId, roomIds), ne(roomMembership.memberId, actor.memberId)),
    )
  const alive = await currentMembersAmong(
    db,
    actor.councilId,
    peers.map(peer => peer.memberId),
    now,
  )
  return new Map(
    peers.map(peer => [peer.roomId, { name: peer.name, current: alive.has(peer.memberId) }]),
  )
}

// 1:1은 상대 이름, 부서방은 부서 이름이다. 나머지는 화면이 종류로 이름을 붙인다.
const nameOf = (type: string, departmentName: string | null, peer: { name: string } | undefined) =>
  type === 'direct' ? (peer?.name ?? null) : departmentName

// 내가 참여한 방 몇 개의 번호·종류·이름. 사진 고르기 목록이 방을 보이는 데 쓴다.
export async function namedRooms(db: Reader, actor: Actor, now: Date, roomIds: string[]) {
  if (!roomIds.length) return new Map<string, { id: string; type: RoomType; name: string | null }>()
  const rooms = (await myRooms(db, actor)).filter(room => roomIds.includes(room.id))
  const peers = await directPeers(
    db,
    actor,
    now,
    rooms.filter(room => room.type === 'direct').map(room => room.id),
  )
  return new Map(
    rooms.map(room => [
      room.id,
      {
        id: room.id,
        type: room.type as RoomType,
        name: nameOf(room.type, room.departmentName, peers.get(room.id)),
      },
    ]),
  )
}

// 내가 든 모든 방의 줄. 완료한 행사의 방(보관, DEC-90)은 보기만이다(readOnly).
export async function summariesOf(db: ListReader, actor: Actor, now: Date): Promise<RoomSummary[]> {
  const rooms = await myRooms(db, actor)
  const eventIds = [...new Set(rooms.flatMap(room => (room.eventId ? [room.eventId] : [])))]
  const [stats, mentions, last, members, peers, archived] = await Promise.all([
    messageStats(db, actor),
    mentionCounts(db, actor),
    lastMessages(db, actor),
    memberCounts(
      db,
      rooms.map(room => room.id),
    ),
    directPeers(
      db,
      actor,
      now,
      rooms.filter(room => room.type === 'direct').map(room => room.id),
    ),
    completedEventIdsAmong(db, eventIds),
  ])
  // 방에 쌓인 메시지에서 나오는 값. 메시지가 없는 방은 0과 null이다.
  const activityOf = (roomId: string) => {
    const stat = stats.get(roomId)
    return {
      unread: stat?.unread ?? 0,
      mentions: mentions.get(roomId) ?? 0,
      lastMessageAt: stat?.lastAt?.toISOString() ?? null,
      lastMessage: last.get(roomId) ?? null,
    }
  }
  return rooms.map(room => {
    const peer = peers.get(room.id)
    return {
      id: room.id,
      type: room.type as RoomType,
      name: nameOf(room.type, room.departmentName, peer),
      departmentId: room.departmentId,
      readOnly:
        (room.type === 'direct' && !peer?.current) ||
        (room.eventId !== null && archived.has(room.eventId)),
      ...activityOf(room.id),
      memberCount: members.get(room.id) ?? 0,
      eventId: room.eventId,
      eventName: room.eventName,
    }
  })
}

// 공지방, 회장단방, 부서방(이름순), 그 밖, 1:1(최근 메시지순).
const ORDER: Record<RoomType, number> = {
  all_members: 0,
  leadership: 1,
  department: 2,
  inter_department: 3,
  direct: 4,
}
// 학생회 방, 행사 방(행사 이름순, 그 안은 학생회 방과 같은 차례), 1:1 순서다. 공지방을 종류로 고르는 화면(첫 방, 업무의 공지 만들기)이
// 학생회 공지방을 먼저 만나게 한다.
const GROUPS = { council: 0, event: 1, direct: 2 } as const
const groupOf = (room: RoomSummary) =>
  room.type === 'direct' ? GROUPS.direct : room.eventId ? GROUPS.event : GROUPS.council
const eventOrder = (a: RoomSummary, b: RoomSummary) =>
  (a.eventName ?? '').localeCompare(b.eventName ?? '', 'ko') ||
  (a.eventId ?? '').localeCompare(b.eventId ?? '')
export function byDisplayOrder(a: RoomSummary, b: RoomSummary) {
  if (groupOf(a) !== groupOf(b)) return groupOf(a) - groupOf(b)
  if (a.eventId !== b.eventId) return eventOrder(a, b)
  if (a.type !== b.type) return ORDER[a.type] - ORDER[b.type]
  if (a.type === 'direct') return (b.lastMessageAt ?? '').localeCompare(a.lastMessageAt ?? '')
  return (a.name ?? '').localeCompare(b.name ?? '', 'ko')
}

// 목록에 두는 방. 메시지가 없는 1:1은 보이지 않는다(만들기만 하고 보내지 않은 방).
// 행사 방은 볼 메시지가 생긴 뒤에 나오고, 보관된 것(완료한 행사, 행사 방이 보기만인 까닭은 이것뿐)은 빠진다(DEC-90).
const listed = (room: RoomSummary) => {
  if (room.eventId) return room.lastMessageAt !== null && !room.readOnly
  return room.type !== 'direct' || room.lastMessageAt !== null
}

// 방 목록. 합계 배지도 목록에 둔 방만 센다.
export async function roomListOf(
  db: ListReader,
  actor: Actor,
  now: Date,
): Promise<RoomListResponse> {
  const rooms = (await summariesOf(db, actor, now)).filter(listed).sort(byDisplayOrder)
  return {
    rooms,
    unreadTotal: rooms.reduce((sum, room) => sum + room.unread, 0),
    mentionTotal: rooms.reduce((sum, room) => sum + room.mentions, 0),
  }
}

// 방 하나와 그 참여자. 방을 여는 문(room-access)을 지난 뒤에 부른다.
export async function roomDetailOf(
  db: ListReader,
  actor: Actor,
  now: Date,
  roomId: string,
): Promise<RoomDetailResponse> {
  const room = (await summariesOf(db, actor, now)).find(item => item.id === roomId)!
  const participants = await db
    .select({ memberId: member.id, name: joinedDisplayNameOf(member, actor.councilId) })
    .from(roomMembership)
    .innerJoin(member, eq(member.id, roomMembership.memberId))
    .where(eq(roomMembership.roomId, roomId))
    .orderBy(asc(joinedDisplayNameOf(member, actor.councilId)))
  // 내 읽은 시각. 화면은 방을 열 때의 이 값으로 '새 답글'을 가른다(022 정한 것 32).
  const [mine] = await db
    .select({ readAt: roomMembership.lastReadAt })
    .from(roomMembership)
    .where(and(eq(roomMembership.roomId, roomId), eq(roomMembership.memberId, actor.memberId)))
  return { room, participants, readAt: mine?.readAt?.toISOString() ?? null }
}
