import { sql, type AnyColumn } from 'drizzle-orm'

import { lineItem } from '../db/schema.js'

// 품목의 마지막 결재 결과 하나가 품목의 상태다(logical-model '품목의 상태'). 승인 뒤에 취소 줄이 붙을 수 있어
// 품목에 붙는 결재 줄이 하나라는 가정을 쓰지 않는다: 요청 상태 셈, 품목 상태, 정산 남은 것, 결제 가능, 결과 알림, 결재 시작 여부가 모두 이것을 읽는다.
// 결재 줄이 없으면 null(대기)이다. 품목 결과(승인, 반려, 취소)만 센다: 같은 표의 다른 결과(감사 등)가 마지막이어도 품목의 상태와 요청 셈이 같은 값을 낸다.
export const lastOutcomeOf = (itemId: AnyColumn) =>
  sql<
    string | null
  >`(select d.outcome from approval d where d.target_id = ${itemId} and d.target_kind = 'line_item' and d.outcome in ('approved', 'rejected', 'cancelled') order by d.acted_at desc, d.id desc limit 1)`

const countWhere = (condition: ReturnType<typeof sql>) =>
  sql<number>`count(*) filter (where ${condition})`.mapWith(Number)

// 요청별로 묶은 질의에서 품목 수를 마지막 결과로 센다.
export const itemCountColumns = () => {
  const last = lastOutcomeOf(lineItem.id)
  return {
    items: sql<number>`count(*)`.mapWith(Number),
    pending: countWhere(sql`${last} is null`),
    approved: countWhere(sql`${last} = 'approved'`),
    rejected: countWhere(sql`${last} = 'rejected'`),
    cancelled: countWhere(sql`${last} = 'cancelled'`),
  }
}
