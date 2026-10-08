import { randomUUID } from 'node:crypto'
import { and, asc, count, eq, ne } from 'drizzle-orm'
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'
import { LEADERSHIP_DEFAULT_NAME, type CreateOrganizationRequest, type MembershipSummary, type OrganizationMembersResponse,
  type UpdateDepartmentRequest } from '@vada/contracts'
import { queryMemberships } from '../access/membership.js'
import { departments, memberships, organizations, purchaseRequests, users } from '../db/schema.js'
import { ApiError } from '../http/errors.js'
import { sqlState } from '../http/on-error.js'

type Db = PgDatabase<PgQueryResultHKT>
export type OrganizationDatabase = Pick<Db, 'select' | 'transaction'>
type Reader = Pick<Db, 'select'>
type Transaction = Parameters<Parameters<OrganizationDatabase['transaction']>[0]>[0]

async function members(db: Reader, organizationId: string, userId: string): Promise<OrganizationMembersResponse> {
  const [viewer] = await queryMemberships(db, userId, organizationId)
  if (!viewer) throw new ApiError('FORBIDDEN', 403)
  const departmentRows = await db.select({ id: departments.id, name: departments.name, isLeadership: departments.isLeadership,
    handlesFinance: departments.handlesFinance }).from(departments)
    .where(eq(departments.organizationId, organizationId)).orderBy(asc(departments.id))
  // 구성원에게는 이름만 보인다. 이메일은 주지 않는다.
  const memberRows = await db.select({ id: memberships.id, name: users.name, title: memberships.title, departmentId: memberships.departmentId })
    .from(memberships).innerJoin(users, eq(users.id, memberships.userId))
    .where(eq(memberships.organizationId, organizationId)).orderBy(asc(memberships.id))
  return { viewer, departments: departmentRows, members: memberRows }
}

// 같은 학생회의 조직 변경을 한 번에 하나씩 처리한다. 잠근 뒤 요청자가 여전히 회장단인지 확인한다.
async function lockAsLeader(tx: Transaction, organizationId: string, userId: string) {
  const [leadership] = await tx.select({ id: departments.id }).from(departments)
    .where(and(eq(departments.organizationId, organizationId), eq(departments.isLeadership, true))).for('update')
  if (!leadership) throw new ApiError('FORBIDDEN', 403)
  const [leader] = await tx.select({ id: memberships.id }).from(memberships)
    .where(and(eq(memberships.organizationId, organizationId), eq(memberships.userId, userId), eq(memberships.departmentId, leadership.id)))
  if (!leader) throw new ApiError('FORBIDDEN', 403)
  return leadership.id
}

async function departmentIn(tx: Reader, organizationId: string, departmentId: string) {
  const [department] = await tx.select({ id: departments.id, isLeadership: departments.isLeadership }).from(departments)
    .where(and(eq(departments.organizationId, organizationId), eq(departments.id, departmentId)))
  if (!department) throw new ApiError('NOT_FOUND', 404)
  return department
}

async function assertNameFree(tx: Reader, organizationId: string, name: string, exceptId?: string) {
  const [taken] = await tx.select({ id: departments.id }).from(departments)
    .where(and(eq(departments.organizationId, organizationId), eq(departments.name, name), exceptId === undefined ? undefined : ne(departments.id, exceptId)))
  if (taken) throw new ApiError('DEPARTMENT_NAME_TAKEN', 409)
}

