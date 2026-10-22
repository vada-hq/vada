import { eq, inArray } from 'drizzle-orm'
import { expense, lineItem, paymentLine, request } from '../db/schema.js'
import type { Db, Tx } from '../db/types.js'
import { assertEventsOpen } from '../events/completion.js'

type Reader = Pick<Db, 'select'>

// 품목을 낸 요청들의 행사. 품목을 결제하는 지출은 그 행사의 기록이라 완료한 행사에서는 적을 수 없다(DEC-68).
export async function requestEventsOfLines(db: Reader, lineItemIds: readonly string[]) {
  if (!lineItemIds.length) return []
  const rows = await db
    .select({ eventId: request.eventId })
    .from(lineItem)
    .innerJoin(request, eq(request.id, lineItem.requestId))
    .where(inArray(lineItem.id, [...lineItemIds]))
  return rows.flatMap(row => (row.eventId ? [row.eventId] : []))
}

// 지출 하나의 행사: 지출에 적은 행사와 결제한 품목 요청들의 행사. 지출의 행사는 요청의 행사와 같게 지키지만(조각 5),
// 그 전에 만든 지출도 같은 잠금을 받도록 둘 다 본다.
async function eventsOfExpense(tx: Tx, expenseId: string) {
  const [own] = await tx
    .select({ eventId: expense.eventId })
    .from(expense)
    .where(eq(expense.id, expenseId))
  const lines = await tx
    .select({ lineItemId: paymentLine.lineItemId })
    .from(paymentLine)
    .where(eq(paymentLine.expenseId, expenseId))
  return [
    own?.eventId,
    ...(await requestEventsOfLines(
      tx,
      lines.map(line => line.lineItemId),
    )),
  ]
}

// 이미 있는 지출을 취소·환급·증빙으로 바꾸는 거래가 지출 행을 잠근 뒤에 부른다.
export async function assertExpenseEventOpen(tx: Tx, expenseId: string) {
  await assertEventsOpen(tx, await eventsOfExpense(tx, expenseId))
}
