import { and, eq, inArray, isNull, or } from 'drizzle-orm'
import type { ExpenseSummary } from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import {
  department,
  departmentMembership,
  expense,
  lineItem,
  paymentLine,
  record,
  request,
} from '../db/schema.js'
import type { Db } from '../db/types.js'

type Departments = ExpenseSummary['departments']

// 지출에는 부서 칸이 없다(logical-model '지출'). 그래서 부탁한 사람의 지금 부서로 읽는다.
// 요청을 거친 지출은 결제 내역이 가리키는 요청의 요청한 사람, 요청 없이 적은 지출은 부탁한 사람이다(DEC-40).
// 요청 카드의 요청 부서와 같은 기준이다(저장하지 않고 지금 부서, 겸직이면 모두, finance/proposal F9).
// 상세를 지출 수만큼 읽지 않도록 목록의 지출을 한 번에 읽는다.
export async function expenseDepartments(
  db: Pick<Db, 'select'>,
  actor: Actor,
  ids: string[],
): Promise<Map<string, Departments>> {
  const found = new Map<string, Departments>()
  if (ids.length === 0) return found
  const rows = await db
    .select({ expenseId: expense.id, id: department.id, name: department.name })
    .from(expense)
    .innerJoin(record, eq(record.id, expense.id))
    .leftJoin(paymentLine, eq(paymentLine.expenseId, expense.id))
    .leftJoin(lineItem, eq(lineItem.id, paymentLine.lineItemId))
    .leftJoin(request, eq(request.id, lineItem.requestId))
    .innerJoin(
      departmentMembership,
      and(
        or(
          eq(departmentMembership.memberId, expense.requestedBy),
          eq(departmentMembership.memberId, request.requestedBy),
        ),
        eq(departmentMembership.cohortId, actor.cohortId),
        isNull(departmentMembership.endsAt),
      ),
    )
    .innerJoin(
      department,
      and(
        eq(department.id, departmentMembership.departmentId),
        eq(department.councilId, actor.councilId),
      ),
    )
    .where(and(eq(record.councilId, actor.councilId), inArray(expense.id, ids)))
    .groupBy(expense.id, department.id, department.name)
  rows.sort((a, b) => a.name.localeCompare(b.name, 'ko') || a.id.localeCompare(b.id))
  for (const row of rows) {
    const list = found.get(row.expenseId) ?? []
    list.push({ id: row.id, name: row.name })
    found.set(row.expenseId, list)
  }
  return found
}
