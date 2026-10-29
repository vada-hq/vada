import { and, asc, eq, inArray } from 'drizzle-orm'
import type { HomeDepartmentBudget } from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import { headDepartmentIds } from '../access/permissions.js'
import { currentPeriodOf } from '../budget/queries.js'
import { budgetItemsWithUsage } from '../budget/usage.js'
import { budgetItem } from '../db/schema.js'
import type { Db } from '../db/types.js'

// 항목이 여럿일 때 한 줄의 이름
export const DEPARTMENT_BUDGET_NAME = '우리 부서 예산'

// 부장 홈의 '우리 부서가 맡은 예산' 한 줄(대표 10/30, notes dept-home-content.md). 돈은 재정부가 쥐고, 부서는 맡은 항목의 한도를 본다.
// 대상은 지금 회계 기간 예산의 지출 항목 가운데 담당 부서가 직급 부서인 것이다(수입 항목은 쓸 한도가 없다).
// 남음은 예산 탭·재정 첫 화면과 같은 사용 가능(usage.ts: 배정 − 실제 지출 − 지출 예정)이라, 구매 요청이 결재되면 준다.
// 하나면 그 항목 이름과 금액, 여럿이면 '우리 부서 예산'과 합이다. 맡은 항목이 없거나 지금 기간이 없으면 null(줄을 숨김)이다.
export async function departmentBudgetOf(
  db: Pick<Db, 'select'>,
  actor: Actor,
  now: Date,
): Promise<HomeDepartmentBudget | null> {
  const departmentIds = headDepartmentIds(actor)
  if (!departmentIds.length) return null
  const period = await currentPeriodOf(db, actor, now)
  if (!period) return null
  const rows = await budgetItemsWithUsage(
    db,
    actor.councilId,
    and(
      eq(budgetItem.budgetId, period.budgetId),
      eq(budgetItem.type, 'expense'),
      inArray(budgetItem.departmentId, departmentIds),
    ),
    [asc(budgetItem.purpose), asc(budgetItem.id)],
  )
  const [first] = rows
  if (!first) return null
  const remainingOf = (row: (typeof rows)[number]) => row.usage.available ?? 0
  if (rows.length === 1)
    return { name: first.purpose, amount: first.amount, remaining: remainingOf(first) }
  return {
    name: DEPARTMENT_BUDGET_NAME,
    amount: rows.reduce((all, row) => all + row.amount, 0),
    remaining: rows.reduce((all, row) => all + remainingOf(row), 0),
  }
}
