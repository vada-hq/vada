import { and, eq } from 'drizzle-orm'
import { cohort, councilMembership, record } from '../db/schema.js'
import type { Tx } from '../db/types.js'
import { ApiError } from '../http/errors.js'
import type { AnyRecordChange, RecordKind } from './records.js'

// 기록이 가리키는 다른 기록과 사람은 같은 학생회의 것이어야 한다. 외래 키는 학생회까지 맞추지 못해 여기서 막는다.
// 이 검사는 만들 때 하고, 만든 뒤에도 바꿀 수 있는 칸(업무의 부서·담당자·행사, 예산 항목의 담당 부서, 행사의 책임자, 요청한 사람, 품목과 지출의 예산 항목, 지출의 행사·부탁한 사람·먼저 낸 사람, 양식의 참가비 계좌, 입금 기록의 수입, 수입의 예산 항목과 계좌)은 바꿀 때 다시 한다(assertChangeStaysInCouncil).
// 가리키는 곳이 없거나(null) 학생회를 알 수 없으면 ''를 돌려줘 기록의 학생회와 달라지게 한다.

// 업무에 잇는 결과물은 그 업무와 같은 학생회의 것이어야 한다(기능 015). 연결 표에는 학생회 번호가 없어 여기서 막는다.
// 서비스의 확인(tasks/link.ts)과 별개로 기록 모듈이 지켜, 잇는 곳이 늘어도 빠지지 않는다.
export async function assertTaskInCouncil(tx: Tx, councilId: string | null, taskId: string) {
  if ((await councilOfRecord(tx, taskId)) !== (councilId ?? '')) throw new ApiError('TASK_INVALID')
}

type Values = Record<string, unknown>

