import { and, eq, inArray, isNull, notInArray } from 'drizzle-orm'
import { lockCouncil } from '../access/authorize.js'
import {
  chatRoom,
  councilMembership,
  department,
  departmentMembership,
  record,
  roomMembership,
} from '../db/schema.js'
import type { Db, Tx } from '../db/types.js'
import { clockNow, createRecord } from '../records/records.js'
import { isPlanRoom } from './plan-room.js'

// 방 참여는 편성을 따른다(DEC-18, DEC-28): 전체방은 모든 운영진, 회장단방은 회장과 부회장, 부서방은 그 부서원.
// 편성이 바뀌는 거래가 끝나기 전에 부른다. 지금 편성에서 있어야 할 참여를 계산해 방과 줄을 맞춘다.
// 두 번 불러도 결과가 같다. 이미 있는 줄은 건드리지 않아 들어온 시각이 그대로다(DEC-20). 방은 지우지 않고 빠진 사람의 줄만 지운다.
// 1:1과 행사방, 부서 간 방은 편성이 아니라 사람이 정하므로 건드리지 않는다.
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

// 이 학생회에 이미 있는 편성 방. 지금 부원이 없는 부서방도 포함한다.
async function existingRooms(tx: Tx, councilId: string) {
  return tx
    .select({ id: chatRoom.id, type: chatRoom.type, departmentId: chatRoom.departmentId })
    .from(chatRoom)
    .innerJoin(record, eq(record.id, chatRoom.id))
    .where(
      and(
        eq(record.councilId, councilId),
        isPlanRoom,
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

export async function syncRooms(tx: Tx, scope: Scope) {
  const existing = await existingRooms(tx, scope.councilId)
  const wanted = await wantedRooms(tx, scope)
  const claimed = new Set<string>()
  for (const { room, memberIds } of wanted) {
    const found = existing.find(item => sameRoom(room, item as Wanted))
    const roomId =
      found?.id ??
      (await createRecord(tx, {
        kind: 'chat_room',
        councilId: scope.councilId,
        actor: scope.memberId,
        values: { type: room.type, departmentId: room.departmentId },
      }))
    claimed.add(roomId)
    await reconcileMembers(tx, roomId, memberIds)
  }
  // 부원이 모두 빠진 부서방은 방을 남기고 줄만 비운다.
  for (const item of existing) if (!claimed.has(item.id)) await reconcileMembers(tx, item.id, [])
}

// 이 기능 전에 만든 학생회는 방이 없다. 방 목록을 처음 읽을 때 한 번 채운다.
// 이미 있으면 잠그지 않고 돌아가므로 보통의 읽기는 쓰지 않는다. 없으면 학생회 행을 잠그고 다시 보아 두 요청이 방을 둘 만들지 않게 한다.
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
  if (await hasAllRoom(db)) return
  await db.transaction(async tx => {
    await lockCouncil(tx, scope.councilId)
    if (!(await hasAllRoom(tx))) await syncRooms(tx, scope)
  })
}
