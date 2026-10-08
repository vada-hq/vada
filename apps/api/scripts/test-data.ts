import { randomUUID } from 'node:crypto'
import { and, eq, isNull } from 'drizzle-orm'
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'
import { accounts, departments, memberships, organizations } from '../src/db/schema.js'

type Database = Pick<PgDatabase<PgQueryResultHKT>, 'transaction'>
type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0]
const council = { id: 'm1-test-council', name: 'M1 검증 학생회' }
const departmentData = {
  planning: { id: 'm1-test-planning', organizationId: council.id, name: '기획부', handlesFinance: false },
  finance: { id: 'm1-test-finance', organizationId: council.id, name: '재정부', handlesFinance: true },
} as const
const leadershipData = { id: 'm1-test-leadership', organizationId: council.id, name: '회장단', isLeadership: true }

// 0010 마이그레이션이 이미 회장단을 만든 DB에서는 그 회장단을 그대로 쓴다.
async function leadershipOf(tx: Transaction) {
  const [leadership] = await tx.select({ id: departments.id }).from(departments)
    .where(and(eq(departments.organizationId, council.id), eq(departments.isLeadership, true)))
  return leadership
}

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
    if (!await leadershipOf(tx)) await tx.insert(departments).values(leadershipData)
  })
}

export async function assignDepartment(db: Database, userId: string, department: 'planning' | 'finance' | 'leadership') {
  if (!userId.trim() || !(department === 'leadership' || department in departmentData)) throw new Error('Invalid assignment')
  await db.transaction(async tx => {
    const [account] = await tx.select({ id: accounts.id }).from(accounts)
      .where(and(eq(accounts.userId, userId), eq(accounts.providerId, 'google'))).limit(1)
    if (!account) throw new Error('An existing Google user is required')
    let targetId: string
    if (department === 'leadership') {
      const leadership = await leadershipOf(tx)
      if (!leadership) throw new Error('Seeded test department is required')
      targetId = leadership.id
    } else {
      const target = departmentData[department]
      const [savedDepartment] = await tx.select().from(departments).where(eq(departments.id, target.id))
      if (savedDepartment?.organizationId !== council.id || savedDepartment.name !== target.name || savedDepartment.handlesFinance !== target.handlesFinance) {
        throw new Error('Seeded test department is required')
      }
      targetId = target.id
    }
    await tx.insert(memberships).values({ id: randomUUID(), userId, organizationId: council.id, departmentId: targetId })
      .onConflictDoNothing({ target: [memberships.organizationId, memberships.userId] })
    // 초대로 들어와 미배정인 소속에만 부서를 넣는다. 이미 정해진 부서는 바꾸지 않는다.
    await tx.update(memberships).set({ departmentId: targetId })
      .where(and(eq(memberships.organizationId, council.id), eq(memberships.userId, userId), isNull(memberships.departmentId)))
    const [membership] = await tx.select().from(memberships)
      .where(and(eq(memberships.organizationId, council.id), eq(memberships.userId, userId)))
    if (membership?.departmentId !== targetId) throw new Error('Existing department assignment cannot be overwritten')
  })
}
