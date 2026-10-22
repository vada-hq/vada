import { and, count, desc, eq, isNotNull, sql } from 'drizzle-orm'
import {
  FEE_PAYMENT_SEARCH_LIMIT,
  type AddFeePaymentsRequest,
  type AddFeePaymentsResponse,
  type FeePaymentsResponse,
} from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import { feePayment } from '../db/schema.js'
import type { Db, Tx } from '../db/types.js'
import { ApiError } from '../http/errors.js'
import { clearFeeStudentIds } from './purge.js'
import { parseStudents, type ParsedStudents } from './parse.js'

const PERIOD_LIST_LIMIT = 200
// 한 번에 넣는 줄 수. 20,000개를 한 문장에 담지 않으려는 크기다.
const INSERT_CHUNK = 2_000

// 학번들을 납부자로 더한다. 같은 학생회·학번·시작일이 이미 있으면 건너뛴다(빼서 비운 줄은 학번이 없어 다시 더할 수 있다).
// 기록 모듈의 createRecord를 줄마다 부르면 20,000개에 6만 문장이라, 같은 모양(기록 + 하위 행 + 판 1)을 문장 하나로 만든다.
// 학생회 행을 잠근 거래에서 부르므로 같은 학생회의 다른 올리기가 겹쳐 중복을 만들지 않는다.
async function insertChunk(
  tx: Tx,
  actor: Actor,
  period: Pick<AddFeePaymentsRequest, 'paidFrom' | 'paidUntil'>,
  ids: string[],
) {
  const created = await tx.execute(sql`WITH picked AS MATERIALIZED (
      SELECT uuidv7() AS id, s AS student_id FROM jsonb_array_elements_text(${JSON.stringify(ids)}::jsonb) AS s
      WHERE NOT EXISTS (SELECT 1 FROM fee_payment f WHERE f.council_id = ${actor.councilId}
        AND f.student_id = s AND f.paid_from = ${period.paidFrom}::date)
    ), made AS (
      INSERT INTO record (id, kind, council_id, created_by, created_at)
      SELECT id, 'fee_payment', ${actor.councilId}::uuid, ${actor.memberId}::uuid, clock_timestamp() FROM picked
    )
    INSERT INTO fee_payment (id, council_id, student_id, paid_from, paid_until)
    SELECT id, ${actor.councilId}::uuid, student_id, ${period.paidFrom}::date, ${period.paidUntil}::date FROM picked
    RETURNING id`)
  const rows = Array.isArray(created) ? created : (created as { rows: { id: string }[] }).rows
  const made = rows.map(row => (row as { id: string }).id)
  if (made.length)
    await tx.execute(sql`INSERT INTO record_version (record_id, version_no, valid, data, changed_by)
      SELECT r.id, 1, tstzrange(r.created_at, NULL), to_jsonb(t), r.created_by
      FROM record r JOIN fee_payment t ON t.id = r.id
      WHERE r.id IN (SELECT jsonb_array_elements_text(${JSON.stringify(made)}::jsonb)::uuid)`)
  return made.length
}

export async function addFeePayments(
  tx: Tx,
  actor: Actor,
  input: AddFeePaymentsRequest,
): Promise<AddFeePaymentsResponse | Exclude<ParsedStudents, { kind: 'ok' }>> {
  const parsed = parseStudents(input.students)
  if (parsed.kind !== 'ok') return parsed
  let added = 0
  for (let from = 0; from < parsed.ids.length; from += INSERT_CHUNK)
    added += await insertChunk(tx, actor, input, parsed.ids.slice(from, from + INSERT_CHUNK))
  return { added, skipped: parsed.total - added }
}

// 기간마다 남은 학번 수. 학번을 찾으면 그 학번의 줄(학생회 안에서 기간마다 하나)을 함께 준다.
export async function feePaymentsOf(
  db: Pick<Db, 'select'>,
  actor: Actor,
  studentId: string | undefined,
): Promise<FeePaymentsResponse> {
  const own = and(eq(feePayment.councilId, actor.councilId), isNotNull(feePayment.studentId))
  const periods = await db
    .select({ paidFrom: feePayment.paidFrom, paidUntil: feePayment.paidUntil, count: count() })
    .from(feePayment)
    .where(own)
    .groupBy(feePayment.paidFrom, feePayment.paidUntil)
    .orderBy(desc(feePayment.paidFrom), desc(feePayment.paidUntil))
    .limit(PERIOD_LIST_LIMIT)
  const matches = studentId
    ? await db
        .select({
          id: feePayment.id,
          studentId: feePayment.studentId,
          paidFrom: feePayment.paidFrom,
          paidUntil: feePayment.paidUntil,
        })
        .from(feePayment)
        .where(and(own, eq(feePayment.studentId, studentId)))
        .orderBy(desc(feePayment.paidFrom))
        .limit(FEE_PAYMENT_SEARCH_LIMIT)
    : []
  return {
    periods,
    matches: matches.map(row => ({ ...row, studentId: row.studentId! })),
  }
}

// 빼기: 잘못 올린 학번을 비운다(행은 남는다). 다른 학생회 줄이나 이미 뺀 줄은 없는 것과 같아 404다.
export async function removeFeePayment(tx: Tx, actor: Actor, id: string) {
  const [row] = await tx
    .select({ id: feePayment.id })
    .from(feePayment)
    .where(
      and(
        eq(feePayment.id, id),
        eq(feePayment.councilId, actor.councilId),
        isNotNull(feePayment.studentId),
      ),
    )
  if (!row) throw new ApiError('NOT_FOUND')
  await clearFeeStudentIds(tx, sql`id = ${id}::uuid`)
}
