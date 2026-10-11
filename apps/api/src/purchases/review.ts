import { randomUUID } from 'node:crypto'
import { and, asc, desc, eq, inArray, isNull, ne, sql } from 'drizzle-orm'
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'
import type { DecidePurchaseItemsRequest, PurchaseItemAction, PurchaseItemSummary, PurchaseReviewResponse } from '@vada/contracts'
import { approvesPurchases } from '../access/membership.js'
import { departments, expenseItems, memberships, purchaseItemEvents as itemEvents, purchaseItems as items,
  purchaseSubmissions as submissions, shipmentItems } from '../db/schema.js'
import { eventIdsOfItems, itemSummaries } from './items.js'
import { requireActiveEvents } from '../events/lock.js'
import { PurchaseError } from './validation.js'

type Db = PgDatabase<PgQueryResultHKT>
type Reader = Pick<Db, 'select'>
type ReviewDatabase = Pick<Db, 'select' | 'transaction'>
type Transaction = Parameters<Parameters<ReviewDatabase['transaction']>[0]>[0]
export interface ReviewScope { organizationId: string; userId: string }
const REVIEW_LIMIT = 300

// 재정 권한을 DB에서 다시 확인한다. 변경 중에는 부서 변경과 겹치지 않게 잠근다.
export async function requireFinance(db: Reader, scope: ReviewScope, lock = false) {
  const query = db.select({ id: memberships.id }).from(memberships)
    .innerJoin(departments, and(eq(memberships.departmentId, departments.id), eq(memberships.organizationId, departments.organizationId)))
    .where(and(eq(memberships.userId, scope.userId), eq(memberships.organizationId, scope.organizationId), approvesPurchases))
  const [member] = await (lock ? query.for('share') : query)
  if (!member) throw new PurchaseError('FORBIDDEN', 403)
}
// 바꿀 품목을 ID 순서로 잠근다. 작성 중 품목은 재정부에게도 없는 것으로 본다.
async function lockItems(tx: Transaction, scope: ReviewScope, refs: { id: string; version: number }[]) {
  const rows = await tx.select().from(items).where(and(eq(items.organizationId, scope.organizationId), inArray(items.id, refs.map(ref => ref.id)),
    ne(items.status, 'draft'))).orderBy(asc(items.id)).for('update')
  if (rows.length !== refs.length) throw new PurchaseError('NOT_FOUND', 404)
  if (rows.some(row => row.version !== refs.find(ref => ref.id === row.id)!.version)) throw new PurchaseError('VERSION_CONFLICT', 409)
  return rows
}
async function shipped(db: Reader, organizationId: string, itemId: string) {
  const [link] = await db.select({ id: shipmentItems.id }).from(shipmentItems).where(and(eq(shipmentItems.organizationId, organizationId),
    eq(shipmentItems.purchaseItemId, itemId), isNull(shipmentItems.unlinkedAt))).limit(1)
  return Boolean(link)
}
// 지출에 연결된 품목은 산 기록이 지출에 남아 있으므로 구매 표시를 되돌리지 않는다.
async function linkedToExpense(db: Reader, organizationId: string, itemId: string) {
  const [link] = await db.select({ id: expenseItems.purchaseItemId }).from(expenseItems)
    .where(and(eq(expenseItems.organizationId, organizationId), eq(expenseItems.purchaseItemId, itemId))).limit(1)
  return Boolean(link)
}
const bump = { version: sql`${items.version} + 1` }

