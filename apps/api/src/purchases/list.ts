import { and, asc, desc, eq, isNull, sql } from 'drizzle-orm'
import {
  PURCHASE_PENDING_LIMIT,
  PURCHASE_RECENT_LIMIT,
  purchaseStageOf,
  type PurchaseRequestListQuery,
  type PurchaseRequestSummary,
  type PurchaseRequestsResponse,
} from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import { lineItem, record, request } from '../db/schema.js'
import type { Db } from '../db/types.js'
import { eventRowOf } from '../events/queries.js'
import { departmentRequestsOf } from '../home/department-purchases.js'
import { lastOutcomeOf } from './last-outcome.js'
import { itemBriefsOf, requesterDepartmentsOf } from './list-items.js'
import { requestStageSql, stageCountsOf, stageCountsOfRequests } from './list-stages.js'
import { payableRequestIds } from './payable-requests.js'
import { summaryOf, summaryRows } from './summary.js'

// 결재 대기는 필요한 때가 가까운 순, 없으면 끝이고 그 안은 오래된 순이다(DEC-92, 024 정한 것 9).
// 홈 '받은 것'도 같은 목록을 쓰므로 거르기와 차례를 상한보다 먼저 건다.
function listOptions(actor: Actor, view: PurchaseRequestListQuery['view']) {
  if (view === 'pending')
    return {
      where: isNull(request.cancelledAt),
      having: sql`count(*) filter (where ${lastOutcomeOf(lineItem.id)} is null) > 0`,
      order: [sql`${request.neededBy} asc nulls last`, asc(record.createdAt), asc(request.id)],
      limit: PURCHASE_PENDING_LIMIT,
    }
  return {
    where: view === 'mine' ? eq(request.requestedBy, actor.memberId) : undefined,
    having: undefined,
    order: [desc(record.createdAt), desc(request.id)],
    limit: PURCHASE_RECENT_LIMIT,
  }
}

async function departmentListOf(
  db: Pick<Db, 'select'>,
  actor: Actor,
  query: PurchaseRequestListQuery,
) {
  const scoped = (await departmentRequestsOf(db, actor)).filter(
    row =>
      !query.event || (query.event === 'none' ? row.event === null : row.event?.id === query.event),
  )
  const requests = scoped.filter(row => !query.stage || purchaseStageOf(row) === query.stage)
  return {
    requests: await withItems(db, actor, requests.slice(0, PURCHASE_RECENT_LIMIT)),
    truncated: requests.length > PURCHASE_RECENT_LIMIT,
    stageCounts: stageCountsOfRequests(scoped),
  }
}

export async function requestListOf(
  db: Pick<Db, 'select'>,
  actor: Actor,
  query: PurchaseRequestListQuery,
): Promise<PurchaseRequestsResponse> {
  if (query.event && query.event !== 'none') await eventRowOf(db, actor, query.event)
  if (query.view === 'department') return departmentListOf(db, actor, query)
  const options = listOptions(actor, query.view)
  const eventWhere =
    query.event === 'none'
      ? isNull(request.eventId)
      : query.event
        ? eq(request.eventId, query.event)
        : undefined
  const where = and(options.where, eventWhere)
  const stageCounts = await stageCountsOf(db, actor, { ...options, where })
  const having = and(options.having, query.stage ? eq(requestStageSql, query.stage) : undefined)
  const rows = await summaryRows(db, actor, { ...options, where, having, limit: options.limit + 1 })
  const shown = rows.slice(0, options.limit)
  const payable = await payableRequestIds(db, shown)
  return {
    requests: await withItems(
      db,
      actor,
      shown.map(row => summaryOf(row, payable.has(row.id))),
    ),
    truncated: rows.length > options.limit,
    stageCounts,
  }
}

// 구매 칸반이 품목 카드와 요청 부서를 그리도록 목록에 실린 요청마다 품목 요약과 요청한 사람의 지금 부서를 붙인다.
async function withItems(
  db: Pick<Db, 'select'>,
  actor: Actor,
  requests: PurchaseRequestSummary[],
): Promise<PurchaseRequestSummary[]> {
  const ids = requests.map(row => row.id)
  const [items, departments] = await Promise.all([
    itemBriefsOf(db, actor, ids),
    requesterDepartmentsOf(db, actor, ids),
  ])
  return requests.map(row => ({
    ...row,
    itemBriefs: items.get(row.id) ?? [],
    requesterDepartments: departments.get(row.id) ?? [],
  }))
}
