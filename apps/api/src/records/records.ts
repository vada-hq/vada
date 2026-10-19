import { eq, sql } from 'drizzle-orm'
import type { PgDatabase, PgInsertValue, PgQueryResultHKT, PgUpdateSetSource } from 'drizzle-orm/pg-core'
import { cohort, council, councilMembership, department, departmentMembership, member, record } from '../db/schema.js'
import { ApiError } from '../http/errors.js'

// 기록과 판(DEC-33, DEC-34, DEC-46). 모든 쓰기는 이 모듈을 거친다(바탕 spec '기록 모듈').
// 지금 상태도 판이다. 만들 때 판 1을 열고, 바꿀 때 지금 판을 닫고 새 판을 연다. 판에는 하위 행의 칸 값 전체를 담는다.
// 시각은 clock_timestamp()로 적어, 한 거래에서 두 번 바꿔도 판이 겹치거나 비지 않는다.

export type Db = PgDatabase<PgQueryResultHKT>
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0]

// 바탕이 다루는 종류와 하위 표. 다음 덩어리가 자기 종류를 여기에 더한다.
const tables = {
  council,
  member,
  cohort,
  council_membership: councilMembership,
  department,
  department_membership: departmentMembership,
}
export type RecordKind = keyof typeof tables
type Table<K extends RecordKind> = (typeof tables)[K]
// 하위 표에도 학생회 번호를 두는 종류(physical-model.md 작성 규칙). 모듈이 기록의 학생회 번호를 그대로 넣는다.
const councilColumn: ReadonlySet<RecordKind> = new Set(['cohort', 'department'])
// 학생회를 넘어 이어지는 운영진과 학생회 자신만 학생회 번호를 비운다.
const withoutCouncil: ReadonlySet<RecordKind> = new Set(['council', 'member'])

export type RecordValues<K extends RecordKind> = Omit<PgInsertValue<Table<K>>, 'id' | 'kind' | 'councilId'>
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

// 학생회 소속과 부서 소속은 기수나 부서의 학생회와 같아야 한다. DB가 막지 못해 여기서 막는다.
async function assertSameCouncil(tx: Tx, kind: RecordKind, councilId: string | null, values: Record<string, unknown>) {
  const owners: string[] = []
  if (kind === 'council_membership' || kind === 'department_membership') {
    const [owner] = await tx.select({ councilId: cohort.councilId }).from(cohort).where(eq(cohort.id, String(values.cohortId)))
    owners.push(owner?.councilId ?? '')
  }
  if (kind === 'department_membership') {
    const [owner] = await tx.select({ councilId: department.councilId }).from(department).where(eq(department.id, String(values.departmentId)))
    owners.push(owner?.councilId ?? '')
  }
  if (owners.some(owner => owner !== councilId)) throw new Error(`${kind}: 기수나 부서의 학생회와 기록의 학생회가 다르다`)
}

// 기록 하나와 하위 행 하나, 판 1을 함께 만들고 식별자를 돌려준다. actor는 만든 사람이고, 신청자나 시스템이면 null이다.
export async function createRecord<K extends RecordKind>(tx: Tx,
  { kind, councilId, actor, values }: { kind: K; councilId: string | null; actor: string | null; values: RecordValues<K> }): Promise<string> {
  if (withoutCouncil.has(kind) !== (councilId === null)) throw new Error(`${kind}: 학생회 번호 규칙에 어긋난다`)
  await assertSameCouncil(tx, kind, councilId, values as Record<string, unknown>)
  const [created] = await tx.insert(record).values({ kind, councilId, createdBy: actor, createdAt: clockNow }).returning({ id: record.id })
  const id = created!.id
  const table: Table<RecordKind> = tables[kind]
  await tx.insert(table).values({ ...values, id, ...(councilColumn.has(kind) ? { councilId } : {}) } as PgInsertValue<Table<RecordKind>>)
  await tx.execute(sql`INSERT INTO record_version (record_id, version_no, valid, data, changed_by)
    SELECT r.id, 1, tstzrange(r.created_at, NULL), to_jsonb(t), r.created_by FROM record r JOIN ${table} t ON t.id = r.id WHERE r.id = ${id}`)
  return id
}

