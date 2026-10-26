import { sql } from 'drizzle-orm'
import type { AddFeePaymentsRequest } from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import { feePayment } from '../db/schema.js'
import type { Tx } from '../db/types.js'
import { ApiError } from '../http/errors.js'
import { clearFeeStudentIds } from './purge.js'

// 학번과 시작일이 같은 행은 하나다. 끝일이 다른 명단의 값을 조용히 건너뛰거나 바꾸지 않는다.
export async function prepareFeeReplacement(
  tx: Tx,
  actor: Actor,
  input: AddFeePaymentsRequest,
  ids: string[],
) {
  const start = sql`council_id = ${actor.councilId}::uuid AND paid_from = ${input.paidFrom}::date`
  const students = sql`(SELECT jsonb_array_elements_text(${JSON.stringify(ids)}::jsonb))`
  const [conflict] = await tx
    .select({ id: feePayment.id })
    .from(feePayment)
    .where(sql`${start} AND paid_until <> ${input.paidUntil}::date AND student_id IN ${students}`)
    .limit(1)
  if (conflict) throw new ApiError('INVALID_INPUT')
  const period = sql`${start} AND paid_until = ${input.paidUntil}::date`
  const [existing] = await tx
    .select({ id: feePayment.id })
    .from(feePayment)
    .where(sql`${period} AND student_id IS NOT NULL`)
    .limit(1)
  if (existing && !input.replace) throw new ApiError('FEE_PAYMENT_REPLACE_REQUIRED')
  if (existing) await clearFeeStudentIds(tx, sql`${period} AND student_id NOT IN ${students}`)
}
