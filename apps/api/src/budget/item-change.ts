import { and, eq } from 'drizzle-orm'
import type { BudgetResponse, UpdateBudgetItem } from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import { can } from '../access/permissions.js'
import { budget, budgetItem, record, recordVersion } from '../db/schema.js'
import type { Tx } from '../db/types.js'
import { ApiError } from '../http/errors.js'
import { assertEventOpen, isPeriodClosed } from '../policy/locks.js'
import { updateRecord } from '../records/records.js'
import { usedBudgetItemIds } from './item-facts.js'
import { assertNamesFree } from './names.js'
import { budgetViewOf, periodById } from './queries.js'

// 예산 항목 고치기와 지우기(DEC-92, 024 조각 6). 다시 편성하는 화면 대신 항목마다 바로 고치고 판에 남긴다(Ramp, Brex, QuickBooks).
// 둘 다 재정부만(403이 먼저), 다른 학생회 항목은 없는 것과 같아 404, 완료한 행사의 항목은 EVENT_COMPLETED,
// 공개한 기간의 항목은 PERIOD_CLOSED다(결산서의 예산 칸이 바뀌므로, 두 잠금의 차례는 lockCodeOf와 같다).
// 응답은 그 항목이 든 기간의 예산이다(지난 기간 항목도 고칠 수 있다).

async function changeableItem(tx: Tx, actor: Actor, itemId: string) {
  if (!can(actor, 'finance.manage')) throw new ApiError('FORBIDDEN')
  const [item] = await tx
    .select({
      eventId: budgetItem.eventId,
      budgetId: budgetItem.budgetId,
      periodId: budget.fiscalPeriodId,
    })
    .from(budgetItem)
    .innerJoin(record, eq(record.id, budgetItem.id))
    .innerJoin(budget, eq(budget.id, budgetItem.budgetId))
    .where(and(eq(budgetItem.id, itemId), eq(record.councilId, actor.councilId)))
  if (!item) throw new ApiError('NOT_FOUND')
  await assertEventOpen(tx, item.eventId)
  if (await isPeriodClosed(tx, actor, item.periodId)) throw new ApiError('PERIOD_CLOSED')
  return item
}

async function viewOfPeriod(tx: Tx, periodId: string): Promise<BudgetResponse> {
  return budgetViewOf(tx, (await periodById(tx, periodId))!)
}

// 이름과 금액을 바꾸고 사유를 판에 남긴다. 종류와 행사는 바꾸지 않는다(DEC-68).
export async function updateBudgetItem(
  tx: Tx,
  actor: Actor,
  itemId: string,
  input: UpdateBudgetItem,
): Promise<BudgetResponse> {
  const item = await changeableItem(tx, actor, itemId)
  await assertNamesFree(
    tx,
    item.budgetId,
    [{ purpose: input.purpose, eventId: item.eventId }],
    itemId,
  )
  await updateRecord(tx, {
    kind: 'budget_item',
    id: itemId,
    actor: actor.memberId,
    reason: input.reason,
    changes: { purpose: input.purpose, amount: String(input.amount) },
  })
  return viewOfPeriod(tx, item.periodId)
}

// 쓰인 적 없는 항목만 판, 하위 행, 기록 행을 한 거래로 지운다(부서 지우기와 같은 순서). 쓰인 항목을 지우면 결재와 지출이 떨어진다.
// 가리키는 쓰기(결재, 지출, 수입, 요청)도 학생회 행 잠금 뒤라, 보고 지우는 사이에 새 가리킴이 끼지 않는다.
export async function deleteBudgetItem(
  tx: Tx,
  actor: Actor,
  itemId: string,
): Promise<BudgetResponse> {
  const item = await changeableItem(tx, actor, itemId)
  if ((await usedBudgetItemIds(tx, [itemId])).size) throw new ApiError('BUDGET_ITEM_IN_USE')
  await tx.delete(recordVersion).where(eq(recordVersion.recordId, itemId))
  await tx.delete(budgetItem).where(eq(budgetItem.id, itemId))
  await tx.delete(record).where(eq(record.id, itemId))
  return viewOfPeriod(tx, item.periodId)
}
