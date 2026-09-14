import { and, asc, eq } from 'drizzle-orm'
import type { Db } from '../db/client.ts'
import { budgetItems, events } from '../db/schema.ts'
import { distinct, ledgerLines } from './ledger-lines.ts'
import { ledgerMonthLabel } from './ledger-list.ts'

export interface Option {
  value: string
  label: string
  description?: string
}

export async function ledgerMonthOptions(db: Db, orgId: string): Promise<Option[]> {
  const months = distinct((await ledgerLines(db, orgId)).map((line) => line.month)).sort((a, b) =>
    b.localeCompare(a),
  )
  return months.map((month) => ({ value: month, label: ledgerMonthLabel(month) }))
}

export async function ledgerEventOptions(db: Db, orgId: string): Promise<Option[]> {
  const rows = await db
    .select({ id: events.id, title: events.title })
    .from(events)
    .where(eq(events.orgId, orgId))
    .orderBy(asc(events.startAt), asc(events.title), asc(events.id))
  return rows.map((row) => ({ value: row.id, label: row.title }))
}

export async function orgBudgetItemOptions(db: Db, orgId: string): Promise<Option[]> {
  const rows = await db
    .select({ id: budgetItems.id, name: budgetItems.name, eventName: events.title })
    .from(budgetItems)
    .leftJoin(events, and(eq(budgetItems.eventId, events.id), eq(events.orgId, orgId)))
    .where(eq(budgetItems.orgId, orgId))
    .orderBy(asc(budgetItems.sortOrder), asc(budgetItems.id))
  return rows.map((row) => ({
    value: row.id,
    label: row.name,
    ...(row.eventName === null ? {} : { description: row.eventName }),
  }))
}
