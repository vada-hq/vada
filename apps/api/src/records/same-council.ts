import { and, eq } from 'drizzle-orm'
import { cohort, councilMembership, record } from '../db/schema.js'
import type { Tx } from '../db/types.js'
import type { AnyRecordChange, RecordKind } from './records.js'

// 기록이 가리키는 다른 기록과 사람은 같은 학생회의 것이어야 한다. 외래 키는 학생회까지 맞추지 못해 여기서 막는다.
// 이 검사는 만들 때 하고, 만든 뒤에도 바꿀 수 있는 칸(업무의 부서와 담당자)은 바꿀 때 다시 한다(assertChangeStaysInCouncil).
// 가리키는 곳이 없거나(null) 학생회를 알 수 없으면 ''를 돌려줘 기록의 학생회와 달라지게 한다.

type Values = Record<string, unknown>

async function councilOfRecord(tx: Tx, id: unknown) {
  const [owner] = await tx
    .select({ councilId: record.councilId })
    .from(record)
    .where(eq(record.id, String(id)))
  return owner?.councilId ?? ''
}

async function councilOfCohort(tx: Tx, id: unknown) {
  const [owner] = await tx
    .select({ councilId: cohort.councilId })
    .from(cohort)
    .where(eq(cohort.id, String(id)))
  return owner?.councilId ?? ''
}

// 알림 받을 사람은 그 학생회의 어느 기수에든 소속이 있었던 운영진이면 된다. 알림을 만든 뒤 내보내져도 기록은 남는다.
async function councilOfMember(tx: Tx, memberId: unknown, councilId: string | null) {
  const [row] = await tx
    .select({ id: councilMembership.id })
    .from(councilMembership)
    .innerJoin(cohort, eq(cohort.id, councilMembership.cohortId))
    .where(
      and(eq(councilMembership.memberId, String(memberId)), eq(cohort.councilId, councilId ?? '')),
    )
    .limit(1)
  return row ? (councilId ?? '') : ''
}

// 만들 때는 camelCase, 바꿀 때는 DB 칸 이름으로도 올 수 있어 둘 다 본다.
const field = (v: Values, camel: string, snake: string) => v[camel] ?? v[snake]

const optional = async (tx: Tx, id: unknown) => (id ? [await councilOfRecord(tx, id)] : [])

// 종류마다 가리키는 곳의 학생회 번호들.
const ownersOf: Partial<
  Record<RecordKind, (tx: Tx, councilId: string | null, v: Values) => Promise<string[]>>
> = {
  council_membership: async (tx, _, v) => [await councilOfCohort(tx, v.cohortId)],
  department_membership: async (tx, _, v) => [
    await councilOfCohort(tx, v.cohortId),
    await councilOfRecord(tx, v.departmentId),
  ],
  chat_room: async (tx, _, v) => [
    ...(await optional(tx, v.departmentId)),
    ...(await optional(tx, v.eventId)),
  ],
  message: async (tx, _, v) => [await councilOfRecord(tx, v.roomId)],
  file: (tx, _, v) => optional(tx, v.attachedToId),
  // 담당자는 떠난 운영진도 막지 않는다(councilOfMember는 어느 기수든 소속이 있었으면 된다).
  task: async (tx, councilId, v) => {
    const owners: string[] = []
    for (const id of [field(v, 'departmentId', 'department_id'), v.eventId])
      if (id) owners.push(await councilOfRecord(tx, id))
    const assignee = field(v, 'assigneeId', 'assignee_id')
    if (assignee) owners.push(await councilOfMember(tx, assignee, councilId))
    return owners
  },
  notification: async (tx, councilId, v) => [
    await councilOfRecord(tx, v.recordId),
    await councilOfMember(tx, v.recipientId, councilId),
  ],
}

export async function assertSameCouncil(
  tx: Tx,
  kind: RecordKind,
  councilId: string | null,
  values: Values,
) {
  const owners = (await ownersOf[kind]?.(tx, councilId, values)) ?? []
  if (owners.some(owner => owner !== councilId))
    throw new Error(`${kind}: 가리키는 기록이나 사람의 학생회와 기록의 학생회가 다르다`)
}

// 바꿀 때 다시 보는 종류. 기록의 학생회는 이미 있는 기록에서 읽는다.
export async function assertChangeStaysInCouncil(tx: Tx, change: AnyRecordChange) {
  if (change.kind !== 'task') return
  const [owner] = await tx
    .select({ councilId: record.councilId })
    .from(record)
    .where(eq(record.id, change.id))
  await assertSameCouncil(tx, change.kind, owner?.councilId ?? null, change.changes)
}