export function createReviewService(db: ReviewDatabase) {
  const viewer = (scope: ReviewScope) => ({ ...scope, finance: true })
  const byIds = (reader: Reader, scope: ReviewScope, ids: string[]) => itemSummaries(reader, viewer(scope), inArray(items.id, ids), [asc(items.id)])
  async function record(tx: Transaction, scope: ReviewScope, itemId: string, action: PurchaseItemAction, reason: string | null = null, batchId: string | null = null) {
    await tx.insert(itemEvents).values({ id: randomUUID(), organizationId: scope.organizationId, itemId, actorId: scope.userId, action, reason, batchId })
  }
  return {
    async list(scope: ReviewScope): Promise<PurchaseReviewResponse> {
      await requireFinance(db, scope)
      // 대기는 오래된 제출부터, 같은 제출 안에서는 담은 순서다.
      const pending = await itemSummaries(db, viewer(scope), eq(items.status, 'pending'),
        [asc(submissions.submittedAt), asc(items.submissionId), desc(items.createdAt), asc(items.id)], REVIEW_LIMIT + 1)
      // 살 품목은 받을 날짜가 이른 순서이고, "상관없음"은 뒤다.
      const approved = await itemSummaries(db, viewer(scope), and(eq(items.status, 'approved'), isNull(items.receivedAt)),
        [sql`${items.neededBy} asc nulls last`, asc(submissions.submittedAt), asc(items.id)], REVIEW_LIMIT + 1)
      return { pending: pending.slice(0, REVIEW_LIMIT), approved: approved.slice(0, REVIEW_LIMIT),
        truncated: pending.length > REVIEW_LIMIT || approved.length > REVIEW_LIMIT }
    },
    async decide(scope: ReviewScope, input: DecidePurchaseItemsRequest): Promise<PurchaseItemSummary[]> {
      return db.transaction(async tx => {
        await requireFinance(tx, scope, true)
        // 완료한 행사(M5a)의 품목은 바꾸지 않는다. 행사 행을 품목보다 먼저 잠근다.
        await requireActiveEvents(tx, scope.organizationId, await eventIdsOfItems(tx, scope.organizationId, input.decisions.map(decision => decision.id)))
        const rows = await lockItems(tx, scope, input.decisions)
        if (rows.some(row => row.status !== 'pending')) throw new PurchaseError('INVALID_STATE', 409)
        const batchId = randomUUID()
        for (const decision of input.decisions) {
          const reason = decision.decision === 'rejected' ? decision.reason : null
          await tx.update(items).set({ status: decision.decision, decidedBy: scope.userId, decidedAt: sql`now()`, decisionReason: reason, ...bump })
            .where(eq(items.id, decision.id))
          await record(tx, scope, decision.id, decision.decision, reason, batchId)
        }
        return byIds(tx, scope, rows.map(row => row.id))
      })
    },
    async revoke(scope: ReviewScope, id: string, version: number): Promise<PurchaseItemSummary[]> {
      return db.transaction(async tx => {
        await requireFinance(tx, scope, true)
        await requireActiveEvents(tx, scope.organizationId, await eventIdsOfItems(tx, scope.organizationId, [id]))
        const [row] = await lockItems(tx, scope, [{ id, version }])
        // 구매함 표시 뒤에는 이미 산 물건이라 승인을 되돌리지 않는다.
        if (row!.status !== 'approved' || row!.purchasedAt !== null) throw new PurchaseError('INVALID_STATE', 409)
        if (await shipped(tx, scope.organizationId, id)) throw new PurchaseError('ALREADY_SHIPPED', 409)
        await tx.update(items).set({ status: 'pending', decidedBy: null, decidedAt: null, decisionReason: null, ...bump }).where(eq(items.id, id))
        await record(tx, scope, id, 'approval_revoked')
        return byIds(tx, scope, [id])
      })
    },
    async setPurchased(scope: ReviewScope, id: string, version: number, purchased: boolean): Promise<PurchaseItemSummary[]> {
      return db.transaction(async tx => {
        await requireFinance(tx, scope, true)
        await requireActiveEvents(tx, scope.organizationId, await eventIdsOfItems(tx, scope.organizationId, [id]))
        const [row] = await lockItems(tx, scope, [{ id, version }])
        if (row!.status !== 'approved' || (row!.purchasedAt !== null) === purchased || (!purchased && row!.receivedAt !== null)) {
          throw new PurchaseError('INVALID_STATE', 409)
        }
        if (!purchased && await shipped(tx, scope.organizationId, id)) throw new PurchaseError('ALREADY_SHIPPED', 409)
        if (!purchased && await linkedToExpense(tx, scope.organizationId, id)) throw new PurchaseError('LINKED_TO_EXPENSE', 409)
        await tx.update(items).set(purchased ? { purchasedAt: sql`now()`, purchasedBy: scope.userId, ...bump }
          : { purchasedAt: null, purchasedBy: null, ...bump }).where(eq(items.id, id))
        await record(tx, scope, id, purchased ? 'purchased' : 'purchase_undone')
        return byIds(tx, scope, [id])
      })
    },
  }
}
