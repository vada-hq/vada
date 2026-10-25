import { asc, inArray, sql } from 'drizzle-orm'
import type { BudgetItemVersion } from '@vada/contracts'
import { expense, income, lineItem, recordVersion, request } from '../db/schema.js'
import type { Db } from '../db/types.js'
import { memberNamesOf } from '../team/display-name.js'

type Reader = Pick<Db, 'select'>

// 판에 담긴 예산 항목 줄의 칸 값(to_jsonb라 칸 이름이 표의 이름이다). 금액은 numeric이라 글자로 올 수 있다.
type Snapshot = { purpose: string; amount: string | number }

// 예산 항목들의 판 전체(오래된 것부터, 바꾼 사람의 표시 이름과 함께). 예산 읽기가 항목마다 부르지 않게 한 번에 읽는다.
// 항목은 부르는 쪽이 이 학생회 것으로 거른 것만 넘긴다(이름의 차례가 그 학생회 기준이다).
export async function budgetItemHistoriesOf(
  db: Reader,
  councilId: string,
  ids: readonly string[],
): Promise<Map<string, BudgetItemVersion[]>> {
  const histories = new Map<string, BudgetItemVersion[]>()
  if (!ids.length) return histories
  const rows = await db
    .select({
      recordId: recordVersion.recordId,
      versionNo: recordVersion.versionNo,
      openedAt: sql<number>`extract(epoch from lower(${recordVersion.valid})) * 1000`.mapWith(
        Number,
      ),
      changedBy: recordVersion.changedBy,
      data: recordVersion.data,
      reason: recordVersion.reason,
    })
    .from(recordVersion)
    .where(inArray(recordVersion.recordId, [...ids]))
    .orderBy(asc(recordVersion.recordId), asc(recordVersion.versionNo))
  const names = await memberNamesOf(
    db,
    councilId,
    rows.flatMap(row => (row.changedBy ? [row.changedBy] : [])),
  )
  for (const row of rows) {
    const snapshot = row.data as Snapshot
    const name = row.changedBy ? names.get(row.changedBy) : undefined
    const list = histories.get(row.recordId) ?? []
    list.push({
      versionNo: row.versionNo,
      at: new Date(Math.round(row.openedAt)).toISOString(),
      by: row.changedBy && name ? { id: row.changedBy, name } : null,
      purpose: snapshot.purpose,
      amount: Number(snapshot.amount),
      reason: row.reason,
    })
    histories.set(row.recordId, list)
  }
  return histories
}

// 결재(품목), 지출, 수입, 요청의 기본 예산 항목이 가리키는 항목들. 이 가리킴은 한 번 걸리면 비우는 쓰기가 없어(취소해도 남는다)
// 지금 가리킴이 '쓰인 적 있음'과 같다. 지우기를 막는 판단(DEC-92)과 화면의 '지우기' 표시가 이것 하나를 쓴다.
export async function usedBudgetItemIds(db: Reader, ids: readonly string[]): Promise<Set<string>> {
  const used = new Set<string>()
  if (!ids.length) return used
  const wanted = [...ids]
  for (const column of [
    lineItem.budgetItemId,
    expense.budgetItemId,
    income.budgetItemId,
    request.defaultBudgetItemId,
  ]) {
    const rows = await db.select({ id: column }).from(column.table).where(inArray(column, wanted))
    for (const row of rows) if (row.id) used.add(row.id)
  }
  return used
}