// 일정에 잇는 대상은 같은 학생회의 해당 종류여야 한다. 다른 종류의 UUID도 존재 여부를 드러내지 않는다.
export async function assertScheduleReferences(
  tx: Tx,
  councilId: string,
  values: { departmentId: string | null; eventId: string | null },
) {
  for (const [kind, id] of [
    ['department', values.departmentId],
    ['event', values.eventId],
  ] as const) {
    if (!id) continue
    const [row] = await tx
      .select({ id: record.id })
      .from(record)
      .where(and(eq(record.id, id), eq(record.councilId, councilId), eq(record.kind, kind)))
    if (!row) throw new ApiError('NOT_FOUND')
  }
}

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
// 바꿀 때는 바뀌는 칸만 오므로 없는 칸은 건너뛴다. 사람은 떠난 운영진도 막지 않는다.
const members = async (tx: Tx, councilId: string | null, ids: unknown[]) => {
  const owners: string[] = []
  for (const id of ids) if (id) owners.push(await councilOfMember(tx, id, councilId))
  return owners
}

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
  schedule_item: async (tx, _, v) => [
    ...(await optional(tx, field(v, 'departmentId', 'department_id'))),
    ...(await optional(tx, field(v, 'eventId', 'event_id'))),
  ],
  message: async (tx, _, v) => [await councilOfRecord(tx, v.roomId)],
  file: (tx, _, v) => optional(tx, v.attachedToId),
  // 담당자는 떠난 운영진도 막지 않는다(councilOfMember는 어느 기수든 소속이 있었으면 된다).
  task: async (tx, councilId, v) => {
    const owners: string[] = []
    for (const id of [field(v, 'departmentId', 'department_id'), field(v, 'eventId', 'event_id')])
      if (id) owners.push(await councilOfRecord(tx, id))
    const assignee = field(v, 'assigneeId', 'assignee_id')
    if (assignee) owners.push(await councilOfMember(tx, assignee, councilId))
    return owners
  },
  // 책임자는 떠난 운영진도 막지 않는다. 만들기는 책임자를 받지 않고 만든 사람(지금 운영진으로 확인된 요청자)으로 채운다(DEC-79).
  event: async (tx, councilId, v) => [
    ...(await members(tx, councilId, [field(v, 'ownerId', 'owner_id')])),
    ...(await optional(tx, field(v, 'previousEventId', 'previous_event_id'))),
  ],
  fiscal_period: (tx, _, v) => optional(tx, field(v, 'previousPeriodId', 'previous_period_id')),
  budget: (tx, _, v) => optional(tx, field(v, 'fiscalPeriodId', 'fiscal_period_id')),
  budget_item: async (tx, _, v) => [
    ...(await optional(tx, field(v, 'budgetId', 'budget_id'))),
    ...(await optional(tx, field(v, 'eventId', 'event_id'))),
    ...(await optional(tx, field(v, 'departmentId', 'department_id'))),
  ],
  request: async (tx, councilId, v) => [
    ...(await members(tx, councilId, [field(v, 'requestedBy', 'requested_by')])),
    ...(await optional(tx, field(v, 'defaultBudgetItemId', 'default_budget_item_id'))),
    ...(await optional(tx, field(v, 'eventId', 'event_id'))),
  ],
  shipment: (tx, _, v) => optional(tx, field(v, 'requestId', 'request_id')),
  line_item: async (tx, _, v) => [
    ...(await optional(tx, field(v, 'requestId', 'request_id'))),
    ...(await optional(tx, field(v, 'budgetItemId', 'budget_item_id'))),
  ],
  expense: async (tx, councilId, v) => [
    ...(await optional(tx, field(v, 'budgetItemId', 'budget_item_id'))),
    ...(await optional(tx, field(v, 'eventId', 'event_id'))),
    ...(await optional(tx, field(v, 'accountId', 'account_id'))),
    ...(await members(tx, councilId, [
      field(v, 'requestedBy', 'requested_by'),
      field(v, 'paidBy', 'paid_by'),
    ])),
  ],
  payment_line: async (tx, _, v) => [
    ...(await optional(tx, field(v, 'expenseId', 'expense_id'))),
    ...(await optional(tx, field(v, 'lineItemId', 'line_item_id'))),
  ],
  evidence: (tx, _, v) => optional(tx, field(v, 'expenseId', 'expense_id')),
  // 결재한 사람이 운영진이 아니면(감사 기구, 의결 기구) 그 기록의 학생회를 본다.
  approval: async (tx, councilId, v) => {
    const actorId = field(v, 'actorId', 'actor_id')
    const isMember = field(v, 'actorKind', 'actor_kind') === 'member'
    return [
      ...(await optional(tx, field(v, 'targetId', 'target_id'))),
      ...(isMember ? await members(tx, councilId, [actorId]) : await optional(tx, actorId)),
    ]
  },
  registration_form: async (tx, _, v) => [
    ...(await optional(tx, field(v, 'eventId', 'event_id'))),
    ...(await optional(tx, field(v, 'feeAccountId', 'fee_account_id'))),
  ],
  registration: (tx, _, v) => optional(tx, field(v, 'formId', 'form_id')),
  attendance: (tx, _, v) => optional(tx, field(v, 'registrationId', 'registration_id')),
  deposit: async (tx, _, v) => [
    ...(await optional(tx, field(v, 'registrationId', 'registration_id'))),
    ...(await optional(tx, field(v, 'incomeId', 'income_id'))),
  ],
  income: async (tx, _, v) => [
    ...(await optional(tx, field(v, 'fiscalPeriodId', 'fiscal_period_id'))),
    ...(await optional(tx, field(v, 'budgetItemId', 'budget_item_id'))),
    ...(await optional(tx, field(v, 'accountId', 'account_id'))),
  ],
  account_closing: (tx, _, v) => optional(tx, field(v, 'fiscalPeriodId', 'fiscal_period_id')),
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

// 바꿀 때 다시 보는 종류. 바꿀 수 있는 칸이 다른 학생회를 가리킬 수 있는 종류다.
const changeChecked: ReadonlySet<RecordKind> = new Set([
  'schedule_item',
  'budget_item',
  'task',
  'event',
  'request',
  'line_item',
  'expense',
  'registration_form',
  'deposit',
  'income',
])
// 바꿀 때 다시 본다. 기록의 학생회는 이미 있는 기록에서 읽는다.
export async function assertChangeStaysInCouncil(tx: Tx, change: AnyRecordChange) {
  if (!changeChecked.has(change.kind)) return
  const [owner] = await tx
    .select({ councilId: record.councilId })
    .from(record)
    .where(eq(record.id, change.id))
  await assertSameCouncil(tx, change.kind, owner?.councilId ?? null, change.changes)
}
