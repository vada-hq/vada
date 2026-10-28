import { and, eq, sql, type SQL } from 'drizzle-orm'
import { purchaseProgressOf, type PurchaseRequestSummary } from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import {
  event,
  expense,
  lineItem,
  member,
  paymentLine,
  record,
  request,
  shipment,
} from '../db/schema.js'
import { allows } from '../access/permissions.js'
import { lastOutcomeOf } from './last-outcome.js'
import type { Db } from '../db/types.js'
import { joinedDisplayNameOf } from '../team/display-name.js'
import { estimateColumns } from './estimate.js'
import { itemCountColumns } from './last-outcome.js'
import { requestStatusOf } from './policy.js'

type Reader = Pick<Db, 'select'>
const BODY_PREVIEW_MAX = 100

// 요청 줄과 품목·결재 수. 학생회 경계는 기록의 학생회 번호로 건다. 기본 키로 묶어 다른 표의 칸은 그 기본 키에 딸린 값이다.
export function summaryRows(
  db: Reader,
  actor: Actor,
  options: { where?: SQL | undefined; having?: SQL | undefined; order: SQL[]; limit: number },
) {
  return db
    .select({
      id: request.id,
      title: request.title,
      body: request.body,
      neededBy: request.neededBy,
      cancelledAt: request.cancelledAt,
      eventId: request.eventId,
      eventName: event.name,
      requestedBy: request.requestedBy,
      requesterName: joinedDisplayNameOf(member, record.councilId),
      createdAt: record.createdAt,
      ...itemCountColumns(),
      ...estimateColumns(),
      paidApproved:
        sql<number>`count(*) filter (where ${lastOutcomeOf(lineItem.id)} = 'approved' and ${isPaid})`.mapWith(
          Number,
        ),
      hasShipment:
        sql<boolean>`exists (select 1 from ${shipment} where ${shipment.requestId} = ${request.id} and ${shipment.cancelledAt} is null)`.mapWith(
          Boolean,
        ),
    })
    .from(request)
    .innerJoin(record, eq(record.id, request.id))
    .innerJoin(member, eq(member.id, request.requestedBy))
    .innerJoin(lineItem, eq(lineItem.requestId, request.id))
    .leftJoin(event, eq(event.id, request.eventId))
    .where(and(eq(record.councilId, actor.councilId), requestVisibility(actor), options.where))
    .groupBy(request.id, record.id, member.id, event.id)
    .having(options.having)
    .orderBy(...options.order)
    .limit(options.limit)
}
export type PurchaseSummaryRow = Awaited<ReturnType<typeof summaryRows>>[number]

// 부원은 주소나 보기 값을 바꾸어도 남의 요청을 읽을 수 없다(메뉴 v7 S2 사용자 지시).
const requestVisibility = (actor: Actor) =>
  allows(actor, { who: ['finance', 'leadership', 'any_department_head'] })
    ? undefined
    : eq(request.requestedBy, actor.memberId)

const statusOfRow = (row: PurchaseSummaryRow) => requestStatusOf(row.cancelledAt !== null, row)

export function summaryOf(row: PurchaseSummaryRow, payable: boolean): PurchaseRequestSummary {
  const firstLine = row.body
    ?.split(/\r?\n/u)
    .map(line => line.trim())
    .find(Boolean)
  return {
    id: row.id,
    title: row.title,
    status: statusOfRow(row),
    requestedBy: { id: row.requestedBy, name: row.requesterName },
    neededBy: row.neededBy,
    itemCount: row.items,
    createdAt: row.createdAt.toISOString(),
    event: row.eventId && row.eventName ? { id: row.eventId, name: row.eventName } : null,
    payable,
    estimate: { subtotal: row.estimatedSubtotal, total: row.estimatedTotal },
    bodyPreview: firstLine ? Array.from(firstLine).slice(0, BODY_PREVIEW_MAX).join('') : null,
    progress: purchaseProgressOf(row),
  }
}

// 취소되지 않은 결제 내역이 있는 품목은 '결제함'이다(DEC-24).
export const isPaid = sql<boolean>`exists (select 1 from ${paymentLine} inner join ${expense} on ${expense.id} = ${paymentLine.expenseId} where ${paymentLine.lineItemId} = ${lineItem.id} and ${expense.cancelledAt} is null)`
