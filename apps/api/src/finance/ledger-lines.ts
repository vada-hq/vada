import { and, eq } from 'drizzle-orm'
import type { Db } from '../db/client.ts'
import { departments, events, paymentDocuments, purchaseRequests } from '../db/schema.ts'
import { moment } from '../time.ts'
import type { PurchaseStage, Tone } from './labels.ts'
import { moneyItems, paidRows, plannedGroups, type MoneyItem } from './money.ts'

export const PER_VIEW = 10
export const RECENT = 5
const ONGOING = '운영 (상시)'
export const PROOF = {
  done: { label: '완료', tone: 'green' },
  checking: { label: '확인 중', tone: 'yellow' },
  missing: { label: '누락', tone: 'red' },
} as const satisfies Record<string, Tone>
const BEFORE_PAYMENT: Tone = { label: '결제 전', tone: 'gray' }

export type ProofKey = keyof typeof PROOF
export type LedgerStage = 'spent' | 'planned'
export const STAGE_NOTE: Record<LedgerStage, string> = {
  spent: '결제 완료',
  planned: '결제 예정',
}

export interface LedgerLine {
  id: string
  stage: LedgerStage
  requestId: string
  when: Date | null
  month: string | null
  submittedAt: Date | null
  title: string
  eventId: string | null
  context: string
  departmentId: string | null
  department: string
  budgetItemIds: string[]
  budgetItem: string
  amount: number
  proof: Tone
}

interface RequestRow {
  id: string
  title: string
  eventId: string | null
  departmentId: string | null
  stage: PurchaseStage
  submittedAt: Date | null
  eventName: string | null
  departmentName: string | null
}

function proofOf(missingDocuments: number, stage: PurchaseStage): ProofKey {
  if (missingDocuments > 0) return 'missing'
  return stage === 'settled' ? 'done' : 'checking'
}

async function requestRows(db: Db, orgId: string): Promise<Map<string, RequestRow>> {
  const rows = (await db
    .select({
      id: purchaseRequests.id,
      title: purchaseRequests.title,
      eventId: purchaseRequests.eventId,
      departmentId: purchaseRequests.departmentId,
      stage: purchaseRequests.stage,
      submittedAt: purchaseRequests.submittedAt,
      eventName: events.title,
      departmentName: departments.name,
    })
    .from(purchaseRequests)
    .leftJoin(events, and(eq(purchaseRequests.eventId, events.id), eq(events.orgId, orgId)))
    .leftJoin(
      departments,
      and(eq(purchaseRequests.departmentId, departments.id), eq(departments.orgId, orgId)),
    )
    .where(eq(purchaseRequests.orgId, orgId))) as RequestRow[]
  return new Map(rows.map((row) => [row.id, row]))
}

async function missingDocumentsByPayment(db: Db, orgId: string): Promise<Map<string, number>> {
  const rows = await db
    .select({ paymentId: paymentDocuments.paymentId, registeredAt: paymentDocuments.registeredAt })
    .from(paymentDocuments)
    .where(eq(paymentDocuments.orgId, orgId))
  const missing = new Map<string, number>()
  for (const row of rows) {
    if (row.registeredAt !== null) continue
    missing.set(row.paymentId, (missing.get(row.paymentId) ?? 0) + 1)
  }
  return missing
}

function bundled(names: readonly string[]): string | null {
  const first = names[0]
  if (first === undefined) return null
  return names.length === 1 ? first : `${first} 외 ${names.length - 1}건`
}

export function distinct(values: readonly (string | null)[]): string[] {
  return [...new Set(values.filter((value): value is string => value !== null))]
}

function byTimeDesc(a: Date | null, b: Date | null): number {
  if (a === null || b === null) return a === null && b === null ? 0 : a === null ? 1 : -1
  return b.getTime() - a.getTime()
}

export async function ledgerLines(db: Db, orgId: string): Promise<LedgerLine[]> {
  const [requests, paid, money, missing] = await Promise.all([
    requestRows(db, orgId),
    paidRows(db, orgId),
    moneyItems(db, orgId),
    missingDocumentsByPayment(db, orgId),
  ])
  const itemsOfPayment = new Map<string, MoneyItem[]>()
  for (const item of money) {
    if (item.paymentId === null) continue
    const found = itemsOfPayment.get(item.paymentId) ?? []
    found.push(item)
    itemsOfPayment.set(item.paymentId, found)
  }
  const shared = (request: RequestRow, items: readonly MoneyItem[]) => ({
    requestId: request.id,
    submittedAt: request.submittedAt,
    title: bundled(items.map((item) => item.name)) ?? request.title,
    eventId: request.eventId,
    context: request.eventName ?? ONGOING,
    departmentId: request.departmentId,
    department: request.departmentName ?? '부서 미정',
    budgetItemIds: distinct(items.map((item) => item.budgetItemId)),
    budgetItem: bundled(distinct(items.map((item) => item.budgetItemName))) ?? '항목 미정',
  })
  const spent: LedgerLine[] = []
  for (const row of paid) {
    const request = requests.get(row.requestId)
    if (request === undefined) continue
    const items = itemsOfPayment.get(row.paymentId) ?? []
    spent.push({
      id: row.paymentId,
      stage: 'spent',
      when: row.paidOn,
      month: row.paidOn === null ? null : moment(row.paidOn).slice(0, 7),
      amount: row.paidAmount,
      proof: PROOF[proofOf(missing.get(row.paymentId) ?? 0, request.stage)],
      ...shared(request, items),
    })
  }
  spent.sort((a, b) => byTimeDesc(a.when, b.when) || a.id.localeCompare(b.id))
  const planned: LedgerLine[] = []
  for (const group of plannedGroups(money)) {
    const request = requests.get(group.requestId)
    if (request === undefined) continue
    planned.push({
      id: `planned:${group.requestId}`,
      stage: 'planned',
      when: null,
      month: null,
      amount: group.amount,
      proof: BEFORE_PAYMENT,
      ...shared(request, group.items),
    })
  }
  planned.sort((a, b) => byTimeDesc(a.submittedAt, b.submittedAt) || a.id.localeCompare(b.id))
  return [...planned, ...spent]
}
