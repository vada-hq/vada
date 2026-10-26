import { and, eq, inArray, isNull, notInArray } from 'drizzle-orm'
import { isClosing, lockCouncil } from '../access/authorize.js'
import {
  chatRoom,
  councilMembership,
  department,
  departmentMembership,
  event,
  record,
  roomMembership,
} from '../db/schema.js'
import type { Db, Tx } from '../db/types.js'
import { completedEventIdsAmong } from '../policy/locks.js'
import { clockNow, createRecord } from '../records/records.js'
import { inNoticeRoom, isPlanRoom } from './plan-room.js'

// 방 참여는 편성을 따른다(DEC-18, DEC-28): 공지방(all_members)은 모든 운영진, 회장단방은 회장과 부회장, 부서방은 그 부서원.
// 편성이 바뀌는 거래가 끝나기 전에 부른다. 지금 편성에서 있어야 할 참여를 계산해 방과 줄을 맞춘다.
// 두 번 불러도 결과가 같다. 이미 있는 줄은 건드리지 않아 들어온 시각이 그대로다(DEC-20). 방은 지우지 않고 빠진 사람의 줄만 지운다.
// 1:1과 부서 간 방은 편성이 아니라 사람이 정하므로 건드리지 않는다.
// 행사 방(DEC-90)도 편성을 따른다: 보관되지 않은(완료하지 않은) 행사마다 공지방은 모든 운영진, 부서방은 그 부서원이다. 회장단방은 없다.
// 완료한 행사의 방은 보관이라 참여를 그대로 둔다(그때의 사람이 읽는다). 완료를 취소하면 다시 맞춘다(settlement/complete.ts).
// 학생회 행을 잠근 거래 안에서 부른다. 잠그지 않으면 같은 방을 만드는 두 거래가 방을 둘 만든다.

// memberId는 없던 방을 만들 때 기록에 남는 만든 사람이다. 사람 없이 바꾸는 운영 명령(회장 되찾기)은 null이다.
type Scope = { councilId: string; cohortId: string; memberId: string | null }
type Wanted = { type: 'all_members' | 'leadership' | 'department'; departmentId: string | null }

const sameRoom = (a: Wanted, b: Wanted) => a.type === b.type && a.departmentId === b.departmentId

// 지금 기수의 소속에서 있어야 할 방과 거기 들어갈 운영진.
async function wantedRooms(tx: Tx, { councilId, cohortId }: Scope) {
  const members = await tx
    .select({ memberId: councilMembership.memberId, rank: councilMembership.councilRank })
    .from(councilMembership)
    .where(and(eq(councilMembership.cohortId, cohortId), isNull(councilMembership.endsAt)))
  const current = new Set(members.map(item => item.memberId))
  const placements = (
    await tx
      .select({ memberId: departmentMembership.memberId, departmentId: department.id })
      .from(departmentMembership)
      .innerJoin(department, eq(department.id, departmentMembership.departmentId))
      .where(
        and(
          eq(department.councilId, councilId),
          eq(departmentMembership.cohortId, cohortId),
          isNull(departmentMembership.endsAt),
        ),
      )
  ).filter(item => current.has(item.memberId))
  const rooms: { room: Wanted; memberIds: string[] }[] = [
    { room: { type: 'all_members', departmentId: null }, memberIds: [...current] },
    {
      room: { type: 'leadership', departmentId: null },
      memberIds: members.filter(item => item.rank !== null).map(item => item.memberId),
    },
  ]
  for (const departmentId of new Set(placements.map(item => item.departmentId)))
    rooms.push({
      room: { type: 'department', departmentId },
      memberIds: placements.filter(item => item.departmentId === departmentId).map(i => i.memberId),
    })
  return rooms
}

// 이 학생회에 이미 있는 편성 방(eventId가 null) 또는 그 행사의 방. 지금 부원이 없는 부서방도 포함한다.
async function existingRooms(tx: Tx, councilId: string, eventId: string | null) {
  return tx
    .select({ id: chatRoom.id, type: chatRoom.type, departmentId: chatRoom.departmentId })
    .from(chatRoom)
    .innerJoin(record, eq(record.id, chatRoom.id))
    .where(
      and(
        eq(record.councilId, councilId),
        eventId === null ? isPlanRoom : eq(chatRoom.eventId, eventId),
        inArray(chatRoom.type, ['all_members', 'leadership', 'department']),
      ),
    )
}

async function reconcileMembers(tx: Tx, roomId: string, wanted: string[]) {
  const rows = await tx
    .select({ memberId: roomMembership.memberId })
    .from(roomMembership)
    .where(eq(roomMembership.roomId, roomId))
  const have = new Set(rows.map(item => item.memberId))
  const missing = wanted.filter(memberId => !have.has(memberId))
  if (missing.length)
    await tx
      .insert(roomMembership)
      .values(missing.map(memberId => ({ roomId, memberId, joinedAt: clockNow })))
  const stale = rows.map(item => item.memberId).filter(memberId => !wanted.includes(memberId))
  if (stale.length)
    await tx
      .delete(roomMembership)
      .where(
        and(
          eq(roomMembership.roomId, roomId),
          wanted.length ? notInArray(roomMembership.memberId, wanted) : undefined,
        ),
      )
}

type Space = { eventId: string | null; wanted: { room: Wanted; memberIds: string[] }[] }

