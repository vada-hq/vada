import { and, eq, sql } from 'drizzle-orm'
import type { PgInsertValue, PgUpdateSetSource } from 'drizzle-orm/pg-core'
import {
  account,
  accountClosing,
  approval,
  attendance,
  budget,
  budgetItem,
  chatRoom,
  cohort,
  council,
  councilMembership,
  department,
  departmentMembership,
  deposit,
  event,
  evidence,
  expense,
  feePayment,
  file,
  fiscalPeriod,
  income,
  lineItem,
  member,
  message,
  notification,
  paymentLine,
  record,
  recordVersion,
  registration,
  registrationForm,
  request,
  task,
} from '../db/schema.js'
import type { Tx } from '../db/types.js'
import { ApiError } from '../http/errors.js'
import {
  isResultKind,
  linkResult,
  syncAfter,
  watchBefore,
  type StatusWriter,
} from '../tasks/result-sync.js'
import {
  assertChangeStaysInCouncil,
  assertSameCouncil,
  assertTaskInCouncil,
} from './same-council.js'

// 기록과 판(DEC-33, DEC-34, DEC-46). 모든 쓰기는 이 모듈을 거친다(바탕 spec '기록 모듈').
// 지금 상태도 판이다. 만들 때 판 1을 열고, 바꿀 때 지금 판을 닫고 새 판을 연다. 판에는 하위 행의 칸 값 전체를 담는다.
// 시각은 clock_timestamp()로 적어, 한 거래에서 두 번 바꿔도 판이 겹치거나 비지 않는다.

// 바탕이 다루는 종류와 하위 표. 다음 덩어리가 자기 종류를 여기에 더한다.
const tables = {
  council,
  member,
  cohort,
  council_membership: councilMembership,
  department,
  department_membership: departmentMembership,
  chat_room: chatRoom,
  message,
  file,
  notification,
  task,
  event,
  account,
  fiscal_period: fiscalPeriod,
  budget,
  budget_item: budgetItem,
  request,
  line_item: lineItem,
  expense,
  payment_line: paymentLine,
  evidence,
  approval,
  registration_form: registrationForm,
  registration,
  attendance,
  deposit,
  income,
  account_closing: accountClosing,
  fee_payment: feePayment,
}
export type RecordKind = keyof typeof tables
type Table<K extends RecordKind> = (typeof tables)[K]
// 하위 표에도 학생회 번호를 두는 종류(AGENTS.md 마이그레이션). 모듈이 기록의 학생회 번호를 그대로 넣는다.
const councilColumn: ReadonlySet<RecordKind> = new Set([
  'cohort',
  'department',
  'fiscal_period',
  'account',
  'fee_payment',
])
// 학생회를 넘어 이어지는 운영진과 학생회 자신만 학생회 번호를 비운다.
const withoutCouncil: ReadonlySet<RecordKind> = new Set(['council', 'member'])

export type RecordValues<K extends RecordKind> = Omit<
  PgInsertValue<Table<K>>,
  'id' | 'kind' | 'councilId'
>
export type RecordChange<K extends RecordKind> = {
  kind: K
  id: string
  // 바꾼 사람(운영진 번호). 신청자나 시스템이면 null이다.
  actor: string | null
  // 바꾼 사유. 확정한 기록(record.confirmed_at이 있음)을 바꿀 때만 꼭 받는다.
  reason: string | null
  changes: PgUpdateSetSource<Table<K>>
}
// 종류마다의 변경. 여러 종류를 한 번에 바꿀 때 칸 이름을 종류별로 검사한다.
export type AnyRecordChange = { [K in RecordKind]: RecordChange<K> }[RecordKind]

// 지금 시각. 거래 시작 시각(now())이 아니라 실제 시계 시각이다.
export const clockNow = sql`clock_timestamp()`

// 결과물에 일이 생겨 업무 상태가 저절로 앞으로 갈 때의 쓰기: 바꾼 사람 없이 까닭 코드를 판의 사유에 남긴다(DEC-82).
// 업무는 결과물 종류가 아니라 이 쓰기는 고리를 다시 돌리지 않는다.
const writeTaskStatus: StatusWriter = (tx, { taskId, status, cause }) =>
  updateRecords(tx, [{ kind: 'task', id: taskId, actor: null, reason: cause, changes: { status } }])

