import { asc, eq } from 'drizzle-orm'
import type { Db } from '../db/client.ts'
import { departments, events } from '../db/schema.ts'
import { Blocked } from '../errors.ts'
import { won } from './labels.ts'
import { isCommitted } from './money.ts'
import { financeOverviewFacts, NO_BUDGET, NOT_PLANNED, percent } from './overview-facts.ts'

const ONGOING = { id: 'ongoing', name: '운영 (상시)' } as const
const UNASSIGNED = { id: 'unassigned', name: '부서 미지정' } as const
type Scope = 'event' | 'department'

function readScope(asked: string | undefined): Scope {
  const wanted = (asked ?? '').trim()
  if (wanted === 'event' || wanted === 'department') return wanted
  throw new Blocked('나누는 축은 행사별(event) 또는 부서별(department)이어야 합니다')
}

interface Bucket {
  budget: number | null
  spent: number
  planned: number
}

class Buckets {
  private readonly map = new Map<string, Bucket>()

  private at(key: string): Bucket {
    const found = this.map.get(key)
    if (found !== undefined) return found
    const made: Bucket = { budget: null, spent: 0, planned: 0 }
    this.map.set(key, made)
    return made
  }

  allot(key: string, amount: number): void {
    const bucket = this.at(key)
    bucket.budget = (bucket.budget ?? 0) + amount
  }

  spend(key: string, amount: number): void {
    this.at(key).spent += amount
  }

  plan(key: string, amount: number): void {
    this.at(key).planned += amount
  }

  get(key: string): Bucket | undefined {
    return this.map.get(key)
  }
}

export interface BreakdownRow {
  id: string
  name: string
  budget: string
  spent: string
  planned: string
  available: string
  executionPercent: number
}

function rowOf(id: string, name: string, bucket: Bucket, planned: boolean): BreakdownRow {
  const drawn = { id, name, spent: won(bucket.spent), planned: won(bucket.planned) }
  if (!planned) {
    return { ...drawn, budget: NOT_PLANNED, available: NOT_PLANNED, executionPercent: 0 }
  }
  if (bucket.budget === null) {
    return { ...drawn, budget: NO_BUDGET, available: NO_BUDGET, executionPercent: 0 }
  }
  return {
    ...drawn,
    budget: won(bucket.budget),
    available: won(bucket.budget - bucket.spent - bucket.planned),
    executionPercent: Math.min(100, Math.round(percent(bucket.spent + bucket.planned, bucket.budget))),
  }
}

export async function orgBreakdown(
  db: Db,
  orgId: string,
  scope: string | undefined,
): Promise<BreakdownRow[]> {
  const axis = readScope(scope)
  const { period, items, paid, money } = await financeOverviewFacts(db, orgId)
  const planned = period !== null
  const buckets = new Buckets()
  if (axis === 'event') {
    for (const item of items) buckets.allot(item.eventId ?? ONGOING.id, item.amount)
    for (const row of paid) buckets.spend(row.eventId ?? ONGOING.id, row.paidAmount)
    for (const item of money) {
      if (isCommitted(item)) buckets.plan(item.eventId ?? ONGOING.id, item.approvedAmount)
    }
    const rows = await db
      .select({ id: events.id, title: events.title })
      .from(events)
      .where(eq(events.orgId, orgId))
      .orderBy(asc(events.startAt), asc(events.title), asc(events.id))
    const drawn: BreakdownRow[] = []
    for (const event of rows) {
      const bucket = buckets.get(event.id)
      if (bucket !== undefined) drawn.push(rowOf(event.id, event.title, bucket, planned))
    }
    const ongoing = buckets.get(ONGOING.id)
    if (ongoing !== undefined) drawn.push(rowOf(ONGOING.id, ONGOING.name, ongoing, planned))
    return drawn
  }
  for (const item of items) buckets.allot(item.departmentId ?? UNASSIGNED.id, item.amount)
  for (const item of money) {
    if (isCommitted(item)) {
      buckets.plan(item.budgetDepartmentId ?? UNASSIGNED.id, item.approvedAmount)
    }
  }
  const departmentsOfPayment = new Map<string, Set<string | null>>()
  for (const item of money) {
    if (item.paymentId === null) continue
    const found = departmentsOfPayment.get(item.paymentId) ?? new Set<string | null>()
    found.add(item.budgetDepartmentId)
    departmentsOfPayment.set(item.paymentId, found)
  }
  for (const row of paid) {
    const found = departmentsOfPayment.get(row.paymentId)
    const only = found !== undefined && found.size === 1 ? [...found][0]! : null
    buckets.spend(only ?? UNASSIGNED.id, row.paidAmount)
  }
  const rows = await db
    .select({ id: departments.id, name: departments.name })
    .from(departments)
    .where(eq(departments.orgId, orgId))
    .orderBy(asc(departments.sortOrder), asc(departments.name), asc(departments.id))
  const drawn: BreakdownRow[] = []
  for (const department of rows) {
    const bucket = buckets.get(department.id)
    if (bucket !== undefined) drawn.push(rowOf(department.id, department.name, bucket, planned))
  }
  const unassigned = buckets.get(UNASSIGNED.id)
  if (unassigned !== undefined) {
    drawn.push(rowOf(UNASSIGNED.id, UNASSIGNED.name, unassigned, planned))
  }
  return drawn
}
