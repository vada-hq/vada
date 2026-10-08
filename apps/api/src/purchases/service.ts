import { randomUUID } from 'node:crypto'
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm'
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'
import type { CreatePurchaseDraftRequest, DecidePurchaseRequest, PurchaseDetail, PurchaseSummary, UpdatePurchaseDraftRequest } from '@vada/contracts'
import { chatRooms, departments, events, memberships, messages, purchaseItems as items, purchaseRequestHistory as history,
  purchaseRequests as requests, purchaseRequestSources as sources } from '../db/schema.js'
import { approvesPurchases } from '../access/membership.js'
import { type DraftGenerator, type DraftInput, validateDraft } from './generation.js'
import { date, integer, productUrl, PurchaseError, text } from './validation.js'

type Db = PgDatabase<PgQueryResultHKT>
type Reader = Pick<Db, 'select'>
export type PurchaseDatabase = Pick<Db, 'select' | 'transaction'>
export interface PurchaseScope { organizationId: string; eventId: string; userId: string }
const whereOwned = (scope: PurchaseScope) => and(eq(requests.organizationId, scope.organizationId), eq(requests.eventId, scope.eventId), eq(requests.requesterId, scope.userId))
const whereVisible = (scope: PurchaseScope, finance: boolean) => finance
  ? and(eq(requests.organizationId, scope.organizationId), eq(requests.eventId, scope.eventId), inArray(requests.status, ['submitted', 'approved', 'rejected']))
  : whereOwned(scope)
async function requireFinance(db: Reader, scope: PurchaseScope) {
  const [member] = await db.select({ id: memberships.id }).from(memberships)
    .innerJoin(departments, and(eq(memberships.departmentId, departments.id), eq(memberships.organizationId, departments.organizationId)))
    .where(and(eq(memberships.userId, scope.userId), eq(memberships.organizationId, scope.organizationId), approvesPurchases)).for('share')
  if (!member) throw new PurchaseError('FORBIDDEN', 403)
}
const serialize = ({ idempotencyKey: _, ...row }: typeof requests.$inferSelect): PurchaseSummary => ({
  ...row, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(),
})

function validateSubmission(request: PurchaseDetail) {
  try {
    text(request.purpose)
    if (!date(request.neededBy) || !request.items.length) throw new Error('missing')
    for (const item of request.items) {
      text(item.productName)
      productUrl(item.productUrl)
      integer(item.quantity, 1)
      if (typeof item.optionRequired !== 'boolean') throw new Error('unknown option')
      if (item.optionRequired) text(item.selectedOption)
    }
  } catch { throw new PurchaseError('SUBMISSION_INCOMPLETE') }
}

async function context(db: Reader, scope: PurchaseScope, lock = false) {
  const query = db.select().from(memberships).where(and(eq(memberships.organizationId, scope.organizationId), eq(memberships.userId, scope.userId)))
  // 짧은 저장 트랜잭션에서만 소속 변경을 잠근다. AI 대기 중에는 DB 연결을 잡아두지 않는다.
  const [member] = await (lock ? query.for('share') : query)
  if (!member) throw new PurchaseError('FORBIDDEN', 403)
  const [event] = await db.select({ name: events.name, roomId: chatRooms.id }).from(events)
    .innerJoin(chatRooms, and(eq(chatRooms.eventId, events.id), eq(chatRooms.organizationId, events.organizationId)))
    .where(and(eq(events.id, scope.eventId), eq(events.organizationId, scope.organizationId)))
  if (!event) throw new PurchaseError('NOT_FOUND', 404)
  return { ...event, departmentId: member.departmentId }
}

async function detail(db: Reader, row: typeof requests.$inferSelect): Promise<PurchaseDetail> {
  const itemRows = await db.select().from(items).where(eq(items.requestId, row.id)).orderBy(asc(items.position))
  const sourceRows = await db.select({ id: messages.id, content: messages.content, authorId: messages.authorId, createdAt: messages.createdAt })
    .from(sources).innerJoin(messages, eq(messages.id, sources.messageId)).where(eq(sources.requestId, row.id)).orderBy(asc(messages.createdAt), asc(messages.id))
  const historyRows = await db.select().from(history).where(eq(history.requestId, row.id)).orderBy(asc(history.version))
  const warnings = historyRows.find(entry => entry.action === 'created')?.changes.warnings
  let estimatedTotal: number | null = row.estimatedShippingCost
  if (!itemRows.length || itemRows.some(item => item.quantity === null || item.estimatedUnitPrice === null)) estimatedTotal = null
  else if (estimatedTotal !== null) {
    estimatedTotal += itemRows.reduce((total, item) => total + item.quantity! * item.estimatedUnitPrice!, 0)
    if (!Number.isSafeInteger(estimatedTotal)) estimatedTotal = null
  }
  return {
    ...serialize(row), estimatedTotal,
    items: itemRows.map(({ requestId: _, createdAt: __, productFetchedAt, ...item }) => ({ ...item, productFetchedAt: productFetchedAt?.toISOString() ?? null })),
    sources: sourceRows.map(source => ({ ...source, createdAt: source.createdAt.toISOString() })),
    history: historyRows.map(({ requestId: _, ...entry }) => ({ ...entry, createdAt: entry.createdAt.toISOString() })),
    warnings: Array.isArray(warnings) ? warnings.filter((value): value is string => typeof value === 'string') : [],
  }
}

