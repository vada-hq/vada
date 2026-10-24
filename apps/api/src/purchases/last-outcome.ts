import { sql } from 'drizzle-orm'

// 품목의 마지막 결재 결과 하나가 품목의 상태다(logical-model '품목의 상태'). 승인 뒤에 취소 줄이 붙을 수 있어
// 품목에 붙는 결재 줄이 하나라는 가정을 쓰지 않는다: 요청 상태 셈, 품목 상태, 정산 남은 것, 결제 가능, 결과 알림, 결재 시작 여부가 모두 이것을 읽는다.
// line_item 표를 바깥 질의에서 이름 그대로 쓰는 곳에서 부른다. 결재 줄이 없으면 null(대기)이다.
export const lastOutcomeSql = sql<
  string | null
>`(select d.outcome from approval d where d.target_id = "line_item"."id" and d.target_kind = 'line_item' order by d.acted_at desc, d.id desc limit 1)`

const countWhere = (condition: ReturnType<typeof sql>) =>
  sql<number>`count(*) filter (where ${condition})`.mapWith(Number)

// 요청별로 묶은 질의에서 품목 수를 마지막 결과로 센다.
export const itemCountColumns = () => ({
  items: sql<number>`count(*)`.mapWith(Number),
  pending: countWhere(sql`${lastOutcomeSql} is null`),
  approved: countWhere(sql`${lastOutcomeSql} = 'approved'`),
  rejected: countWhere(sql`${lastOutcomeSql} = 'rejected'`),
  cancelled: countWhere(sql`${lastOutcomeSql} = 'cancelled'`),
})
