import { and, eq } from 'drizzle-orm'
import { koreanDateOf } from '@vada/contracts'
import { actorOf } from '../src/access/actor.js'
import { currentCouncilMembership } from '../src/access/current-cohort.js'
import { createCouncil } from '../src/councils/service.js'
import {
  accounts,
  cohort,
  council,
  councilMembership,
  department,
  inviteCode,
  memberLogin,
} from '../src/db/schema.js'
import { joinCouncil } from '../src/invites/service.js'
import type { Db, Tx } from '../src/db/types.js'
import { assignDepartment, createDepartment } from '../src/team/service.js'

// 개발 DB의 시험 학생회. 학교 이름으로 찾고, 초대 코드는 늘 TESTDATA다(/join/TESTDATA로 들어온다).
// 다시 돌려도 같은 결과가 나온다. 시연 데이터는 덩어리 6에서 다시 쓴다.
export const TEST_SCHOOL_NAME = 'VADA 시험 학교'
export const TEST_INVITE_CODE = 'TESTDATA'
export const TEST_DEPARTMENTS = { finance: '재정부', planning: '기획부' } as const
export type TestDepartment = keyof typeof TEST_DEPARTMENTS

// 명령 인자. --apply가 없으면 미리 보기(대상만 보여 주고 아무것도 쓰지 않는다)다. 오타, 모르는 인자, 개수 틀림은 null이다.
export type TestDataCommand =
  | { command: 'seed'; userId: string; apply: boolean }
  | { command: 'assign'; userId: string; department: TestDepartment; apply: boolean }
export function parseTestDataArgs(args: readonly string[]): TestDataCommand | null {
  const apply = args.at(-1) === '--apply'
  const rest = apply ? args.slice(0, -1) : args
  const [command, userId, department, ...extra] = rest
  // 계정 번호 자리에 플래그가 들어오면(seed --apply) 계정 번호가 빠진 것이다.
  if (extra.length > 0 || !userId?.trim() || userId.startsWith('-')) return null
  if (command === 'seed' && department === undefined) return { command, userId, apply }
  if (
    command === 'assign' &&
    department !== undefined &&
    Object.hasOwn(TEST_DEPARTMENTS, department)
  ) {
    return { command, userId, department: department as TestDepartment, apply }
  }
  return null
}

async function requireGoogleUser(tx: Tx, userId: string) {
  const [account] = await tx
    .select({ id: accounts.id })
    .from(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.providerId, 'google')))
    .limit(1)
  if (!account) throw new Error('An existing Google user is required')
}

async function testCouncilId(tx: Tx) {
  const found = await tx
    .select({ id: council.id })
    .from(council)
    .where(eq(council.schoolName, TEST_SCHOOL_NAME))
  if (found.length > 1) throw new Error('More than one test council')
  return found[0]?.id
}

// 지금 기수의 회장이 쓰는 로그인 계정
async function presidentUserOf(tx: Tx, councilId: string, now: Date) {
  const [row] = await tx
    .select({ userId: memberLogin.userId })
    .from(councilMembership)
    .innerJoin(cohort, eq(cohort.id, councilMembership.cohortId))
    .innerJoin(memberLogin, eq(memberLogin.memberId, councilMembership.memberId))
    .where(
      and(
        eq(cohort.councilId, councilId),
        eq(councilMembership.councilRank, 'president'),
        currentCouncilMembership(now),
      ),
    )
  return row?.userId
}

// 시험 학생회를 둔다. 회장은 주어진 Google 계정이다. 이미 있으면 회장이 같은지 보고, 초대 코드와 기획부를 맞춘다.
export async function seedTestCouncil(db: Db, userId: string, now: Date): Promise<string> {
  return db.transaction(async tx => {
    await requireGoogleUser(tx, userId)
    let councilId = await testCouncilId(tx)
    if (!councilId) {
      const year = koreanDateOf(now).slice(0, 4)
      councilId = await createCouncil(
        tx,
        userId,
        {
          name: 'VADA 시험 학생회',
          unit: 'department',
          schoolName: TEST_SCHOOL_NAME,
          cohortName: year,
          startsOn: `${year}-01-01`,
          endsOn: `${year}-12-31`,
        },
        now,
      )
    } else if ((await presidentUserOf(tx, councilId, now)) !== userId) {
      throw new Error('Test council has another president')
    }
    await tx
      .update(inviteCode)
      .set({ code: TEST_INVITE_CODE })
      .where(eq(inviteCode.councilId, councilId))
    const actor = await actorOf(tx, userId, councilId, now)
    if (!actor) throw new Error('Test council has no current cohort')
    const [planning] = await tx
      .select({ id: department.id })
      .from(department)
      .where(
        and(eq(department.councilId, councilId), eq(department.name, TEST_DEPARTMENTS.planning)),
      )
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
    const [wanted] = await tx
      .select({ id: department.id })
      .from(department)
      .where(
        and(eq(department.councilId, councilId), eq(department.name, TEST_DEPARTMENTS[target])),
      )
    if (!wanted) throw new Error('Seed the test council first')
    if (member.departments.some(item => item.departmentId !== wanted.id))
      throw new Error('Existing department assignment cannot be overwritten')
    await assignDepartment(tx, president, member.memberId, wanted.id, null)
  })
}