async function previous(db: Reader, scope: PurchaseScope, input: CreatePurchaseDraftRequest) {
  const [row] = await db.select().from(requests).where(and(eq(requests.requesterId, scope.userId), eq(requests.idempotencyKey, input.idempotencyKey))).for('share')
  if (!row) return undefined
  const [created] = await db.select({ changes: history.changes }).from(history).where(and(eq(history.requestId, row.id), eq(history.action, 'created')))
  // 사용자 수정 이후에도 생성 당시 입력으로 재시도를 비교한다.
  if (row.organizationId !== scope.organizationId || row.eventId !== scope.eventId || JSON.stringify(created?.changes.inputLinks) !== JSON.stringify(input.links)) {
    throw new PurchaseError('IDEMPOTENCY_CONFLICT', 409)
  }
  return row
}

export function createPurchaseService(db: PurchaseDatabase, generate: DraftGenerator) {
  // 단일 M1 서버에서 사용자당 동시 생성 한 건. 최종 중복 저장은 DB 고유 제약으로도 막는다.
  const generating = new Set<string>()
  return {
    async list(scope: PurchaseScope, before?: string, finance = false) {
      return db.transaction(async tx => {
      if (finance) await requireFinance(tx, scope)
      await context(tx, scope, true)
      if (before) {
        const [anchor] = await tx.select({ id: requests.id }).from(requests).where(and(whereVisible(scope, finance), eq(requests.id, before)))
        if (!anchor) throw new PurchaseError('INVALID_CURSOR')
      }
      const older = before ? sql`(${requests.createdAt}, ${requests.id}) < (SELECT created_at, id FROM purchase_requests WHERE id = ${before})` : undefined
      const rows = await tx.select().from(requests).where(and(whereVisible(scope, finance), older)).orderBy(desc(requests.createdAt), desc(requests.id)).limit(51)
      const page = rows.slice(0, 50)
      return { requests: page.map(serialize), nextCursor: rows.length > 50 ? page.at(-1)!.id : null }
      })
    },
    async get(scope: PurchaseScope, id: string, finance = false) {
      return db.transaction(async tx => {
        if (finance) await requireFinance(tx, scope)
        await context(tx, scope, true)
        const [row] = await tx.select().from(requests).where(and(whereVisible(scope, finance), eq(requests.id, id))).for('share')
        if (!row) throw new PurchaseError('NOT_FOUND', 404)
        return detail(tx, row)
      })
    },
    async create(scope: PurchaseScope, input: CreatePurchaseDraftRequest) {
      const event = await context(db, scope)
      const existing = await previous(db, scope, input)
      if (existing) return { request: await this.get(scope, existing.id), created: false }
      if (generating.has(scope.userId)) throw new PurchaseError('GENERATION_IN_PROGRESS', 409)
      generating.add(scope.userId)
      try {
        const recent = await db.select({ id: messages.id, content: messages.content, createdAt: messages.createdAt }).from(messages)
          .where(eq(messages.chatRoomId, event.roomId)).orderBy(desc(messages.createdAt), desc(messages.id)).limit(100)
        // 최근 100개 중 최신 대화부터 최대 20,000자. 메시지 중간을 자르지 않는다.
        let characters = 0
        const bounded = []
        for (const message of recent) {
          if (characters + message.content.length > 20000) break
          bounded.push(message); characters += message.content.length
        }
        const draftInput: DraftInput = { eventName: event.name, links: input.links,
          messages: bounded.reverse().map(message => ({ ...message, createdAt: message.createdAt.toISOString() })) }
        let draft
        try { draft = await generate(draftInput); validateDraft(draft, draftInput) }
        catch (error) { if (error instanceof PurchaseError && error.status === 503) throw error; throw new PurchaseError('GENERATION_FAILED', 502) }
        return await db.transaction(async tx => {
          const current = await context(tx, scope, true)
          if (draft.sourceMessageIds.length) {
            const checked = await tx.select({ id: messages.id }).from(messages).where(and(eq(messages.chatRoomId, current.roomId), inArray(messages.id, draft.sourceMessageIds)))
            if (checked.length !== draft.sourceMessageIds.length) throw new PurchaseError('GENERATION_FAILED', 502)
          }
          const [row] = await tx.insert(requests).values({ id: randomUUID(), organizationId: scope.organizationId,
            eventId: scope.eventId, requesterId: scope.userId, departmentId: current.departmentId,
            idempotencyKey: input.idempotencyKey, purpose: draft.purpose, neededBy: draft.neededBy,
          }).onConflictDoNothing({ target: [requests.requesterId, requests.idempotencyKey] }).returning()
          if (!row) {
            const winner = await previous(tx, scope, input)
            if (!winner) throw new PurchaseError('IDEMPOTENCY_CONFLICT', 409)
            return { request: await detail(tx, winner), created: false }
          }
          await tx.insert(items).values(draft.items.map((item, position) => ({ ...item, id: randomUUID(), requestId: row.id, position })))
          if (draft.sourceMessageIds.length) await tx.insert(sources).values(draft.sourceMessageIds.map(messageId => ({ requestId: row.id, messageId })))
          await tx.insert(history).values({ id: randomUUID(), requestId: row.id, actorId: scope.userId, action: 'created', version: 1,
            changes: { inputLinks: input.links, warnings: draft.warnings, after: draft } })
          return { request: await detail(tx, row), created: true }
        })
      } finally { generating.delete(scope.userId) }
    },
    async decide(scope: PurchaseScope, id: string, input: DecidePurchaseRequest) {
      return db.transaction(async tx => {
        await requireFinance(tx, scope)
        await context(tx, scope, true)
        const [row] = await tx.select().from(requests).where(and(whereVisible(scope, true), eq(requests.id, id))).for('update')
        if (!row) throw new PurchaseError('NOT_FOUND', 404)
        if (row.status !== 'submitted') throw new PurchaseError('INVALID_STATE', 409)
        if (row.version !== input.version) throw new PurchaseError('VERSION_CONFLICT', 409)
        const [updated] = await tx.update(requests).set({ status: input.decision, version: row.version + 1 })
          .where(and(eq(requests.id, id), eq(requests.version, input.version), eq(requests.status, 'submitted'))).returning()
        if (!updated) throw new PurchaseError('VERSION_CONFLICT', 409)
        await tx.insert(history).values({ id: randomUUID(), requestId: id, actorId: scope.userId,
          action: input.decision, version: updated.version, reason: input.decision === 'rejected' ? input.reason : null,
          changes: { before: { status: row.status }, after: { status: updated.status } } })
        return detail(tx, updated)
      })
    },
    async change(scope: PurchaseScope, id: string, input: UpdatePurchaseDraftRequest | { version: number }, action: 'update' | 'discard' | 'submit' = 'update') {
      return db.transaction(async tx => {
        await context(tx, scope, true)
        const [row] = await tx.select().from(requests).where(and(whereOwned(scope), eq(requests.id, id))).for('update')
        if (!row) throw new PurchaseError('NOT_FOUND', 404)
        if (row.status !== 'draft') throw new PurchaseError('INVALID_STATE', 409)
        if (row.version !== input.version) throw new PurchaseError('VERSION_CONFLICT', 409)
        const before = await detail(tx, row)
        if (action === 'submit') validateSubmission(before)
        const patch = input as UpdatePurchaseDraftRequest
        if (action === 'update' && patch.items) {
          if (patch.items.some(item => !before.items.some(owned => owned.id === item.id))) throw new PurchaseError('INVALID_ITEM')
          for (const { id: itemId, ...fields } of patch.items) await tx.update(items).set(fields).where(and(eq(items.requestId, id), eq(items.id, itemId)))
        }
        const [updated] = await tx.update(requests).set(action !== 'update' ? { status: action === 'submit' ? 'submitted' : 'discarded', version: row.version + 1 } : {
          purpose: patch.purpose, neededBy: patch.neededBy, estimatedShippingCost: patch.estimatedShippingCost, version: row.version + 1,
        }).where(and(eq(requests.id, id), eq(requests.version, input.version), eq(requests.status, 'draft'))).returning()
        if (!updated) throw new PurchaseError('VERSION_CONFLICT', 409)
        const after = await detail(tx, updated)
        const editable = (value: PurchaseDetail) => ({ purpose: value.purpose, neededBy: value.neededBy,
          estimatedShippingCost: value.estimatedShippingCost, status: value.status,
          items: value.items.map(({ productSnapshot: _, productFetchedAt: __, ...item }) => item) })
        await tx.insert(history).values({ id: randomUUID(), requestId: id, actorId: scope.userId,
          action: action === 'submit' ? 'submitted' : action === 'discard' ? 'discarded' : 'updated', version: updated.version, changes: { before: editable(before), after: editable(after) } })
        return detail(tx, updated)
      })
    },
  }
}
