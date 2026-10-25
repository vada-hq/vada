import { and, asc, count, eq, gt, gte, inArray, isNull, max, ne, or, sql } from 'drizzle-orm'
import {
  RECENT_NOTICE_COUNT,
  type RoomDetailResponse,
  type RoomListResponse,
  type RoomSummary,
  type RoomType,
} from '@vada/contracts'
import type { Actor } from '../access/actor.js'
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
import { currentMembersAmong } from './current-members.js'
import { noticesOf } from './messages.js'
import { inNoticeRoom } from './plan-room.js'
import { displayNameOf } from '../team/display-name.js'

type Reader = Pick<Db, 'select'>

// 내가 참여한 방. 방은 이 학생회의 기록이다.
async function myRooms(db: Reader, actor: Actor) {
  return db
    .select({
      id: chatRoom.id,
      type: chatRoom.type,
      departmentId: chatRoom.departmentId,
      departmentName: department.name,
      noticeRoom: sql<boolean>`coalesce(${inNoticeRoom}, false)`,
    })
    .from(roomMembership)
    .innerJoin(chatRoom, eq(chatRoom.id, roomMembership.roomId))
    .innerJoin(record, eq(record.id, chatRoom.id))
    .leftJoin(department, eq(department.id, chatRoom.departmentId))
    .where(and(eq(roomMembership.memberId, actor.memberId), eq(record.councilId, actor.councilId)))
}

// 방마다 안 읽은 수(내가 읽은 뒤 남이 보낸 것)와 마지막 메시지 시각. 들어온 뒤의 메시지만 센다(DEC-20).
async function messageStats(db: Reader, actor: Actor) {
  const rows = await db
    .select({
      roomId: message.roomId,
      unread:
        sql<number>`count(*) filter (where ${record.createdBy} is distinct from ${actor.memberId}::uuid
        and (${roomMembership.lastReadAt} is null or ${message.sentAt} > ${roomMembership.lastReadAt}))`.mapWith(
          Number,
        ),
      lastAt: max(message.sentAt),
    })
    .from(message)
    .innerJoin(record, eq(record.id, message.id))
    .innerJoin(
      roomMembership,
      and(eq(roomMembership.roomId, message.roomId), eq(roomMembership.memberId, actor.memberId)),
    )
    .where(gte(message.sentAt, roomMembership.joinedAt))
    .groupBy(message.roomId)
  return new Map(rows.map(row => [row.roomId, row]))
}

// 방마다 나를 부른 안 읽은 메시지 수.
async function mentionCounts(db: Reader, actor: Actor) {
  const rows = await db
    .select({ roomId: message.roomId, mentions: count() })
    .from(notification)
    .innerJoin(message, eq(message.id, notification.recordId))
    .innerJoin(
      roomMembership,
      and(eq(roomMembership.roomId, message.roomId), eq(roomMembership.memberId, actor.memberId)),
    )
    .where(
      and(
        eq(notification.recipientId, actor.memberId),
        eq(notification.type, 'mention'),
        gte(message.sentAt, roomMembership.joinedAt),
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
      name: displayNameOf(member, actor.councilId),
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

async function summariesOf(db: Reader, actor: Actor, now: Date): Promise<RoomSummary[]> {
  const rooms = await myRooms(db, actor)
  const [stats, mentions, peers] = await Promise.all([
    messageStats(db, actor),
    mentionCounts(db, actor),
    directPeers(
      db,
      actor,
      now,
      rooms.filter(room => room.type === 'direct').map(room => room.id),
    ),
  ])
  return rooms.map(room => {
    const peer = peers.get(room.id)
    return {
      id: room.id,
      type: room.type as RoomType,
      name: nameOf(room.type, room.departmentName, peer),
      departmentId: room.departmentId,
      noticeRoom: room.noticeRoom,
      readOnly: room.type === 'direct' && !peer?.current,
      unread: stats.get(room.id)?.unread ?? 0,
      mentions: mentions.get(room.id) ?? 0,
      lastMessageAt: stats.get(room.id)?.lastAt?.toISOString() ?? null,
    }
  })
}

// 전체방, 회장단방, 부서방(이름순), 그 밖, 1:1(최근 메시지순).
const ORDER: Record<RoomType, number> = {
  all_members: 0,
  leadership: 1,
  department: 2,
  inter_department: 3,
  direct: 4,
}
function byDisplayOrder(a: RoomSummary, b: RoomSummary) {
  if (a.type !== b.type) return ORDER[a.type] - ORDER[b.type]
  if (a.type === 'direct') return (b.lastMessageAt ?? '').localeCompare(a.lastMessageAt ?? '')
  return (a.name ?? '').localeCompare(b.name ?? '', 'ko')
}

// 방 목록. 메시지가 없는 1:1은 보이지 않는다(만들기만 하고 보내지 않은 방).
export async function roomListOf(db: Reader, actor: Actor, now: Date): Promise<RoomListResponse> {
  const rooms = (await summariesOf(db, actor, now))
    .filter(room => room.type !== 'direct' || room.lastMessageAt !== null)
    .sort(byDisplayOrder)
  return {
    rooms,
    notices: await noticesOf(db, actor, RECENT_NOTICE_COUNT),
    unreadTotal: rooms.reduce((sum, room) => sum + room.unread, 0),
    mentionTotal: rooms.reduce((sum, room) => sum + room.mentions, 0),
  }
}

// 방 하나와 그 참여자. 방을 여는 문(room-access)을 지난 뒤에 부른다.
export async function roomDetailOf(
  db: Reader,
  actor: Actor,
  now: Date,
  roomId: string,
): Promise<RoomDetailResponse> {
  const room = (await summariesOf(db, actor, now)).find(item => item.id === roomId)!
  const participants = await db
    .select({ memberId: member.id, name: displayNameOf(member, actor.councilId) })
    .from(roomMembership)
    .innerJoin(member, eq(member.id, roomMembership.memberId))
    .where(eq(roomMembership.roomId, roomId))
    .orderBy(asc(displayNameOf(member, actor.councilId)))
  return { room, participants }
}
