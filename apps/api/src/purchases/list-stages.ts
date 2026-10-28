import { and, eq, sql, type SQL } from 'drizzle-orm'
import { purchaseStageOf, type PurchaseRequestSummary, type PurchaseStage } from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import { lineItem, record, request } from '../db/schema.js'
import type { Db } from '../db/types.js'
import { itemCountColumns, lastOutcomeOf } from './last-outcome.js'
import { isPaid } from './summary.js'

const emptyCounts = (): Record<PurchaseStage, number> => ({
  pending: 0,
  unpaid: 0,
  paid: 0,
  closed: 0,
})
const { pending, approved } = itemCountColumns()
const paidApproved = sql`count(*) filter (where ${lastOutcomeOf(lineItem.id)} = 'approved' and ${isPaid})`

// requestStatusOf와 purchaseStageOf의 SQL 판정. 대기가 있으면 부분 결제해도 대기이며,
// 남은 승인 품목이 모두 결제됐으면 반려 품목이 섞여 있어도 결제함이다.
export const requestStageSql = sql<PurchaseStage>`case
  when ${request.cancelledAt} is not null then 'closed'
  when ${pending} > 0 then 'pending'
  when ${approved} = 0 then 'closed'
  when ${approved} = ${paidApproved} then 'paid'
  else 'unpaid' end`

// 학생회·보기·행사 조건을 목록과 공유하되 상한과 선택 단계는 적용하지 않는다.
// DB에서 단계별로 묶으므로 요청 본문을 전부 읽지 않고 최대 네 줄만 돌려받는다.
export async function stageCountsOf(
  db: Pick<Db, 'select'>,
  actor: Actor,
  options: { where?: SQL | undefined; having?: SQL | undefined },
) {
  const stages = db
    .select({ stage: requestStageSql.as('stage') })
    .from(request)
    .innerJoin(record, eq(record.id, request.id))
    .innerJoin(lineItem, eq(lineItem.requestId, request.id))
    .where(and(eq(record.councilId, actor.councilId), options.where))
    .groupBy(request.id)
    .having(options.having)
    .as('request_stages')
  const rows = await db
    .select({ stage: stages.stage, count: sql<number>`count(*)`.mapWith(Number) })
    .from(stages)
    .groupBy(stages.stage)
  const counts = emptyCounts()
  for (const row of rows) counts[row.stage] = row.count
  return counts
}

// 부서 보기는 홈과 공유하는 전체 목록이 이미 있으므로 자르기 전의 그 결과를 센다.
export function stageCountsOfRequests(requests: PurchaseRequestSummary[]) {
  const counts = emptyCounts()
  for (const request of requests) counts[purchaseStageOf(request)] += 1
  return counts
}
