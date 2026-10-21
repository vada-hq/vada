import { eq } from 'drizzle-orm'
import {
  dateFromKorean,
  koreanDateOf,
  type CreateExpense,
  type ExpenseDetail,
} from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import { can } from '../access/permissions.js'
import { assertCurrentExpenseItems } from '../budget/queries.js'
import { currentMembersAmong } from '../chat/current-members.js'
import { expense } from '../db/schema.js'
import type { Tx } from '../db/types.js'
import { ApiError } from '../http/errors.js'
import { clockNow, createRecord, updateRecord } from '../records/records.js'
import { assertPayable } from './payable.js'
import { expenseDetailOf, expenseRowOf } from './queries.js'
import { canCancelExpense, canReimburse } from './status.js'

// 쓰기 거래는 학생회 행 잠금 → 운영진 확인(inCouncilChange) → 지출 행 순서다. 이 함수들은 앞의 둘이 끝난 거래에서 부른다.
// 재정부만 쓴다(회장단도 403). 403이 다른 실패보다 먼저다.

// 먼저 낸 사람과 부탁한 사람은 지금 이 학생회의 운영진이어야 한다. 기록 모듈은 떠난 운영진도 허용하므로 여기서 따로 본다.
async function assertCurrentMembers(tx: Tx, actor: Actor, ids: (string | null)[], now: Date) {
  const wanted = [...new Set(ids.filter((id): id is string => id !== null))]
  const alive = await currentMembersAmong(tx, actor.councilId, wanted, now)
  if (wanted.some(id => !alive.has(id))) throw new ApiError('MEMBER_INVALID')
}

async function assertInputAllowed(tx: Tx, actor: Actor, input: CreateExpense, now: Date) {
  // 결제일은 오늘(한국)까지다. 오늘 23:59:59는 받고 내일은 받지 않는다.
  if (input.paidOn > koreanDateOf(now)) throw new ApiError('INVALID_INPUT')
  await assertCurrentMembers(tx, actor, [input.paidBy, input.requestedBy], now)
  if (input.budgetItemId) await assertCurrentExpenseItems(tx, actor, [input.budgetItemId], now)
  await assertPayable(
    tx,
    actor,
    input.lines.map(line => line.lineItemId),
  )
}

// 지출을 적으면 같은 거래에서 적은 사람의 승인 결재 기록이 생긴다(DEC-41). 따로 결재하는 단계는 없다.
export async function createExpense(
  tx: Tx,
  actor: Actor,
  input: CreateExpense,
  now: Date,
): Promise<ExpenseDetail> {
  if (!can(actor, 'finance.manage')) throw new ApiError('FORBIDDEN')
  await assertInputAllowed(tx, actor, input, now)
  const expenseId = await createRecord(tx, {
    kind: 'expense',
    councilId: actor.councilId,
    actor: actor.memberId,
    values: {
      amount: String(input.amount),
      // 결제일은 그날 한국 0시로 저장한다.
      paidAt: dateFromKorean(`${input.paidOn}T00:00`),
      description: input.description,
      vendor: input.vendor,
      method: input.method,
      reason: input.reason,
      budgetItemId: input.budgetItemId,
      requestedBy: input.requestedBy,
      paidBy: input.paidBy,
    },
  })
  for (const line of input.lines)
    await createRecord(tx, {
      kind: 'payment_line',
      councilId: actor.councilId,
      actor: actor.memberId,
      values: { expenseId, lineItemId: line.lineItemId, amount: String(line.amount) },
    })
  await createRecord(tx, {
    kind: 'approval',
    councilId: actor.councilId,
    actor: actor.memberId,
    values: {
      targetId: expenseId,
      targetKind: 'expense',
      outcome: 'approved',
      actorId: actor.memberId,
      actorKind: 'member',
      actedAt: clockNow,
      reason: null,
    },
  })
  return expenseDetailOf(tx, actor, expenseId)
}

// 지출 행을 잠그고 잠근 뒤의 값을 돌려준다. 취소와 환급이 겹치면 이 잠금 뒤에 하나만 된다(나중 거래는 앞 거래가 끝난 값을 읽는다).
// 앞의 읽기는 없는 지출과 다른 학생회의 지출을 잠그기 전에 404로 거르려는 것이다.
async function lockedExpenseRow(tx: Tx, actor: Actor, expenseId: string) {
  await expenseRowOf(tx, actor, expenseId)
  await tx
    .select({ id: expense.id })
    .from(expense)
    .where(eq(expense.id, expenseId))
    .for('no key update')
  return expenseRowOf(tx, actor, expenseId)
}

const factsOf = (row: Awaited<ReturnType<typeof lockedExpenseRow>>) => ({
  cancelled: row.cancelledAt !== null,
  paidBy: row.paidById,
  reimbursed: row.reimbursedAt !== null,
})

// 취소는 지우지 않고 취소한 시각을 채운다. 사유는 판에 남는다. 이미 취소했으면 409다.
export async function cancelExpense(
  tx: Tx,
  actor: Actor,
  expenseId: string,
  reason: string,
): Promise<ExpenseDetail> {
  if (!can(actor, 'finance.manage')) throw new ApiError('FORBIDDEN')
  const row = await lockedExpenseRow(tx, actor, expenseId)
  if (!canCancelExpense(actor, factsOf(row))) throw new ApiError('EXPENSE_CANCELLED')
  await updateRecord(tx, {
    kind: 'expense',
    id: expenseId,
    actor: actor.memberId,
    reason,
    changes: { cancelledAt: clockNow },
  })
  return expenseDetailOf(tx, actor, expenseId)
}

// 환급은 먼저 낸 사람이 있고 취소되지 않은 지출에 한 번 표시하고 되돌리지 않는다.
export async function reimburseExpense(
  tx: Tx,
  actor: Actor,
  expenseId: string,
): Promise<ExpenseDetail> {
  if (!can(actor, 'finance.manage')) throw new ApiError('FORBIDDEN')
  const row = await lockedExpenseRow(tx, actor, expenseId)
  if (!canReimburse(actor, factsOf(row))) throw new ApiError('NOT_REIMBURSABLE')
  await updateRecord(tx, {
    kind: 'expense',
    id: expenseId,
    actor: actor.memberId,
    reason: null,
    changes: { reimbursedAt: clockNow },
  })
  return expenseDetailOf(tx, actor, expenseId)
}
