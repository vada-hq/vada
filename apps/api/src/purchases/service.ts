import { randomUUID } from 'node:crypto'
import { and, desc, eq, inArray, ne, or, sql } from 'drizzle-orm'
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'
import type { CreatePurchaseDraftsRequest, EventPurchaseItemsResponse, PurchaseItemDetail, PurchaseItemSummary } from '@vada/contracts'
import { chatRooms, events, memberships, messages, purchaseGenerations as generations, purchaseItems as items,
  purchaseItemSources as sources } from '../db/schema.js'
import { type DraftGenerator, type DraftInput, type GeneratedDraft, validateDraft } from './generation.js'
import { itemDetail, itemSummaries, type Viewer } from './items.js'
import { productUrl, PurchaseError } from './validation.js'

type Db = PgDatabase<PgQueryResultHKT>
type Reader = Pick<Db, 'select'>
export type PurchaseDatabase = Pick<Db, 'select' | 'transaction'>
export interface PurchaseScope extends Viewer { eventId: string }
const LIST_LIMIT = 300
export const DUPLICATE_WARNING = '이미 담은 상품이에요. 같은 물건을 두 번 사지 않는지 확인해 주세요.'
const newest = [desc(items.createdAt), desc(items.id)]

// 저장 트랜잭션에서는 소속 행을 잠가 부서 변경과 겹치지 않게 한다.
async function member(db: Reader, scope: PurchaseScope, lock = false) {
  const query = db.select({ departmentId: memberships.departmentId }).from(memberships)
    .where(and(eq(memberships.organizationId, scope.organizationId), eq(memberships.userId, scope.userId)))
  const [row] = await (lock ? query.for('share') : query)
  if (!row) throw new PurchaseError('FORBIDDEN', 403)
  return row
}
async function eventOf(db: Reader, scope: PurchaseScope) {
  const [event] = await db.select({ name: events.name, roomId: chatRooms.id }).from(events)
    .innerJoin(chatRooms, and(eq(chatRooms.eventId, events.id), eq(chatRooms.organizationId, events.organizationId)))
    .where(and(eq(events.id, scope.eventId), eq(events.organizationId, scope.organizationId)))
  if (!event) throw new PurchaseError('NOT_FOUND', 404)
  return event
}
// 작성 중 품목은 요청자만, 제출된 품목은 학생회 누구나 본다.
const visible = (scope: PurchaseScope) => and(eq(items.eventId, scope.eventId), or(ne(items.status, 'draft'), eq(items.requesterId, scope.userId)))
const byIds = (db: Reader, scope: PurchaseScope, ids: string[]) => itemSummaries(db, scope, inArray(items.id, ids), newest)

async function previous(db: Reader, scope: PurchaseScope, key: string, links: string[]) {
  const [generation] = await db.select().from(generations).where(and(eq(generations.requesterId, scope.userId), eq(generations.idempotencyKey, key)))
  if (!generation) return undefined
  // 같은 키로 다른 링크나 다른 행사를 보내면 새로 만들지 않고 거절한다.
  if (generation.organizationId !== scope.organizationId || generation.eventId !== scope.eventId
    || JSON.stringify(generation.links) !== JSON.stringify(links)) throw new PurchaseError('IDEMPOTENCY_CONFLICT', 409)
  return itemSummaries(db, scope, and(eq(items.generationId, generation.id), eq(items.requesterId, scope.userId)), newest)
}

