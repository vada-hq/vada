import { and, eq, isNull } from 'drizzle-orm'
import type { DepartmentRank } from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import { can } from '../access/permissions.js'
import { councilMembership, department, departmentMembership } from '../db/schema.js'
import { ApiError } from '../http/errors.js'
import { clockNow, createRecord, updateRecord, updateRecords, type AnyRecordChange, type Tx } from '../records/records.js'

// 회장단이 하는 운영진 편성(DEC-28, DEC-47). 모두 학생회 행을 잠근 거래 안에서 부른다(authorizeChange).
// 대상은 요청한 사람과 같은 기수의 지금 소속이어야 한다. 다른 학생회의 운영진이나 내보낸 운영진은 404다.

export async function currentMembership(tx: Tx, actor: Actor, memberId: string) {
  const [row] = await tx.select({ id: councilMembership.id, councilRank: councilMembership.councilRank }).from(councilMembership)
    .where(and(eq(councilMembership.memberId, memberId), eq(councilMembership.cohortId, actor.cohortId), isNull(councilMembership.endsAt)))
  if (!row) throw new ApiError('NOT_FOUND', 404)
  return row
}

export async function departmentOf(tx: Tx, actor: Actor, departmentId: string) {
  const [row] = await tx.select({ id: department.id, name: department.name, role: department.role }).from(department)
    .where(and(eq(department.id, departmentId), eq(department.councilId, actor.councilId)))
  if (!row) throw new ApiError('NOT_FOUND', 404)
  return row
}

const placementOf = (tx: Tx, actor: Actor, memberId: string, departmentId: string) => tx
  .select({ id: departmentMembership.id, endsAt: departmentMembership.endsAt, rank: departmentMembership.departmentRank })
  .from(departmentMembership)
  .where(and(eq(departmentMembership.memberId, memberId), eq(departmentMembership.departmentId, departmentId), eq(departmentMembership.cohortId, actor.cohortId)))

// 부서 배정과 부서 직급. 처음이면 소속을 만들고, 빠졌던 부서면 같은 소속을 다시 열고, 이미 있으면 직급만 바꾼다.
export async function assignDepartment(tx: Tx, actor: Actor, memberId: string, departmentId: string, rank: DepartmentRank | null) {
  await currentMembership(tx, actor, memberId)
  await departmentOf(tx, actor, departmentId)
  const [placement] = await placementOf(tx, actor, memberId, departmentId)
  const current = placement && placement.endsAt === null ? placement : undefined
  // 부장과 부부장 직급을 주고 거두는 것은 직급 칸이다(DEC-28).
  if ((current?.rank ?? null) !== rank && !can(actor, 'rank.manage')) throw new ApiError('FORBIDDEN', 403)
  if (!placement) {
    await createRecord(tx, { kind: 'department_membership', councilId: actor.councilId, actor: actor.memberId,
      values: { memberId, departmentId, cohortId: actor.cohortId, departmentRank: rank, startsAt: clockNow } })
  } else if (!current) {
    await updateRecord(tx, { kind: 'department_membership', id: placement.id, actor: actor.memberId, reason: null,
      changes: { startsAt: clockNow, endsAt: null, departmentRank: rank } })
  } else if (current.rank !== rank) {
    await updateRecord(tx, { kind: 'department_membership', id: current.id, actor: actor.memberId, reason: null, changes: { departmentRank: rank } })
  }
}

// 부서에서 빼기. 소속을 지우지 않고 끝 시각을 적는다(DEC-27 기준 6).
export async function removeFromDepartment(tx: Tx, actor: Actor, memberId: string, departmentId: string) {
  await currentMembership(tx, actor, memberId)
  const [placement] = await placementOf(tx, actor, memberId, departmentId)
  if (!placement || placement.endsAt !== null) throw new ApiError('NOT_FOUND', 404)
  await updateRecord(tx, { kind: 'department_membership', id: placement.id, actor: actor.memberId, reason: null, changes: { endsAt: clockNow } })
}

// 부회장 주고 거두기. 회장의 직급을 바꾸면 회장이 없어지므로 기록 모듈이 409 PRESIDENT_REQUIRED로 막는다.
export async function changeRank(tx: Tx, actor: Actor, memberId: string, rank: 'vice_president' | null) {
  const target = await currentMembership(tx, actor, memberId)
  if (target.councilRank === rank) return
  await updateRecord(tx, { kind: 'council_membership', id: target.id, actor: actor.memberId, reason: null, changes: { councilRank: rank } })
}

// 회장 넘기기: 한 번에 거두고 준다. 넘긴 사람은 직급 없음이 된다(바탕 spec).
// 거두기를 앞에, 주기를 뒤에 넘긴다. 기수마다 회장 한 명인 부분 유일 인덱스는 미룰 수 없어 순서가 바뀌면 DB가 거부한다(records.ts).
export async function transferPresident(tx: Tx, actor: Actor, memberId: string) {
  if (memberId === actor.memberId) throw new ApiError('ALREADY_PRESIDENT', 409)
  const target = await currentMembership(tx, actor, memberId)
  await updateRecords(tx, [
    { kind: 'council_membership', id: actor.membershipId, actor: actor.memberId, reason: null, changes: { councilRank: null } },
    { kind: 'council_membership', id: target.id, actor: actor.memberId, reason: null, changes: { councilRank: 'president' } },
  ])
}

// 내보내기: 학생회 소속과 그 기수의 부서 소속을 함께 끝낸다(바탕 spec G4). 회장은 넘긴 뒤에만, 스스로 나가기는 없다.
export async function removeMember(tx: Tx, actor: Actor, memberId: string) {
  const target = await currentMembership(tx, actor, memberId)
  if (target.councilRank === 'president') throw new ApiError('PRESIDENT_CANNOT_LEAVE', 409)
  if (memberId === actor.memberId) throw new ApiError('CANNOT_REMOVE_SELF', 409)
  const placements = await tx.select({ id: departmentMembership.id }).from(departmentMembership)
    .where(and(eq(departmentMembership.memberId, memberId), eq(departmentMembership.cohortId, actor.cohortId), isNull(departmentMembership.endsAt)))
  const changes: AnyRecordChange[] = [
    ...placements.map(item => ({ kind: 'department_membership' as const, id: item.id, actor: actor.memberId, reason: null, changes: { endsAt: clockNow } })),
    { kind: 'council_membership', id: target.id, actor: actor.memberId, reason: null, changes: { endsAt: clockNow } },
  ]
  await updateRecords(tx, changes)
}
