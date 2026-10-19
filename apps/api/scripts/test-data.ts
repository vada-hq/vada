import { and, eq, gte, isNull, lte } from 'drizzle-orm'
import { actorOf, koreanDate } from '../src/access/actor.js'
import { createCouncil } from '../src/councils/service.js'
import { accounts, cohort, council, councilMembership, department, inviteCode, memberLogin } from '../src/db/schema.js'
import { joinCouncil } from '../src/invites/service.js'
import type { Db, Tx } from '../src/records/records.js'
import { assignDepartment, createDepartment } from '../src/team/service.js'

// 개발 DB의 시험 학생회. 학교 이름으로 찾고, 초대 코드는 늘 TESTDATA다(/join/TESTDATA로 들어온다).
// 다시 돌려도 같은 결과가 나온다. 시연 데이터는 덩어리 6에서 다시 쓴다.
export const TEST_SCHOOL_NAME = 'VADA 시험 학교'
export const TEST_INVITE_CODE = 'TESTDATA'
export const TEST_DEPARTMENTS = { finance: '재정부', planning: '기획부' } as const
export type TestDepartment = keyof typeof TEST_DEPARTMENTS

async function requireGoogleUser(tx: Tx, userId: string) {
  const [account] = await tx.select({ id: accounts.id }).from(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.providerId, 'google'))).limit(1)
  if (!account) throw new Error('An existing Google user is required')
}

async function testCouncilId(tx: Tx) {
  const found = await tx.select({ id: council.id }).from(council).where(eq(council.schoolName, TEST_SCHOOL_NAME))
  if (found.length > 1) throw new Error('More than one test council')
  return found[0]?.id
}

// 지금 기수의 회장이 쓰는 로그인 계정
async function presidentUserOf(tx: Tx, councilId: string, now: Date) {
  const today = koreanDate(now)
  const [row] = await tx.select({ userId: memberLogin.userId }).from(councilMembership)
    .innerJoin(cohort, eq(cohort.id, councilMembership.cohortId))
    .innerJoin(memberLogin, eq(memberLogin.memberId, councilMembership.memberId))
    .where(and(eq(cohort.councilId, councilId), lte(cohort.startsOn, today), gte(cohort.endsOn, today),
      eq(councilMembership.councilRank, 'president'), isNull(councilMembership.endsAt)))
  return row?.userId
}

// 시험 학생회를 둔다. 회장은 주어진 Google 계정이다. 이미 있으면 회장이 같은지 보고, 초대 코드와 기획부를 맞춘다.
export async function seedTestCouncil(db: Db, userId: string, now: Date): Promise<string> {
  return db.transaction(async tx => {
    await requireGoogleUser(tx, userId)
    let councilId = await testCouncilId(tx)
    if (!councilId) {
      const year = koreanDate(now).slice(0, 4)
      councilId = await createCouncil(tx, userId, { name: 'VADA 시험 학생회', unit: 'department', schoolName: TEST_SCHOOL_NAME,
        cohortName: year, startsOn: `${year}-01-01`, endsOn: `${year}-12-31` }, now)
    } else if (await presidentUserOf(tx, councilId, now) !== userId) {
      throw new Error('Test council has another president')
    }
    await tx.update(inviteCode).set({ code: TEST_INVITE_CODE }).where(eq(inviteCode.councilId, councilId))
    const actor = await actorOf(tx, userId, councilId, now)
    if (!actor) throw new Error('Test council has no current cohort')
    const [planning] = await tx.select({ id: department.id }).from(department)
      .where(and(eq(department.councilId, councilId), eq(department.name, TEST_DEPARTMENTS.planning)))
    if (!planning) await createDepartment(tx, actor, TEST_DEPARTMENTS.planning)
    return councilId
  })
}

// 기존 Google 계정을 시험 학생회의 부서원으로 넣는다. 이미 다른 부서면 바꾸지 않고 실패한다.
export async function assignTestMember(db: Db, userId: string, target: TestDepartment, now: Date) {
  await db.transaction(async tx => {
    await requireGoogleUser(tx, userId)
    const councilId = await testCouncilId(tx)
    if (!councilId) throw new Error('Seed the test council first')
    const presidentUser = await presidentUserOf(tx, councilId, now)
    if (!presidentUser) throw new Error('Test council has no president')
    await joinCouncil(tx, userId, TEST_INVITE_CODE, now)
    const president = await actorOf(tx, presidentUser, councilId, now)
    const member = await actorOf(tx, userId, councilId, now)
    if (!president || !member) throw new Error('Test council has no current cohort')
    const [wanted] = await tx.select({ id: department.id }).from(department)
      .where(and(eq(department.councilId, councilId), eq(department.name, TEST_DEPARTMENTS[target])))
    if (!wanted) throw new Error('Seed the test council first')
    if (member.departments.some(item => item.departmentId !== wanted.id)) throw new Error('Existing department assignment cannot be overwritten')
    await assignDepartment(tx, president, member.memberId, wanted.id, null)
  })
}
