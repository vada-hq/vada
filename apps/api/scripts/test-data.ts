import { randomUUID } from 'node:crypto'
import { and, eq } from 'drizzle-orm'
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'
import { accounts, departments, memberships, organizations } from '../src/db/schema.js'

type Database = Pick<PgDatabase<PgQueryResultHKT>, 'transaction'>
const council = { id: 'm1-test-council', name: 'M1 검증 학생회' }
const departmentData = {
  planning: { id: 'm1-test-planning', organizationId: council.id, name: '기획부', handlesFinance: false },
  finance: { id: 'm1-test-finance', organizationId: council.id, name: '재정부', handlesFinance: true },
} as const

export async function seedTestCouncil(db: Database) {
  await db.transaction(async tx => {
    await tx.insert(organizations).values(council).onConflictDoNothing()
    const [existing] = await tx.select().from(organizations).where(eq(organizations.id, council.id))
    if (existing?.name !== council.name) throw new Error('Test council conflicts with existing data')
    for (const department of Object.values(departmentData)) {
      await tx.insert(departments).values(department).onConflictDoNothing()
      const [saved] = await tx.select().from(departments).where(eq(departments.id, department.id))
      if (saved?.organizationId !== council.id || saved.name !== department.name || saved.handlesFinance !== department.handlesFinance) {
        throw new Error('Test department conflicts with existing data')
      }
    }
  })
}

export async function assignDepartment(db: Database, userId: string, department: 'planning' | 'finance') {
  const target = departmentData[department]
  if (!target || !userId.trim()) throw new Error('Invalid assignment')
  await db.transaction(async tx => {
    const [account] = await tx.select({ id: accounts.id }).from(accounts)
      .where(and(eq(accounts.userId, userId), eq(accounts.providerId, 'google'))).limit(1)
    if (!account) throw new Error('An existing Google user is required')
    const [savedDepartment] = await tx.select().from(departments).where(eq(departments.id, target.id))
    if (savedDepartment?.organizationId !== council.id || savedDepartment.name !== target.name || savedDepartment.handlesFinance !== target.handlesFinance) {
      throw new Error('Seeded test department is required')
    }
    await tx.insert(memberships).values({ id: randomUUID(), userId, organizationId: council.id, departmentId: target.id })
      .onConflictDoNothing({ target: [memberships.organizationId, memberships.userId] })
    const [membership] = await tx.select().from(memberships)
      .where(and(eq(memberships.organizationId, council.id), eq(memberships.userId, userId)))
    if (membership?.departmentId !== target.id) throw new Error('Existing department assignment cannot be overwritten')
  })
}
