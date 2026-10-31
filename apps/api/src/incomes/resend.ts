import type { CreateIncome, IncomeDetail } from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import {
  bodyHashOf,
  memberCommandKey,
  resentResultId,
  type ReceiptKey,
} from '../commands/receipt.js'
import type { Tx } from '../db/types.js'
import { incomeDetailOf } from './queries.js'

// 번호를 뺀 본문의 해시. 빠진 칸이 있으면 그 칸만 다른 본문이 같은 번호로 통과한다.
const incomeBodyHashOf = (secret: string, input: CreateIncome) =>
  bodyHashOf(secret, [
    input.source,
    String(input.amount),
    input.receivedOn,
    input.description,
    input.budgetItemId,
    input.accountId,
  ])

type IncomeCommand = { key: ReceiptKey; bodyHash: string; now: Date }

// 번호를 보내지 않은 옛 화면의 요청은 전처럼 영수증 없이 받는다. 계약이 번호를 필수로 바꾸면 이 갈래를 지운다.
export function incomeCommandOf(
  actor: Actor,
  input: CreateIncome,
  command: { now: Date; receiptKey: string },
): IncomeCommand | undefined {
  if (!input.commandId) return undefined
  return {
    key: memberCommandKey('income_create', actor, input.commandId),
    bodyHash: incomeBodyHashOf(command.receiptKey, input),
    now: command.now,
  }
}

// 이 번호의 수입이 이미 있으면 새로 만들지 않고 그 수입의 지금 상세를 준다(취소했으면 취소된 상세).
export async function resendIncome(
  tx: Tx,
  actor: Actor,
  sent: IncomeCommand,
): Promise<IncomeDetail | undefined> {
  const resultId = await resentResultId(tx, sent)
  return resultId ? incomeDetailOf(tx, actor, resultId) : undefined
}
