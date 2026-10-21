import { eq } from 'drizzle-orm'
import type { Actor } from '../access/actor.js'
import { expense } from '../db/schema.js'
import type { Tx } from '../db/types.js'
import { expenseRowOf } from './queries.js'

// 지출 행을 잠그고 잠근 뒤의 값을 돌려준다. 취소, 환급, 증빙 붙이기가 겹치면 이 잠금 뒤에 하나씩만 된다(나중 거래는 앞 거래가 끝난 값을 읽는다).
// 앞의 읽기는 없는 지출과 다른 학생회의 지출을 잠그기 전에 404로 거르려는 것이다.
export async function lockedExpenseRow(tx: Tx, actor: Actor, expenseId: string) {
  await expenseRowOf(tx, actor, expenseId)
  await tx
    .select({ id: expense.id })
    .from(expense)
    .where(eq(expense.id, expenseId))
    .for('no key update')
  return expenseRowOf(tx, actor, expenseId)
}
