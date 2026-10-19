import { and, eq, isNull } from 'drizzle-orm'
import type { DepartmentRank } from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import { can } from '../access/permissions.js'
import {
  councilMembership,
  department,
  departmentMembership,
  record,
  recordVersion,
} from '../db/schema.js'
import { ApiError } from '../http/errors.js'
import {
  clockNow,
  createRecord,
  updateRecord,
  updateRecords,
  type AnyRecordChange,
  type Tx,
} from '../records/records.js'

// 회장단이 하는 운영진 편성(DEC-28, DEC-47). 모두 학생회 행을 잠근 거래 안에서 부른다(authorizeChange).
// 대상은 요청한 사람과 같은 기수의 지금 소속이어야 한다. 다른 학생회의 운영진이나 내보낸 운영진은 404다.

export async function currentMembership(tx: Tx, actor: Actor, memberId: string) {
  const [row] = await tx
    .select({ id: councilMembership.id, councilRank: councilMembership.councilRank })
    .from(councilMembership)
    .where(
      and(
        eq(councilMembership.memberId, memberId),
        eq(councilMembership.cohortId, actor.cohortId),
        isNull(councilMembership.endsAt),
      ),
    )
  if (!row) throw new ApiError('NOT_FOUND', 404)
  return row
}

export async function departmentOf(tx: Tx, actor: Actor, departmentId: string) {
  const [row] = await tx
    .select({ id: department.id, name: department.name, role: department.role })
    .from(department)
    .where(and(eq(department.id, departmentId), eq(department.councilId, actor.councilId)))
  if (!row) throw new ApiError('NOT_FOUND', 404)
  return row
}

const placementOf = (tx: Tx, actor: Actor, memberId: string, departmentId: string) =>
  tx
    .select({
      id: departmentMembership.id,
      endsAt: departmentMembership.endsAt,
      rank: departmentMembership.departmentRank,
    })
    .from(departmentMembership)
    .where(
      and(
        eq(departmentMembership.memberId, memberId),
        eq(departmentMembership.departmentId, departmentId),
        eq(departmentMembership.cohortId, actor.cohortId),
      ),
    )

// 부서 배정과 부서 직급. 처음이면 소속을 만들고, 빠졌던 부서면 같은 소속을 다시 열고, 이미 있으면 직급만 바꾼다.
export async function assignDepartment(
  tx: Tx,
  actor: Actor,
  memberId: string,
  departmentId: string,
  rank: DepartmentRank | null,
) {
  await currentMembership(tx, actor, memberId)
  await departmentOf(tx, actor, departmentId)
  const [placement] = await placementOf(tx, actor, memberId, departmentId)
  const current = placement && placement.endsAt === null ? placement : undefined
  // 부장과 부부장 직급을 주고 거두는 것은 직급 칸이다(DEC-28).
  if ((current?.rank ?? null) !== rank && !can(actor, 'rank.manage'))
    throw new ApiError('FORBIDDEN', 403)
  if (!placement) {
    await createRecord(tx, {
      kind: 'department_membership',
      councilId: actor.councilId,
      actor: actor.memberId,
      values: {
        memberId,
        departmentId,
        cohortId: actor.cohortId,
        departmentRank: rank,
        startsAt: clockNow,
      },
    })
  } else if (!current) {
    await updateRecord(tx, {
      kind: 'department_membership',
      id: placement.id,
      actor: actor.memberId,
      reason: null,
      changes: { startsAt: clockNow, endsAt: null, departmentRank: rank },
    })
  } else if (current.rank !== rank) {
    await updateRecord(tx, {
      kind: 'department_membership',
      id: current.id,
      actor: actor.memberId,
      reason: null,
      changes: { departmentRank: rank },
    })
  }
}

// 부서에서 빼기. 소속을 지우지 않고 끝 시각을 적는다(DEC-27 기준 6).
// 부서 직급이 붙은 소속을 끝내는 것은 그 직급을 거두는 일이기도 해서 직급 칸도 본다(최소 권한, DEC-28).
export async function removeFromDepartment(
  tx: Tx,
  actor: Actor,
  memberId: string,
  departmentId: string,
) {
  await currentMembership(tx, actor, memberId)
  const [placement] = await placementOf(tx, actor, memberId, departmentId)
  if (!placement || placement.endsAt !== null) throw new ApiError('NOT_FOUND', 404)
  if (placement.rank !== null && !can(actor, 'rank.manage')) throw new ApiError('FORBIDDEN', 403)
  await updateRecord(tx, {
    kind: 'department_membership',
    id: placement.id,
    actor: actor.memberId,
    reason: null,
    changes: { endsAt: clockNow },
  })
}

// 부회장 주고 거두기. 회장의 직급을 바꾸면 회장이 없어지므로 기록 모듈이 409 PRESIDENT_REQUIRED로 막는다.
export async function changeRank(
  tx: Tx,
  actor: Actor,
  memberId: string,
  rank: 'vice_president' | null,
) {
  const target = await currentMembership(tx, actor, memberId)
  if (target.councilRank === rank) return
  await updateRecord(tx, {
    kind: 'council_membership',
    id: target.id,
    actor: actor.memberId,
    reason: null,
    changes: { councilRank: rank },
  })
}