// 기록 하나와 하위 행 하나, 판 1을 함께 만들고 식별자를 돌려준다. actor는 만든 사람이고, 신청자나 시스템이면 null이다.
// taskId가 있으면 결과물과 업무를 같은 거래에서 잇고, 그때 오른 단계로 업무 상태를 옮긴다(결과물 종류만, 기능 015).
// 결과물 단계를 올릴 수 있는 쓰기(요청, 품목, 결재, 결제 내역, 공지 표시)는 끝에서 이어진 업무를 다시 센다. 그 밖의 쓰기는 아무것도 하지 않는다.
export async function createRecord<K extends RecordKind>(
  tx: Tx,
  {
    kind,
    councilId,
    actor,
    values,
    taskId,
  }: {
    kind: K
    councilId: string | null
    actor: string | null
    values: RecordValues<K>
    taskId?: string
  },
): Promise<string> {
  if (withoutCouncil.has(kind) !== (councilId === null))
    throw new Error(`${kind}: 학생회 번호 규칙에 어긋난다`)
  await assertSameCouncil(tx, kind, councilId, values)
  const watch = await watchBefore(tx, [{ kind, values }])
  const [created] = await tx
    .insert(record)
    .values({ kind, councilId, createdBy: actor, createdAt: clockNow })
    .returning({ id: record.id })
  const id = created!.id
  const table: Table<RecordKind> = tables[kind]
  await tx
    .insert(table)
    .values({ ...values, id, ...(councilColumn.has(kind) ? { councilId } : {}) } as PgInsertValue<
      Table<RecordKind>
    >)
  await tx.execute(sql`INSERT INTO record_version (record_id, version_no, valid, data, changed_by)
    SELECT r.id, 1, tstzrange(r.created_at, NULL), to_jsonb(t), r.created_by FROM record r JOIN ${table} t ON t.id = r.id WHERE r.id = ${id}`)
  if (taskId) {
    if (!isResultKind(kind)) throw new Error(`${kind}: 업무에 잇는 결과물 종류가 아니다`)
    await assertTaskInCouncil(tx, councilId, taskId)
    for (const [resultId, value] of await linkResult(tx, { taskId, resultId: id, kind }))
      watch.set(resultId, value)
  }
  await syncAfter(tx, watch, writeTaskStatus)
  return id
}

// 하위 행이 어느 학생회·기수·부서·운영진의 것인지 정하는 칸. 같은 학생회인지는 만들 때만 보므로(assertSameCouncil) 바꾸지 않는다.
const ownershipKeys: ReadonlySet<string> = new Set([
  'councilId',
  'cohortId',
  'departmentId',
  'memberId',
  'council_id',
  'cohort_id',
  'department_id',
  'member_id',
])
// 종류마다 더 있는 주인 칸. 대화는 메시지의 방, 파일의 붙은 기록과 저장 위치, 알림의 받는 사람과 기록, 방의 종류다.
// 칸 이름이 다른 종류의 일반 칸(type 등)과 겹치므로 종류별로 둔다.
const ownershipKeysOf: Partial<Record<RecordKind, ReadonlySet<string>>> = {
  chat_room: new Set(['type', 'eventId', 'event_id']),
  message: new Set(['roomId', 'room_id']),
  file: new Set(['attachedToId', 'attached_to_id', 'storageKey', 'storage_key']),
  notification: new Set(['recipientId', 'recipient_id', 'recordId', 'record_id']),
  // 업무의 행사는 고르고 바꾸고 비울 수 있다(changeableKeysOf). 바꿀 때도 같은 학생회를 다시 본다.
  task: new Set(['eventId', 'event_id']),
  // 행사의 책임자는 회장단이 바꾸고(changeableKeysOf), 이전 행사는 만든 뒤 바꾸지 않는다.
  event: new Set(['ownerId', 'owner_id', 'previousEventId', 'previous_event_id']),
  // 구매와 지출: 위의 것을 가리키는 칸은 만든 뒤 바꾸지 않는다. 품목의 예산 항목과 지출의 예산 항목·행사·부탁한 사람·먼저 낸 사람만 바꿀 수 있다.
  fiscal_period: new Set(['previousPeriodId', 'previous_period_id']),
  budget: new Set(['fiscalPeriodId', 'fiscal_period_id']),
  budget_item: new Set(['budgetId', 'budget_id', 'eventId', 'event_id']),
  // 지출의 계좌는 적을 때 정하고 바꾸지 않는다. 지출의 행사는 바꿀 수 있다(changeableKeysOf).
  expense: new Set(['eventId', 'event_id', 'accountId', 'account_id']),
  // 요청의 행사는 낼 때 고르고 바꾸지 않는다(DEC-68).
  request: new Set(['eventId', 'event_id']),
  line_item: new Set(['requestId', 'request_id']),
  payment_line: new Set(['expenseId', 'expense_id', 'lineItemId', 'line_item_id']),
  evidence: new Set(['expenseId', 'expense_id']),
  approval: new Set([
    'targetId',
    'target_id',
    'targetKind',
    'target_kind',
    'outcome',
    'actorId',
    'actor_id',
    'actorKind',
    'actor_kind',
    'actedAt',
    'acted_at',
  ]),
  // 신청 양식의 행사, 신청의 양식, 출석의 신청은 만든 뒤 바꾸지 않는다. 양식의 참가비 계좌만 바꾼다(changeableKeysOf).
  registration_form: new Set(['eventId', 'event_id', 'feeAccountId', 'fee_account_id']),
  registration: new Set(['formId', 'form_id']),
  attendance: new Set(['registrationId', 'registration_id']),
  // 입금 기록의 신청과 금액, 수입의 회계 기간·출처·금액은 바꾸지 않는다. 입금 기록의 수입과 수입의 예산 항목·계좌는 바꾼다(changeableKeysOf).
  deposit: new Set(['registrationId', 'registration_id', 'amount', 'incomeId', 'income_id']),
  income: new Set([
    'fiscalPeriodId',
    'fiscal_period_id',
    'source',
    'amount',
    'budgetItemId',
    'budget_item_id',
    'accountId',
    'account_id',
  ]),
  // 결산의 회계 기간은 만든 뒤 바꾸지 않는다. 공개 여부(published_at)만 바뀐다(DEC-70).
  account_closing: new Set(['fiscalPeriodId', 'fiscal_period_id']),
}
// 일반 주인 칸 가운데 그 종류만 바꿀 수 있는 것. 업무의 부서와 행사, 행사의 책임자는 정하고 바꾼다(바꿀 때도 같은 학생회를 다시 본다).
const changeableKeysOf: Partial<Record<RecordKind, ReadonlySet<string>>> = {
  task: new Set(['departmentId', 'department_id', 'eventId', 'event_id']),
  event: new Set(['ownerId', 'owner_id']),
  registration_form: new Set(['feeAccountId', 'fee_account_id']),
  // 지출의 행사는 재정부가 바꾼다. 바꾸기 전과 뒤가 완료 전인지는 서비스가 본다(DEC-68).
  expense: new Set(['eventId', 'event_id']),
  deposit: new Set(['incomeId', 'income_id']),
  income: new Set(['budgetItemId', 'budget_item_id', 'accountId', 'account_id']),
}