// 하위 행이 어느 학생회·기수·부서·운영진의 것인지 정하는 칸. 같은 학생회인지는 만들 때만 보므로(assertSameCouncil) 바꾸지 않는다.
const ownershipKeys: ReadonlySet<string> = new Set(['councilId', 'cohortId', 'departmentId', 'memberId', 'council_id', 'cohort_id', 'department_id', 'member_id'])

// 여러 기록을 차례로 바꾼다. 하위 행을 잠그고 바꾼 뒤, 지금 판을 닫고 새 판을 연다.
// 회장이 없어지는 변경은 막는다(DEC-17, DEC-47). 회장 넘기기처럼 한 번에 거두고 주는 변경은 모두 바꾼 뒤에 본다.
export async function updateRecords(tx: Tx, changes: readonly AnyRecordChange[]) {
  for (const change of changes) {
    const owned = Object.keys(change.changes).filter(key => ownershipKeys.has(key))
    if (owned.length) throw new Error(`${change.kind}: 주인 칸(${owned.join(', ')})은 바꾸지 않는다`)
  }
  const presidentCohorts = new Set<string>()
  for (const change of changes) {
    const table: Table<RecordKind> = tables[change.kind]
    // FOR NO KEY UPDATE: 같은 기록을 바꾸는 거래는 한 줄로 세우되, 이 행을 가리키는 행을 넣을 때의 외래 키 검사(FOR KEY SHARE)는 막지 않는다.
    const [current] = await tx.select({ id: table.id }).from(table).where(eq(table.id, change.id)).for('no key update')
    if (!current) throw new ApiError('NOT_FOUND', 404)
    const [meta] = await tx.select({ confirmedAt: record.confirmedAt }).from(record).where(eq(record.id, change.id))
    if (meta?.confirmedAt && !change.reason?.trim()) throw new ApiError('REASON_REQUIRED', 400)
    if (change.kind === 'council_membership') {
      const [president] = await tx.select({ cohortId: councilMembership.cohortId }).from(councilMembership)
        .where(sql`${councilMembership.id} = ${change.id} AND ${councilMembership.councilRank} = 'president' AND ${councilMembership.endsAt} IS NULL`)
      if (president) presidentCohorts.add(president.cohortId)
    }
    await tx.update(table).set(change.changes as PgUpdateSetSource<Table<RecordKind>>).where(eq(table.id, change.id))
    // 지금 판의 끝과 새 판의 시작을 같은 시각으로 잇는다. 시계가 같거나 뒤로 가도 판이 비지 않게 1마이크로초를 둔다.
    await tx.execute(sql`WITH closed AS (
        UPDATE record_version SET valid = tstzrange(lower(valid), GREATEST(clock_timestamp(), lower(valid) + interval '1 microsecond'))
        WHERE record_id = ${change.id} AND upper_inf(valid)
        RETURNING version_no, upper(valid) AS ended_at
      )
      INSERT INTO record_version (record_id, version_no, valid, data, changed_by, reason)
      SELECT ${change.id}, closed.version_no + 1, tstzrange(closed.ended_at, NULL), to_jsonb(t), ${change.actor}, ${change.reason}
      FROM closed, ${table} t WHERE t.id = ${change.id}`)
  }
  for (const cohortId of presidentCohorts) {
    const [president] = await tx.select({ id: councilMembership.id }).from(councilMembership)
      .where(sql`${councilMembership.cohortId} = ${cohortId} AND ${councilMembership.councilRank} = 'president' AND ${councilMembership.endsAt} IS NULL`)
    if (!president) throw new ApiError('PRESIDENT_REQUIRED', 409)
  }
}

export const updateRecord = <K extends RecordKind>(tx: Tx, change: RecordChange<K>) => updateRecords(tx, [change as AnyRecordChange])
