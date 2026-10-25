import type { CreateExpense, ExpenseDetail } from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import { bodyHashOf, receiptOf, type ReceiptKey } from '../commands/receipt.js'
import type { Tx } from '../db/types.js'
import { ApiError } from '../http/errors.js'
import { expenseDetailOf } from './queries.js'

// 같은 번호도 학생회와 보낸 운영진이 다르면 따로 센다(DEC-84). 다른 사람의 번호로 남의 지출을 받을 수 없다.
export const expenseKeyOf = (actor: Actor, commandId: string): ReceiptKey => ({
  kind: 'expense_create',
  scopeKey: `${actor.councilId}:${actor.memberId}`,
  commandId,
})

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
// 같은 번호에 다른 본문은 COMMAND_REUSED이고 아무것도 바꾸지 않는다.
// 학생회 행을 잠근 뒤(inCouncilChange)에 불러야 겹친 같은 명령 둘 중 나중 것이 앞의 영수증을 본다.
export async function resendExpense(
  tx: Tx,
  actor: Actor,
  sent: { key: ReceiptKey; bodyHash: string; now: Date },
): Promise<ExpenseDetail | undefined> {
  const receipt = await receiptOf(tx, sent.key, sent.now)
  if (!receipt) return undefined
  if (receipt.bodyHash !== sent.bodyHash) throw new ApiError('COMMAND_REUSED')
  return expenseDetailOf(tx, actor, receipt.resultId)
}