// 한 공간(학생회 또는 행사 하나)의 방과 참여를 맞춘다. closing이면 없는 방을 만들지 않는다.
async function syncSpace(tx: Tx, scope: Scope, { eventId, wanted }: Space, closing: boolean) {
  const existing = await existingRooms(tx, scope.councilId, eventId)
  const claimed = new Set<string>()
  for (const { room, memberIds } of wanted) {
    const found = existing.find(item => sameRoom(room, item as Wanted))
    if (!found && closing) continue
    const roomId =
      found?.id ??
      (await createRecord(tx, {
        kind: 'chat_room',
        councilId: scope.councilId,
        actor: scope.memberId,
        values: {
          type: room.type,
          departmentId: room.departmentId,
          ...(eventId ? { eventId } : {}),
        },
      }))
    claimed.add(roomId)
    await reconcileMembers(tx, roomId, memberIds)
  }
  // 부원이 모두 빠진 부서방은 방을 남기고 줄만 비운다.
  for (const item of existing) if (!claimed.has(item.id)) await reconcileMembers(tx, item.id, [])
}

// 행사 방에 들어갈 사람: 학생회 편성 방에서 회장단방만 뺀 것이다(DEC-90).
const eventSpace = (eventId: string, wanted: Space['wanted']): Space => ({
  eventId,
  wanted: wanted.filter(item => item.room.type !== 'leadership'),
})

// 이 학생회의 보관되지 않은(완료하지 않은) 행사. 행사의 끝은 상태로 센다(DEC-83).
async function openEventIdsOf(tx: Pick<Db, 'select'>, councilId: string, onlyRoomless = false) {
  const rows = await tx
    .select({ id: event.id })
    .from(event)
    .innerJoin(record, eq(record.id, event.id))
    .leftJoin(chatRoom, and(eq(chatRoom.eventId, event.id), inNoticeRoom))
    .where(and(eq(record.councilId, councilId), onlyRoomless ? isNull(chatRoom.id) : undefined))
  const ids = [...new Set(rows.map(row => row.id))]
  const completed = await completedEventIdsAmong(tx, ids)
  return ids.filter(id => !completed.has(id))
}

// 그만두는 학생회(DEC-55)는 읽기만 되므로 없는 방을 새로 만들지 않고, 있는 방의 참여 줄만 맞춘다(탈퇴한 사람이 빠진다).
export async function syncRooms(tx: Tx, scope: Scope) {
  const wanted = await wantedRooms(tx, scope)
  const closing = await isClosing(tx, scope.councilId)
  await syncSpace(tx, scope, { eventId: null, wanted }, closing)
  for (const eventId of await openEventIdsOf(tx, scope.councilId))
    await syncSpace(tx, scope, eventSpace(eventId, wanted), closing)
}

// 행사 하나의 방(DEC-90). 행사를 만드는 거래와 완료를 취소하는 거래가 부른다. 학생회 행을 잠근 거래에서 부른다(syncRooms와 같다).
export async function syncEventRooms(tx: Tx, scope: Scope, eventId: string) {
  const wanted = await wantedRooms(tx, scope)
  await syncSpace(tx, scope, eventSpace(eventId, wanted), await isClosing(tx, scope.councilId))
}

// 이 기능 전에 만든 학생회는 방이 없다. 방 목록을 처음 읽을 때 한 번 채운다.
// 이미 있으면 잠그지 않고 돌아가므로 보통의 읽기는 쓰지 않는다. 없으면 학생회 행을 잠그고 다시 보아 두 요청이 방을 둘 만들지 않게 한다.
// 그만두는 학생회(DEC-55)는 읽기만 되므로 채우지 않는다(방 없이 빈 목록이다).
export async function ensureCouncilRooms(db: Db, scope: Scope) {
  const hasAllRoom = (reader: Pick<Db, 'select'>) =>
    reader
      .select({ id: chatRoom.id })
      .from(chatRoom)
      .innerJoin(record, eq(record.id, chatRoom.id))
      .where(
        and(eq(record.councilId, scope.councilId), eq(chatRoom.type, 'all_members'), isPlanRoom),
      )
      .then(rows => rows.length > 0)
  if ((await hasAllRoom(db)) || (await isClosing(db, scope.councilId))) return
  await db.transaction(async tx => {
    const { closing } = await lockCouncil(tx, scope.councilId)
    if (!closing && !(await hasAllRoom(tx))) await syncRooms(tx, scope)
  })
}

// 이 기능 전에 만든 행사는 방이 없다. 방 목록이나 행사 방을 읽을 때 채운다(ensureCouncilRooms와 같은 방식).
// 공지방이 없는 보관되지 않은 행사가 없으면 잠그지 않고 돌아간다. 있으면 학생회 행을 잠그고 다시 보아 두 요청이 방을 둘 만들지 않게 한다.
export async function ensureEventRooms(db: Db, scope: Scope) {
  if (!(await openEventIdsOf(db, scope.councilId, true)).length) return
  if (await isClosing(db, scope.councilId)) return
  await db.transaction(async tx => {
    const { closing } = await lockCouncil(tx, scope.councilId)
    if (closing) return
    for (const eventId of await openEventIdsOf(tx, scope.councilId, true))
      await syncEventRooms(tx, scope, eventId)
  })
}
