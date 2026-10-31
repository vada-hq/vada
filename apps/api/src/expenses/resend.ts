import type { CreateExpense, ExpenseDetail } from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import {
  bodyHashOf,
  memberCommandKey,
  resentResultId,
  type ReceiptKey,
} from '../commands/receipt.js'
import type { Tx } from '../db/types.js'
import { expenseDetailOf } from './queries.js'

export const expenseKeyOf = (actor: Actor, commandId: string) =>
  memberCommandKey('expense_create', actor, commandId)

// 번호를 뺀 본문의 해시. 빠진 칸이 있으면 그 칸만 다른 본문이 같은 번호로 통과한다.
export const expenseBodyHashOf = (secret: string, input: CreateExpense) =>
  bodyHashOf(secret, [
    input.vendor,
    input.description,
    String(input.amount),
    input.paidOn,
    input.method,
    input.paidBy,
    input.reason,
    input.budgetItemId,
    input.eventId,
    input.requestedBy,
    input.accountId,
    input.sourceMessageId,
    JSON.stringify(input.lines.map(line => [line.lineItemId, line.amount])),
  ])

// 이 번호의 지출이 이미 있으면 새로 만들지 않고 그 지출의 지금 상세를 준다(취소했으면 취소된 상세).
export async function resendExpense(
  tx: Tx,
  actor: Actor,
  sent: { key: ReceiptKey; bodyHash: string; now: Date },
): Promise<ExpenseDetail | undefined> {
  const resultId = await resentResultId(tx, sent)
  return resultId ? expenseDetailOf(tx, actor, resultId) : undefined
}
