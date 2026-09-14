import { asc, eq } from 'drizzle-orm'
import type { Db } from '../db/client.ts'
import { departments, organizations } from '../db/schema.ts'
import { day } from '../time.ts'

export async function orgDepartmentOptions(
  db: Db,
  orgId: string,
): Promise<Array<{ value: string; label: string }>> {
  const rows = await db
    .select({ id: departments.id, name: departments.name })
    .from(departments)
    .where(eq(departments.orgId, orgId))
    .orderBy(asc(departments.sortOrder), asc(departments.name))
  return rows.map((row) => ({ value: row.id, label: row.name }))
}

export async function duesTermOptions(
  db: Db,
  orgId: string,
): Promise<Array<{ value: string; label: string }>> {
  const rows = await db
    .select({ term: organizations.term, createdAt: organizations.createdAt })
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1)
  const row = rows[0]
  if (row === undefined) return []
  const named = (row.term ?? '').trim()
  const year = /^\d{4}$/.test(named) ? named : day(row.createdAt).slice(0, 4)
  return [
    { value: `${year}-1`, label: `${year}년 1학기` },
    { value: `${year}-2`, label: `${year}년 2학기` },
  ]
}