export function createPurchaseService(db: PurchaseDatabase, generate: DraftGenerator) {
  // 단일 M1 서버에서 사용자당 동시 생성 한 건. 최종 중복 저장은 DB 고유 제약으로도 막는다.
  const generating = new Set<string>()
  return {
    async list(scope: PurchaseScope): Promise<EventPurchaseItemsResponse> {
      await eventOf(db, scope)
      const rows = await itemSummaries(db, scope, visible(scope), newest, LIST_LIMIT + 1)
      return { items: rows.slice(0, LIST_LIMIT), truncated: rows.length > LIST_LIMIT }
    },
    async get(scope: PurchaseScope, id: string): Promise<PurchaseItemDetail> {
      const [row] = await itemSummaries(db, scope, and(visible(scope), eq(items.id, id)), newest, 1)
      if (!row) throw new PurchaseError('NOT_FOUND', 404)
      return itemDetail(db, scope, row)
    },
    async createDrafts(scope: PurchaseScope, input: CreatePurchaseDraftsRequest): Promise<{ items: PurchaseItemSummary[]; created: boolean }> {
      const links = input.links.map(productUrl)
      if (new Set(links).size !== links.length) throw new PurchaseError('DUPLICATE_LINK')
      const event = await eventOf(db, scope)
      await member(db, scope)
      const existing = await previous(db, scope, input.idempotencyKey, links)
      if (existing) return { items: existing, created: false }
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
        const draftInput: DraftInput = { eventName: event.name, links,
          messages: bounded.reverse().map(message => ({ ...message, createdAt: message.createdAt.toISOString() })) }
        let draft: GeneratedDraft
        try { draft = await generate(draftInput); validateDraft(draft, draftInput) }
        catch (error) { if (error instanceof PurchaseError && error.status === 503) throw error; throw new PurchaseError('GENERATION_FAILED', 502) }
        return await db.transaction(async tx => {
          await member(tx, scope, true)
          const current = await eventOf(tx, scope)
          const sourceIds = [...new Set(draft.items.flatMap(item => item.sourceMessageIds))]
          if (sourceIds.length) {
            const checked = await tx.select({ id: messages.id }).from(messages)
              .where(and(eq(messages.chatRoomId, current.roomId), inArray(messages.id, sourceIds)))
            if (checked.length !== sourceIds.length) throw new PurchaseError('GENERATION_FAILED', 502)
          }
          const [generation] = await tx.insert(generations).values({ id: randomUUID(), organizationId: scope.organizationId,
            eventId: scope.eventId, requesterId: scope.userId, idempotencyKey: input.idempotencyKey, links })
            .onConflictDoNothing({ target: [generations.requesterId, generations.idempotencyKey] }).returning()
          if (!generation) {
            const winner = await previous(tx, scope, input.idempotencyKey, links)
            if (!winner) throw new PurchaseError('IDEMPOTENCY_CONFLICT', 409)
            return { items: winner, created: false }
          }
          // 같은 행사에서 이미 담은 상품이면 합치지 않고 확인할 점을 붙인다(2026-10-04 결정).
          const owned = await tx.select({ productUrl: items.productUrl }).from(items).where(and(eq(items.organizationId, scope.organizationId),
            eq(items.eventId, scope.eventId), eq(items.requesterId, scope.userId), inArray(items.status, ['draft', 'pending', 'approved']),
            inArray(items.productUrl, links)))
          const rows = draft.items.map((item, index) => ({
            id: randomUUID(), organizationId: scope.organizationId, eventId: scope.eventId, requesterId: scope.userId, generationId: generation.id,
            productUrl: item.productUrl, productName: item.productName, selectedOption: item.selectedOption, optionRequired: item.optionRequired,
            quantity: item.quantity, packagingUnit: item.packagingUnit, estimatedUnitPrice: item.estimatedUnitPrice,
            productSnapshot: item.productSnapshot, productFetchedAt: item.productFetchedAt, note: item.note, neededBy: item.neededBy,
            warnings: owned.some(row => row.productUrl === item.productUrl) ? [...item.warnings, DUPLICATE_WARNING] : item.warnings,
            // 최신순 목록에서 링크 순서대로 보이도록 같은 생성의 품목 시각을 1ms씩 앞당긴다.
            createdAt: sql`now() - interval '${sql.raw(String(index))} milliseconds'`,
          }))
          await tx.insert(items).values(rows)
          const sourceRows = draft.items.flatMap((item, index) => item.sourceMessageIds.map(messageId => ({ itemId: rows[index]!.id, messageId })))
          if (sourceRows.length) await tx.insert(sources).values(sourceRows)
          const saved = await byIds(tx, scope, rows.map(row => row.id))
          return { items: rows.map(row => saved.find(item => item.id === row.id)!), created: true }
        })
      } finally { generating.delete(scope.userId) }
    },
  }
}
