import type { Actor } from '../access/actor.js'
import type { Db } from '../db/types.js'
import { closingNumbersOf } from './numbers.js'
import type { ClosingPeriod } from './period.js'
import { accountRowsOf, budgetItemsOf, expenseRowsOf, incomeRowsOf } from './totals.js'

type Reader = Pick<Db, 'select'>

// 결산서 화면과 공개 검사(남은 돈)가 같은 계산 모듈을 쓰게 하는 한 곳이다. 읽기 거래와 공개 쓰기 거래가 모두 부른다.
export async function closingFiguresOf(db: Reader, actor: Actor, period: ClosingPeriod) {
  const incomes = await incomeRowsOf(db, actor, period)
  const numbers = closingNumbersOf({
    items: await budgetItemsOf(db, period),
    incomes,
    expenses: await expenseRowsOf(db, actor, period),
    accounts: await accountRowsOf(db, actor),
  })
  return { incomes, numbers }
}
