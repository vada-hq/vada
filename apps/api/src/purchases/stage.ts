import { inArray, sql } from 'drizzle-orm'
import type { TaskResultStage } from '@vada/contracts'
import { lineItem, request } from '../db/schema.js'
import type { Db } from '../db/types.js'
import { lastOutcomeOf } from './last-outcome.js'

type Reader = Pick<Db, 'select'>

// 구매 요청이 업무 결과물로서 어느 단계인가(RULE-41, DEC-82). 읽기만 하고 저장하지 않는다.
// 요청을 취소했으면 빠짐, 품목이 모두 끝났으면 끝남, 아니면 진행 중이다. 품목이 끝났다는 것은 반려·취소되었거나,
// 승인되고 취소하지 않은 지출에 결제 내역이 있다는 것이다. 승인만으로는 끝나지 않는다. 품목이 없는 요청은 끝나지 않는다.
// 품목 상태는 마지막 결재 결과 한 곳(lastOutcomeOf)을 거치므로, 품목 취소(DEC-73)는 저절로 끝남에 든다.
const itemFinished = sql<number>`(case
  when ${lastOutcomeOf(lineItem.id)} in ('rejected', 'cancelled') then 1
  when ${lastOutcomeOf(lineItem.id)} = 'approved' and exists (
    select 1 from payment_line pl join expense e on e.id = pl.expense_id
    where pl.line_item_id = ${lineItem.id} and e.cancelled_at is null) then 1
  else 0 end)`

export async function requestStagesOf(
  db: Reader,
  requestIds: readonly string[],
): Promise<Map<string, TaskResultStage>> {
  if (!requestIds.length) return new Map()
  const rows = await db
    .select({
      id: request.id,
      cancelledAt: request.cancelledAt,
      items: sql<number>`count(${lineItem.id})`.mapWith(Number),
      finished: sql<number>`coalesce(sum(${itemFinished}), 0)`.mapWith(Number),
    })
    .from(request)
    .leftJoin(lineItem, sql`${lineItem.requestId} = ${request.id}`)
    .where(inArray(request.id, [...requestIds]))
    .groupBy(request.id)
  return new Map(
    rows.map(row => [
      row.id,
      row.cancelledAt
        ? 'excluded'
        : row.items > 0 && row.finished === row.items
          ? 'finished'
          : 'in_progress',
    ]),
  )
}
