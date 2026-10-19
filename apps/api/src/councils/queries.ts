import { and, asc, eq, gte, inArray, isNull, lte } from 'drizzle-orm'
import type { CouncilView, MyCouncil } from '@vada/contracts'
import { koreanDate, type Actor } from '../access/actor.js'
import { permissionsOf } from '../access/permissions.js'
import { cohort, council, councilMembership, department, departmentMembership, member, memberLogin } from '../db/schema.js'
import type { Db } from '../records/records.js'

type Reader = Pick<Db, 'select'>

// 내 학생회 목록: 지금 소속이 있는 학생회와 그 학생회의 직급, 지금 부서 소속. 끝난 소속과 지난 기수는 빠진다.
export async function myCouncils(db: Reader, userId: string, now: Date): Promise<MyCouncil[]> {
  const today = koreanDate(now)
  const rows = await db.select({ id: council.id, name: council.name, councilRank: councilMembership.councilRank, memberId: memberLogin.memberId,
    cohortId: cohort.id })
    .from(memberLogin)
    .innerJoin(councilMembership, eq(councilMembership.memberId, memberLogin.memberId))
    .innerJoin(cohort, eq(cohort.id, councilMembership.cohortId))
    .innerJoin(council, eq(council.id, cohort.councilId))
    .where(and(eq(memberLogin.userId, userId), isNull(councilMembership.endsAt), lte(cohort.startsOn, today), gte(cohort.endsOn, today)))
    .orderBy(asc(council.id))
  const first = rows[0]
  if (!first) return []
  const placements = await db.select({ cohortId: departmentMembership.cohortId, id: department.id, name: department.name,
    rank: departmentMembership.departmentRank })
    .from(departmentMembership)
    .innerJoin(department, eq(department.id, departmentMembership.departmentId))
    .where(and(eq(departmentMembership.memberId, first.memberId), isNull(departmentMembership.endsAt),
      inArray(departmentMembership.cohortId, rows.map(row => row.cohortId))))
    .orderBy(asc(department.id))
  return rows.map(row => ({ id: row.id, name: row.name, councilRank: row.councilRank,
    departments: placements.filter(item => item.cohortId === row.cohortId).map(({ id, name, rank }) => ({ id, name, rank })) }))
}

// 학생회 하나: 학생회 정보, 지금 기수, 내 직급과 부서, 내 권한 목록
export async function councilView(db: Reader, actor: Actor): Promise<CouncilView> {
  const [row] = await db.select().from(council).where(eq(council.id, actor.councilId))
  const [period] = await db.select({ id: cohort.id, name: cohort.name, startsOn: cohort.startsOn, endsOn: cohort.endsOn })
    .from(cohort).where(eq(cohort.id, actor.cohortId))
  const [me] = await db.select({ name: member.name }).from(member).where(eq(member.id, actor.memberId))
  const ids = actor.departments.map(item => item.departmentId)
  const names = ids.length ? await db.select({ id: department.id, name: department.name }).from(department).where(inArray(department.id, ids)) : []
  if (!row || !period || !me) throw new Error('Council view missing rows')
  return {
    council: { id: row.id, name: row.name, unit: row.unit, schoolName: row.schoolName,
      titles: { president: row.presidentTitle, vicePresident: row.vicePresidentTitle, head: row.headTitle, viceHead: row.viceHeadTitle } },
    cohort: period,
    me: { memberId: actor.memberId, name: me.name, councilRank: actor.councilRank,
      departments: actor.departments.map(item => ({ id: item.departmentId, name: names.find(name => name.id === item.departmentId)?.name ?? '',
        role: item.role, rank: item.rank })) },
    permissions: permissionsOf(actor),
  }
}