export function createOrganizationService(db: OrganizationDatabase) {
  async function mutate(organizationId: string, userId: string, change: (tx: Transaction, leadershipId: string) => Promise<void>) {
    try {
      return await db.transaction(async tx => {
        const leadershipId = await lockAsLeader(tx, organizationId, userId)
        await change(tx, leadershipId)
        return members(tx, organizationId, userId)
      })
    } catch (error) {
      if (error instanceof ApiError) throw error
      // 미리 조회한 뒤 다른 요청과 겹쳐 생긴 제약 위반은 같은 오류 코드로 바꾼다.
      const state = sqlState(error)
      if (state === '23505') throw new ApiError('DEPARTMENT_NAME_TAKEN', 409)
      if (state === '23503') throw new ApiError('DEPARTMENT_IN_USE', 409)
      throw error
    }
  }

  return {
    // 와이어프레임 ORG-01·02를 줄였다. 학생회, 회장단, 부서, 만든 사람의 회장단 소속을 한 번에 만든다.
    async create(userId: string, input: CreateOrganizationRequest): Promise<MembershipSummary> {
      const organizationId = randomUUID()
      const leadershipId = randomUUID()
      await db.transaction(async tx => {
        await tx.insert(organizations).values({ id: organizationId, name: input.name })
        await tx.insert(departments).values([
          { id: leadershipId, organizationId, name: LEADERSHIP_DEFAULT_NAME, isLeadership: true },
          ...input.departments.map(department => ({ id: randomUUID(), organizationId, name: department.name, handlesFinance: department.handlesFinance })),
        ])
        await tx.insert(memberships).values({ id: randomUUID(), userId, organizationId, departmentId: leadershipId })
      })
      const [membership] = await queryMemberships(db, userId, organizationId)
      if (!membership) throw new Error('Membership missing after create')
      return membership
    },
    list: (organizationId: string, userId: string) => members(db, organizationId, userId),
    createDepartment: (organizationId: string, userId: string, name: string) => mutate(organizationId, userId, async tx => {
      await assertNameFree(tx, organizationId, name)
      await tx.insert(departments).values({ id: randomUUID(), organizationId, name })
    }),
    updateDepartment: (organizationId: string, userId: string, departmentId: string, input: UpdateDepartmentRequest) =>
      mutate(organizationId, userId, async tx => {
        const department = await departmentIn(tx, organizationId, departmentId)
        if (department.isLeadership && input.handlesFinance) throw new ApiError('LEADERSHIP_FIXED', 409)
        await assertNameFree(tx, organizationId, input.name, departmentId)
        await tx.update(departments).set({ name: input.name, handlesFinance: input.handlesFinance })
          .where(and(eq(departments.organizationId, organizationId), eq(departments.id, departmentId)))
      }),
    deleteDepartment: (organizationId: string, userId: string, departmentId: string) => mutate(organizationId, userId, async tx => {
      const department = await departmentIn(tx, organizationId, departmentId)
      if (department.isLeadership) throw new ApiError('LEADERSHIP_FIXED', 409)
      const [member] = await tx.select({ id: memberships.id }).from(memberships).where(eq(memberships.departmentId, departmentId)).limit(1)
      if (member) throw new ApiError('DEPARTMENT_NOT_EMPTY', 409)
      // 지우면 과거 요청의 부서가 사라지므로, 기록이 있는 부서는 지우지 않는다.
      const [request] = await tx.select({ id: purchaseRequests.id }).from(purchaseRequests).where(eq(purchaseRequests.departmentId, departmentId)).limit(1)
      if (request) throw new ApiError('DEPARTMENT_IN_USE', 409)
      await tx.delete(departments).where(and(eq(departments.organizationId, organizationId), eq(departments.id, departmentId)))
    }),
    assignDepartment: (organizationId: string, userId: string, membershipId: string, departmentId: string | null) =>
      mutate(organizationId, userId, async (tx, leadershipId) => {
        const [member] = await tx.select({ departmentId: memberships.departmentId }).from(memberships)
          .where(and(eq(memberships.organizationId, organizationId), eq(memberships.id, membershipId)))
        if (!member) throw new ApiError('NOT_FOUND', 404)
        if (departmentId !== null) await departmentIn(tx, organizationId, departmentId)
        if (member.departmentId === departmentId) return
        if (member.departmentId === leadershipId) {
          const [leaders] = await tx.select({ n: count() }).from(memberships).where(eq(memberships.departmentId, leadershipId))
          if ((leaders?.n ?? 0) <= 1) throw new ApiError('LAST_LEADER', 409)
        }
        // 직책은 대개 그 부서에 묶여 있어서 부서를 옮기면 지운다.
        await tx.update(memberships).set({ departmentId, title: null })
          .where(and(eq(memberships.organizationId, organizationId), eq(memberships.id, membershipId)))
      }),
    updateTitle: (organizationId: string, userId: string, membershipId: string, title: string | null) => mutate(organizationId, userId, async tx => {
      const updated = await tx.update(memberships).set({ title })
        .where(and(eq(memberships.organizationId, organizationId), eq(memberships.id, membershipId))).returning({ id: memberships.id })
      if (!updated.length) throw new ApiError('NOT_FOUND', 404)
    }),
  }
}
