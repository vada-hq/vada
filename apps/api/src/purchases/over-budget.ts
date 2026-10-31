import { asc, inArray } from 'drizzle-orm'
import type { DecideLineItems } from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import { budgetItemsWithUsage } from '../budget/usage.js'
import { budgetItem } from '../db/schema.js'
import type { Tx } from '../db/types.js'

const overBudgetReason = (after: number) =>
  `예산 초과 (사용 가능 ${after.toLocaleString('ko-KR')}원)`

// 이번 승인으로 사용 가능이 음수가 되는 예산 항목 → 승인 결재 기록의 사유(규칙 12, DEC-92: 막지 않고 알리되 초과 사실을 남긴다).
// 화면의 '그래도 승인'을 믿지 않고 서버의 예산 셈으로 정한다. 같은 항목의 승인 줄은 합으로 보고, 화면(overagesOf)과 같은 값이다.
// 결재를 쓰기 전에, 학생회 행 잠금 뒤에 불러야 겹친 결재 둘 중 뒤 거래가 앞 승인을 약정으로 센다.
export async function overBudgetReasons(
  tx: Tx,
  actor: Actor,
  decisions: DecideLineItems['decisions'],
) {
  const requested = new Map<string, number>()
  for (const item of decisions)
    if (item.outcome === 'approved')
      requested.set(item.budgetItemId, (requested.get(item.budgetItemId) ?? 0) + item.amount)
  const reasons = new Map<string, string>()
  if (requested.size === 0) return reasons
  const rows = await budgetItemsWithUsage(
    tx,
    actor.councilId,
    inArray(budgetItem.id, [...requested.keys()]),
    [asc(budgetItem.id)],
  )
  for (const row of rows) {
    const after = (row.usage.available ?? 0) - (requested.get(row.id) ?? 0)
    if (row.usage.available !== null && after < 0) reasons.set(row.id, overBudgetReason(after))
  }
  return reasons
}
