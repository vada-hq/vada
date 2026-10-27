import { and, asc, eq, inArray, isNull, sql } from 'drizzle-orm'
import { HOME_LIST_LIMIT, type HomeMyRequests } from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import { lineItem, record, request } from '../db/schema.js'
import type { Db } from '../db/types.js'
import { lastOutcomeOf } from '../purchases/last-outcome.js'
import { payableRequestIds } from '../purchases/payable-requests.js'
import { isPaid, summaryOf, summaryRows } from '../purchases/summary.js'
import { departmentMembersOf } from './department-members.js'

// 학생회 경계와 현재 부서를 조회 상한보다 먼저 건다. 전체 보기와 홈이 같은 원본을 쓴다.
export async function departmentRequestsOf(db: Pick<Db, 'select'>, actor: Actor) {
  const members = await departmentMembersOf(db, actor)
  const ids = [...new Set([actor.memberId, ...members.map(row => row.memberId)])]
  const scope = and(isNull(request.cancelledAt), inArray(request.requestedBy, ids))
  const [row] = await db
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(request)
    .innerJoin(record, eq(record.id, request.id))
    .where(and(eq(record.councilId, actor.councilId), scope))
  const count = row?.count ?? 0
  if (!count) return []
  const last = lastOutcomeOf(lineItem.id)
  // 반려·대기 또는 승인 후 결제 전 품목이 남은 요청. 결제 기록은 기존 품목의 isPaid와 같다.
  const rows = await summaryRows(db, actor, {
    where: scope,
    having: sql`count(*) filter (where ${last} is null or ${last} = 'rejected' or (${last} = 'approved' and not ${isPaid})) > 0`,
    order: [
      sql`(count(*) filter (where ${last} = 'rejected') > 0) desc`,
      sql`${request.neededBy} asc nulls last`,
      asc(record.createdAt),
      asc(request.id),
    ],
    limit: count,
  })
  const payable = await payableRequestIds(db, rows)
  return rows.map(row => summaryOf(row, payable.has(row.id)))
}

export async function departmentPurchasesOf(
  db: Pick<Db, 'select'>,
  actor: Actor,
): Promise<HomeMyRequests> {
  const requests = await departmentRequestsOf(db, actor)
  return { requests: requests.slice(0, HOME_LIST_LIMIT), total: requests.length }
}