// 쿼리가 돌려준 행 수. drizzle의 execute는 드라이버가 준 모양 그대로 돌려준다: postgres-js는 배열, PGlite는 { rows }다.
function rowCount(result: unknown): number {
  const rows = Array.isArray(result) ? result : (result as { rows?: unknown } | null)?.rows
  if (!Array.isArray(rows)) throw new Error('쿼리 결과의 모양을 모른다')
  return rows.length
}

function assertNoOwnershipChange(changes: readonly AnyRecordChange[]) {
  for (const change of changes) {
    const extra = ownershipKeysOf[change.kind]
    const changeable = changeableKeysOf[change.kind]
    const owned = Object.keys(change.changes).filter(
      key => !changeable?.has(key) && (ownershipKeys.has(key) || extra?.has(key)),
    )
    if (owned.length)
      throw new Error(`${change.kind}: 주인 칸(${owned.join(', ')})은 바꾸지 않는다`)
  }
}

// 하위 행 잠금이 가장 먼저다. 이어서 확정 여부와 회장이었는지 읽기는 이 잠금 뒤에 해야 같은 기록을 바꾸던 거래가 끝난 값을 본다.
// 학생회 행을 잠그지 않고 이 모듈을 부르는 쪽은 이 순서에 기댄다. 순서를 바꾸지 않는다.
// FOR NO KEY UPDATE: 같은 기록을 바꾸는 거래는 한 줄로 세우되, 이 행을 가리키는 행을 넣을 때의 외래 키 검사(FOR KEY SHARE)는 막지 않는다.
async function lockRecord(tx: Tx, table: Table<RecordKind>, id: string) {
  const [current] = await tx
    .select({ id: table.id })
    .from(table)
    .where(eq(table.id, id))
    .for('no key update')
  if (!current) throw new ApiError('NOT_FOUND')
}

async function assertReasonGiven(tx: Tx, change: AnyRecordChange) {
  const [meta] = await tx
    .select({ confirmedAt: record.confirmedAt })
    .from(record)
    .where(eq(record.id, change.id))
  if (meta?.confirmedAt && !change.reason?.trim()) throw new ApiError('REASON_REQUIRED')
}

