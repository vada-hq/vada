import { and, eq, gte, lte, or } from 'drizzle-orm'
import type { BudgetResponse, CreateBudgetItem, CreateFiscalPeriod } from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import { can } from '../access/permissions.js'
import { carryoverIntoNewPeriod } from '../closing/carryover.js'
import { fiscalPeriod } from '../db/schema.js'
import type { Tx } from '../db/types.js'
import { assertCouncilEvent } from '../events/council-event.js'
import { ApiError } from '../http/errors.js'
import { createRecord } from '../records/records.js'
import { assertEventsOpen, isPeriodClosed } from '../policy/locks.js'
import { assertCouncilDepartment } from '../team/council-department.js'
import { assertNamesFree } from './names.js'
import { budgetViewOf, pickedPeriodOf, periodById, previousPeriodIdFor } from './queries.js'

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
  const previousPeriodId = await previousPeriodIdFor(tx, actor.councilId, input.startsOn)
  const periodId = await createRecord(tx, {
    kind: 'fiscal_period',
    councilId: actor.councilId,
    actor: actor.memberId,
    values: { ...input, previousPeriodId },
  })
  await createRecord(tx, {
    kind: 'budget',
    councilId: actor.councilId,
    actor: actor.memberId,
    values: { fiscalPeriodId: periodId },
  })
  // 이전 기간이 이미 공개됐으면 그 남은 돈이 이 기간의 이월금이 된다(DEC-70).
  await carryoverIntoNewPeriod(tx, actor, {
    id: periodId,
    startsOn: input.startsOn,
    previousPeriodId,
  })
  return budgetViewOf(tx, (await periodById(tx, periodId))!)
}

// 기간을 고르면 다음 기간도 미리 편성한다(DEC-92). 생략하면 오늘이 든 기간이다. 행사는 완료 전이어야 한다(DEC-68).
// 공개한 기간은 PERIOD_CLOSED다. 결산서의 예산 칸이 바뀌므로 고치기·지우기(item-change.ts)와 같이 막고, 행사 잠금이 먼저다.
// 여러 행(예산 편성, DEC-92)은 한 거래로 넣는다. 한 행이라도 막히면 거래가 되돌아가 아무것도 남지 않는다.
export async function addBudgetItems(
  tx: Tx,
  actor: Actor,
  inputs: readonly CreateBudgetItem[],
  choice: { now: Date; periodId?: string | undefined },
): Promise<BudgetResponse> {
  if (!can(actor, 'finance.manage')) throw new ApiError('FORBIDDEN')
  for (const eventId of new Set(inputs.map(input => input.eventId)))
    await assertCouncilEvent(tx, actor, eventId)
  for (const departmentId of new Set(inputs.map(input => input.departmentId)))
    await assertCouncilDepartment(tx, actor, departmentId)
  await assertEventsOpen(
    tx,
    inputs.map(input => input.eventId),
  )
  const period = await pickedPeriodOf(tx, actor, choice.now, choice.periodId)
  if (!period) throw new ApiError('NO_FISCAL_PERIOD')
  if (await isPeriodClosed(tx, actor, period.id)) throw new ApiError('PERIOD_CLOSED')
  await assertNamesFree(tx, period.budgetId, inputs)
  for (const input of inputs)
    await createRecord(tx, {
      kind: 'budget_item',
      councilId: actor.councilId,
      actor: actor.memberId,
      values: {
        budgetId: period.budgetId,
        type: input.type,
        eventId: input.eventId,
        departmentId: input.departmentId,
        purpose: input.purpose,
        amount: String(input.amount),
      },
    })
  return budgetViewOf(tx, period)
}

export const addBudgetItem = (
  tx: Tx,
  actor: Actor,
  input: CreateBudgetItem,
  choice: { now: Date; periodId?: string | undefined },
) => addBudgetItems(tx, actor, [input], choice)
