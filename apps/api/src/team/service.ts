import { and, eq, isNull } from 'drizzle-orm'
import type { DepartmentColorKey, DepartmentRank } from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import { currentCouncilMembership } from '../access/current-cohort.js'
import { can } from '../access/permissions.js'
import {
  cohort,
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
} from '../records/records.js'
import type { Db, Tx } from '../db/types.js'

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
  if (!row) throw new ApiError('NOT_FOUND')
  return row
}

export async function departmentOf(tx: Tx, actor: Actor, departmentId: string) {
  const [row] = await tx
    .select({
      id: department.id,
      name: department.name,
      role: department.role,
      color: department.color,
    })
    .from(department)
    .where(and(eq(department.id, departmentId), eq(department.councilId, actor.councilId)))
  if (!row) throw new ApiError('NOT_FOUND')
  return row
}

export const placementOf = (tx: Tx, actor: Actor, memberId: string, departmentId: string) =>
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
  {
    memberId,
    departmentId,
    rank,
  }: { memberId: string; departmentId: string; rank: DepartmentRank | null },
) {
  await currentMembership(tx, actor, memberId)
  await departmentOf(tx, actor, departmentId)
  const [placement] = await placementOf(tx, actor, memberId, departmentId)
  const current = placement && placement.endsAt === null ? placement : undefined
  // 부장과 부부장 직급을 주고 거두는 것은 직급 칸이다(DEC-28).
  if ((current?.rank ?? null) !== rank && !can(actor, 'rank.manage'))
    throw new ApiError('FORBIDDEN')
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
  if (!placement || placement.endsAt !== null) throw new ApiError('NOT_FOUND')
  if (placement.rank !== null && !can(actor, 'rank.manage')) throw new ApiError('FORBIDDEN')
  await updateRecord(tx, {
    kind: 'department_membership',
    id: placement.id,
    actor: actor.memberId,
    reason: null,
    changes: { endsAt: clockNow },
  })
}

// 부회장 주고 거두기. 회장의 직급을 바꾸면 회장이 없어지므로 기록 모듈이 PRESIDENT_REQUIRED로 막는다.
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

// 그 운영진이 지금 기수의 회장인 학생회들. 회장은 넘긴 뒤에만 나가거나 탈퇴한다(DEC-47, DEC-64).
// 지난 기수의 회장 직급은 넘길 수 없으므로 세지 않는다. 지금 기수의 뜻은 current-cohort.ts 한 곳이다.
export async function currentPresidentCouncils(
  db: Pick<Db, 'select'>,
  memberId: string,
  now: Date,
): Promise<string[]> {
  const rows = await db
    .select({ councilId: cohort.councilId })
    .from(councilMembership)
    .innerJoin(cohort, eq(cohort.id, councilMembership.cohortId))
    .where(
      and(
        eq(councilMembership.memberId, memberId),
        eq(councilMembership.councilRank, 'president'),
        currentCouncilMembership(now),
      ),
    )
  return rows.map(row => row.councilId)
}

// 회장 직급을 한 소속에서 다른 소속으로 한 번에 옮긴다. 옛 회장은 직급 없음이 된다(바탕 spec).
// 거두기를 앞에, 주기를 뒤에 넘긴다. 기수마다 회장 한 명인 부분 유일 인덱스는 미룰 수 없어 순서가 바뀌면 DB가 거부한다(records.ts).
// 회장 넘기기와 운영 명령의 회장 되찾기(DEC-57, actor 없음)가 같이 쓴다. 학생회 행을 잠근 거래 안에서 부른다.
export async function handOverPresident(
  tx: Tx,
  change: { from: string; to: string; actor: string | null; reason: string | null },
) {
  const { actor, reason } = change
  await updateRecords(tx, [
    { kind: 'council_membership', id: change.from, actor, reason, changes: { councilRank: null } },
    {
      kind: 'council_membership',
      id: change.to,
      actor,
      reason,
      changes: { councilRank: 'president' },
    },
  ])
}

// 회장 넘기기: 회장이 지금 기수의 다른 운영진에게 넘긴다.
export async function transferPresident(tx: Tx, actor: Actor, memberId: string) {
  if (memberId === actor.memberId) throw new ApiError('ALREADY_PRESIDENT')
  const target = await currentMembership(tx, actor, memberId)
  await handOverPresident(tx, {
    from: actor.membershipId,
    to: target.id,
    actor: actor.memberId,
    reason: null,
  })
}

// 내보내기: 학생회 소속과 그 기수의 부서 소속을 함께 끝낸다(바탕 spec G4). 회장은 넘긴 뒤에만, 스스로 나가기는 없다.
// 학생회 직급이나 부서 직급이 붙은 소속이 있으면 그 직급을 거두는 일이기도 해서 직급 칸도 본다.
export async function removeMember(tx: Tx, actor: Actor, memberId: string) {
  const target = await currentMembership(tx, actor, memberId)
  if (target.councilRank === 'president') throw new ApiError('PRESIDENT_CANNOT_LEAVE')
  if (memberId === actor.memberId) throw new ApiError('CANNOT_REMOVE_SELF')
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
    throw new ApiError('FORBIDDEN')
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
  if (taken) throw new ApiError('DEPARTMENT_NAME_TAKEN')
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

// 색만 바꿔 동시 변경된 이름·재정 역할을 덮지 않는다. 같은 선택색이면 판을 더 만들지 않는다.
export async function updateDepartmentColor(
  tx: Tx,
  actor: Actor,
  departmentId: string,
  color: DepartmentColorKey,
) {
  const current = await departmentOf(tx, actor, departmentId)
  if (current.color === color) return
  await updateRecord(tx, {
    kind: 'department',
    id: departmentId,
    actor: actor.memberId,
    reason: null,
    changes: { color },
  })
}

// 쓰인 적 없는 부서만 없앤다(바탕 spec G8). 지우기는 기록 모듈의 일이 아니라서 여기서 판, 하위 행, 기록 행을 한 거래로 지운다.
// 부서 소속이 한 번이라도 있었으면(끝난 소속 포함) 409다. 다른 기록이 이 부서를 가리키면 외래 키가 막고, 라우트가 409로 바꾼다.
// 확정한 기록은 지우지 않는다(DEC-27 기준 6). 바탕에는 부서를 확정하는 길이 없지만 여기서 지킨다.
export async function deleteDepartment(tx: Tx, actor: Actor, departmentId: string) {
  await departmentOf(tx, actor, departmentId)
  const [meta] = await tx
    .select({ confirmedAt: record.confirmedAt })
    .from(record)
    .where(eq(record.id, departmentId))
  if (meta?.confirmedAt) throw new ApiError('RECORD_CONFIRMED')
  const [used] = await tx
    .select({ id: departmentMembership.id })
    .from(departmentMembership)
    .where(eq(departmentMembership.departmentId, departmentId))
    .limit(1)
  if (used) throw new ApiError('DEPARTMENT_IN_USE')
  await tx.delete(recordVersion).where(eq(recordVersion.recordId, departmentId))
  await tx.delete(department).where(eq(department.id, departmentId))
  await tx.delete(record).where(eq(record.id, departmentId))
}
