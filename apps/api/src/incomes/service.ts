import { eq } from 'drizzle-orm'
import { koreanDateOf, type CreateIncome, type IncomeDetail } from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import { assertUsableAccount } from '../accounts/queries.js'
import { can } from '../access/permissions.js'
import { assertPeriodIncomeItem, periodIdOn } from '../budget/queries.js'
import { income } from '../db/schema.js'
import type { Tx } from '../db/types.js'
import { ApiError } from '../http/errors.js'
import { clockNow, createRecord, updateRecord } from '../records/records.js'
import { assertIncomeWritable } from './lock.js'
import { canCancelIncome, incomeDetailOf, incomeRowOf, isAutomaticSource } from './queries.js'

// 쓰기 거래는 학생회 행 잠금 → 운영진 확인(inCouncilChange) → 수입 행 순서다. 이 함수들은 앞의 둘이 끝난 거래에서 부른다.
// 재정부만 쓴다(회장단도 403). 403이 다른 실패보다 먼저다.

// 수입 행을 잠그고 잠근 뒤의 값을 돌려준다. 앞의 읽기는 없는 수입과 다른 학생회의 수입을 잠그기 전에 404로 거르려는 것이다.
async function lockedIncomeRow(tx: Tx, actor: Actor, incomeId: string) {
  await incomeRowOf(tx, actor, incomeId)
  await tx
    .select({ id: income.id })
    .from(income)
    .where(eq(income.id, incomeId))
    .for('no key update')
  return incomeRowOf(tx, actor, incomeId)
}

// 수입은 사람이 적는 출처로만 만들고(참가비·이월금은 계약이 400으로 거른다) 고치지 않는다. 기간은 받은 날로 정한다.
export async function createIncome(
  tx: Tx,
  actor: Actor,
  input: CreateIncome,
  now: Date,
): Promise<IncomeDetail> {
  if (!can(actor, 'finance.manage')) throw new ApiError('FORBIDDEN')
  // 받은 날은 오늘(한국)까지다. 오늘 23:59:59는 받고 내일은 받지 않는다.
  if (input.receivedOn > koreanDateOf(now)) throw new ApiError('INVALID_INPUT')
  const periodId = await periodIdOn(tx, actor, input.receivedOn)
  // 다른 학생회의 항목·계좌(409)를 먼저 걸러야 잠금 확인이 그 행사의 완료 여부를 드러내지 않는다.
  if (input.budgetItemId) await assertPeriodIncomeItem(tx, actor, input.budgetItemId, periodId)
  // 학생회 행을 잠근 뒤에 읽으므로 계좌 닫기와 겹쳐도 하나로 정해진다.
  if (input.accountId) await assertUsableAccount(tx, actor, input.accountId)
  await assertIncomeWritable(tx, actor, { budgetItemId: input.budgetItemId, periodId })
  const incomeId = await createRecord(tx, {
    kind: 'income',
    councilId: actor.councilId,
    actor: actor.memberId,
    values: {
      fiscalPeriodId: periodId,
      source: input.source,
      amount: String(input.amount),
      receivedOn: input.receivedOn,
      description: input.description,
      budgetItemId: input.budgetItemId,
      accountId: input.accountId,
    },
  })
  return incomeDetailOf(tx, actor, incomeId)
}

// 취소는 지우지 않고 취소한 시각을 채운다. 사유는 판에 남는다.
// 이월금·참가비 수입은 결산 공개와 행사 완료가 만들고 취소하므로 여기서는 409 INCOME_AUTOMATIC이다.
export async function cancelIncome(
  tx: Tx,
  actor: Actor,
  incomeId: string,
  reason: string,
): Promise<IncomeDetail> {
  if (!can(actor, 'finance.manage')) throw new ApiError('FORBIDDEN')
  const row = await lockedIncomeRow(tx, actor, incomeId)
  if (isAutomaticSource(row.source)) throw new ApiError('INCOME_AUTOMATIC')
  await assertIncomeWritable(tx, actor, { budgetItemId: row.budgetItemId, periodId: row.periodId })
  if (!canCancelIncome(actor, { cancelled: row.cancelledAt !== null, source: row.source }))
    throw new ApiError('INCOME_CANCELLED')
  await updateRecord(tx, {
    kind: 'income',
    id: incomeId,
    actor: actor.memberId,
    reason,
    changes: { cancelledAt: clockNow },
  })
  return incomeDetailOf(tx, actor, incomeId)
}
