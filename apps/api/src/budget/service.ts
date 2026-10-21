import { and, eq, gte, lte, or } from 'drizzle-orm'
import type { BudgetResponse, CreateBudgetItem, CreateFiscalPeriod } from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import { can } from '../access/permissions.js'
import { fiscalPeriod } from '../db/schema.js'
import type { Tx } from '../db/types.js'
import { ApiError } from '../http/errors.js'
import { createRecord } from '../records/records.js'
import { budgetViewOf, currentPeriodOf, periodById } from './queries.js'

// 쓰기 거래는 학생회 행 잠금 → 운영진 확인 뒤에 부른다. 같은 학생회의 쓰기는 그 잠금으로 한 줄로 서므로 겹침을 먼저 보고 넣어도 새지 않는다.
// 재정부만 쓴다(회장단도 403). 재정은 직급으로 물려받지 않는다.

// 같은 이름이거나 날짜가 겹치는(양 끝 포함) 기간이 있으면 막는다. 다른 학생회와는 겹쳐도 된다.
async function assertNoConflict(tx: Tx, actor: Actor, input: CreateFiscalPeriod) {
  const [clash] = await tx
    .select({ id: fiscalPeriod.id })
    .from(fiscalPeriod)
    .where(
      and(
        eq(fiscalPeriod.councilId, actor.councilId),
        or(
          eq(fiscalPeriod.name, input.name),
          and(lte(fiscalPeriod.startsOn, input.endsOn), gte(fiscalPeriod.endsOn, input.startsOn)),
        ),
      ),
    )
    .limit(1)
  if (clash) throw new ApiError('FISCAL_PERIOD_CONFLICT')
}

// 기간을 만들면 예산이 같이 생긴다(기간마다 하나). 만든 기간이 오늘을 담지 않을 수 있어 만든 기간의 예산을 돌려준다.
export async function createFiscalPeriod(
  tx: Tx,
  actor: Actor,
  input: CreateFiscalPeriod,
): Promise<BudgetResponse> {
  if (!can(actor, 'finance.manage')) throw new ApiError('FORBIDDEN')
  await assertNoConflict(tx, actor, input)
  const periodId = await createRecord(tx, {
    kind: 'fiscal_period',
    councilId: actor.councilId,
    actor: actor.memberId,
    values: input,
  })
  await createRecord(tx, {
    kind: 'budget',
    councilId: actor.councilId,
    actor: actor.memberId,
    values: { fiscalPeriodId: periodId },
  })
  return budgetViewOf(tx, (await periodById(tx, periodId))!)
}

// 지출 예산 항목은 오늘이 든 기간에 더한다. 기간이 없으면 409다.
export async function addBudgetItem(
  tx: Tx,
  actor: Actor,
  input: CreateBudgetItem,
  now: Date,
): Promise<BudgetResponse> {
  if (!can(actor, 'finance.manage')) throw new ApiError('FORBIDDEN')
  const period = await currentPeriodOf(tx, actor, now)
  if (!period) throw new ApiError('NO_FISCAL_PERIOD')
  await createRecord(tx, {
    kind: 'budget_item',
    councilId: actor.councilId,
    actor: actor.memberId,
    values: {
      budgetId: period.budgetId,
      type: 'expense',
      purpose: input.purpose,
      amount: String(input.amount),
    },
  })
  return budgetViewOf(tx, period)
}