// 바꾸기 전에 회장이던 학생회 구성원이면 그 기수를 돌려준다. 끝에서 회장이 남았는지 본다.
async function presidentCohortOf(tx: Tx, change: AnyRecordChange) {
  if (change.kind !== 'council_membership') return null
  const [president] = await tx
    .select({ cohortId: councilMembership.cohortId })
    .from(councilMembership)
    .where(
      sql`${councilMembership.id} = ${change.id} AND ${councilMembership.councilRank} = 'president' AND ${councilMembership.endsAt} IS NULL`,
    )
  return president?.cohortId ?? null
}

// 새 판을 열려면 열린 지금 판이 있어야 한다. 하위 행을 쓰기 전에 먼저 보아, 없으면 아무것도 쓰지 않고 실패한다(거래를 되돌리는 드라이버에 기대지 않는다).
// 이 하위 행은 위에서 잠겼으므로 이 거래가 끝나기 전에는 열린 판이 바뀌지 않는다. 새 판 열기의 확인은 그대로 둔다.
async function assertOpenVersion(tx: Tx, change: AnyRecordChange) {
  const [openVersion] = await tx
    .select({ versionNo: recordVersion.versionNo })
    .from(recordVersion)
    .where(and(eq(recordVersion.recordId, change.id), sql`upper_inf(${recordVersion.valid})`))
  if (!openVersion) throw new Error(`${change.kind}: 지금 판이 없어 새 판을 열지 못했다`)
}

// 지금 판의 끝과 새 판의 시작을 같은 시각으로 잇는다. 시계가 같거나 뒤로 가도 판이 비지 않게 1마이크로초를 둔다.
// 새 판은 꼭 하나 열려야 한다. 열린 판이 없으면(판 없이 만든 기록, 이미 닫힌 판) 하위 행만 바뀌고 이력이 빠지므로 거래를 되돌린다.
async function openNextVersion(tx: Tx, table: Table<RecordKind>, change: AnyRecordChange) {
  const opened = await tx.execute(sql`WITH closed AS (
        UPDATE record_version SET valid = tstzrange(lower(valid), GREATEST(clock_timestamp(), lower(valid) + interval '1 microsecond'))
        WHERE record_id = ${change.id} AND upper_inf(valid)
        RETURNING version_no, upper(valid) AS ended_at
      )
      INSERT INTO record_version (record_id, version_no, valid, data, changed_by, reason)
      SELECT ${change.id}, closed.version_no + 1, tstzrange(closed.ended_at, NULL), to_jsonb(t), ${change.actor}, ${change.reason}
      FROM closed, ${table} t WHERE t.id = ${change.id}
      RETURNING version_no`)
  if (rowCount(opened) !== 1) throw new Error(`${change.kind}: 지금 판이 없어 새 판을 열지 못했다`)
}

async function assertPresidentRemains(tx: Tx, cohortId: string) {
  const [president] = await tx
    .select({ id: councilMembership.id })
    .from(councilMembership)
    .where(
      sql`${councilMembership.cohortId} = ${cohortId} AND ${councilMembership.councilRank} = 'president' AND ${councilMembership.endsAt} IS NULL`,
    )
  if (!president) throw new ApiError('PRESIDENT_REQUIRED')
}

// 여러 기록을 차례로 바꾼다. 하위 행을 잠그고 바꾼 뒤, 지금 판을 닫고 새 판을 연다.
// 회장이 없어지는 변경은 막는다(DEC-17, DEC-47). 회장 넘기기처럼 한 번에 거두고 주는 변경은 모두 바꾼 뒤에 본다.
// 회장 넘기기는 거두기를 먼저, 주기를 나중에 넘긴다. 기수마다 회장 한 명인 부분 유일 인덱스는 미룰 수 없어, 주기를 먼저 하면
// 그 자리에서 DB 오류(23505)로 거부된다. 거두기를 앞에 둘 책임은 부르는 쪽에 있다.
export async function updateRecords(tx: Tx, changes: readonly AnyRecordChange[]) {
  assertNoOwnershipChange(changes)
  const presidentCohorts = new Set<string>()
  const watch = await watchBefore(tx, changes)
  for (const change of changes) {
    const table: Table<RecordKind> = tables[change.kind]
    await lockRecord(tx, table, change.id)
    await assertChangeStaysInCouncil(tx, change)
    await assertReasonGiven(tx, change)
    const cohortId = await presidentCohortOf(tx, change)
    if (cohortId) presidentCohorts.add(cohortId)
    await assertOpenVersion(tx, change)
    await tx.update(table).set(change.changes).where(eq(table.id, change.id))
    await openNextVersion(tx, table, change)
  }
  for (const cohortId of presidentCohorts) await assertPresidentRemains(tx, cohortId)
  await syncAfter(tx, watch, writeTaskStatus)
}

export const updateRecord = <K extends RecordKind>(tx: Tx, change: RecordChange<K>) =>
  updateRecords(tx, [change as AnyRecordChange])