// 회장 넘기기: 한 번에 거두고 준다. 넘긴 사람은 직급 없음이 된다(바탕 spec).
// 거두기를 앞에, 주기를 뒤에 넘긴다. 기수마다 회장 한 명인 부분 유일 인덱스는 미룰 수 없어 순서가 바뀌면 DB가 거부한다(records.ts).
export async function transferPresident(tx: Tx, actor: Actor, memberId: string) {
  if (memberId === actor.memberId) throw new ApiError('ALREADY_PRESIDENT', 409)
  const target = await currentMembership(tx, actor, memberId)
  await updateRecords(tx, [
    {
      kind: 'council_membership',
      id: actor.membershipId,
      actor: actor.memberId,
      reason: null,
      changes: { councilRank: null },
    },
    {
      kind: 'council_membership',
      id: target.id,
      actor: actor.memberId,
      reason: null,
      changes: { councilRank: 'president' },
    },
  ])
}

// 내보내기: 학생회 소속과 그 기수의 부서 소속을 함께 끝낸다(바탕 spec G4). 회장은 넘긴 뒤에만, 스스로 나가기는 없다.
// 학생회 직급이나 부서 직급이 붙은 소속이 있으면 그 직급을 거두는 일이기도 해서 직급 칸도 본다.
export async function removeMember(tx: Tx, actor: Actor, memberId: string) {
  const target = await currentMembership(tx, actor, memberId)
  if (target.councilRank === 'president') throw new ApiError('PRESIDENT_CANNOT_LEAVE', 409)
  if (memberId === actor.memberId) throw new ApiError('CANNOT_REMOVE_SELF', 409)
  const placements = await tx
    .select({ id: departmentMembership.id, rank: departmentMembership.departmentRank })
    .from(departmentMembership)
    .where(
      and(
        eq(departmentMembership.memberId, memberId),
        eq(departmentMembership.cohortId, actor.cohortId),
        isNull(departmentMembership.endsAt),
      ),
    )
  if (
    (target.councilRank !== null || placements.some(item => item.rank !== null)) &&
    !can(actor, 'rank.manage')
  )
    throw new ApiError('FORBIDDEN', 403)
  const changes: AnyRecordChange[] = [
    ...placements.map(item => ({
      kind: 'department_membership' as const,
      id: item.id,
      actor: actor.memberId,
      reason: null,
      changes: { endsAt: clockNow },
    })),
    {
      kind: 'council_membership',
      id: target.id,
      actor: actor.memberId,
      reason: null,
      changes: { endsAt: clockNow },
    },
  ]
  await updateRecords(tx, changes)
}

async function assertNameFree(tx: Tx, actor: Actor, name: string) {
  const [taken] = await tx
    .select({ id: department.id })
    .from(department)
    .where(and(eq(department.councilId, actor.councilId), eq(department.name, name)))
  if (taken) throw new ApiError('DEPARTMENT_NAME_TAKEN', 409)
}

// 부서 만들기. 역할 없이 만든다.
export async function createDepartment(tx: Tx, actor: Actor, name: string) {
  await assertNameFree(tx, actor, name)
  await createRecord(tx, {
    kind: 'department',
    councilId: actor.councilId,
    actor: actor.memberId,
    values: { name },
  })
}

// 이름 바꾸기와 재정 역할 주고 거두기. 바뀐 것이 없으면 판을 만들지 않는다.
export async function updateDepartment(
  tx: Tx,
  actor: Actor,
  departmentId: string,
  input: { name: string; role: 'finance' | null },
) {
  const current = await departmentOf(tx, actor, departmentId)
  if (current.name === input.name && current.role === input.role) return
  if (current.name !== input.name) await assertNameFree(tx, actor, input.name)
  await updateRecord(tx, {
    kind: 'department',
    id: departmentId,
    actor: actor.memberId,
    reason: null,
    changes: { name: input.name, role: input.role },
  })
}

// 쓰인 적 없는 부서만 없앤다(바탕 spec G8). 지우기는 기록 모듈의 일이 아니라서 여기서 판, 하위 행, 기록 행을 한 거래로 지운다.
// 부서 소속이 한 번이라도 있었으면(끝난 소속 포함) 409다. 다른 기록이 이 부서를 가리키면 외래 키가 막고, 라우트가 409로 바꾼다.
// 확정한 기록은 지우지 않는다(physical-model.md, DEC-27 기준 6). 바탕에는 부서를 확정하는 길이 없지만 여기서 지킨다.
export async function deleteDepartment(tx: Tx, actor: Actor, departmentId: string) {
  await departmentOf(tx, actor, departmentId)
  const [meta] = await tx
    .select({ confirmedAt: record.confirmedAt })
    .from(record)
    .where(eq(record.id, departmentId))
  if (meta?.confirmedAt) throw new ApiError('RECORD_CONFIRMED', 409)
  const [used] = await tx
    .select({ id: departmentMembership.id })
    .from(departmentMembership)
    .where(eq(departmentMembership.departmentId, departmentId))
    .limit(1)
  if (used) throw new ApiError('DEPARTMENT_IN_USE', 409)
  await tx.delete(recordVersion).where(eq(recordVersion.recordId, departmentId))
  await tx.delete(department).where(eq(department.id, departmentId))
  await tx.delete(record).where(eq(record.id, departmentId))
}
