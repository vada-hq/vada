import { and, eq } from 'drizzle-orm'
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { lockCouncil } from '../src/access/authorize.js'
import { actorOf } from '../src/access/actor.js'
import { currentCouncilMembership } from '../src/access/current-cohort.js'
import { syncRooms } from '../src/chat/rooms.js'
import { cohort, councilMembership, department, member, memberLogin, users } from '../src/db/schema.js'
import type { Tx } from '../src/db/types.js'
import { readLocalEnv } from '../src/local-env.js'
import { clockNow, createRecord } from '../src/records/records.js'
import { assignDepartment } from '../src/team/service.js'

const VIRTUAL_EMAIL = '@organization-preview.vada.invalid'
const DEPARTMENT_MEMBER_COUNT = 5
const DEPARTMENT_COUNT = 4
const PROFILE_VARIETY = 2
const GRADE_VARIETY = 4
const FIRST_ARGUMENT = 2

type Target = { userId: string; councilId: string; cohortId: string; memberId: string }

async function targetOf(tx: Tx, email: string, now: Date): Promise<Target> {
  const [user] = await tx.select({ id: users.id }).from(users).where(eq(users.email, email))
  if (!user) throw new Error('Google account not found')
  const rows = await tx
    .select({
      councilId: cohort.councilId,
      cohortId: councilMembership.cohortId,
      memberId: memberLogin.memberId,
    })
    .from(memberLogin)
    .innerJoin(councilMembership, eq(councilMembership.memberId, memberLogin.memberId))
    .innerJoin(cohort, eq(cohort.id, councilMembership.cohortId))
    .where(and(eq(memberLogin.userId, user.id), currentCouncilMembership(now)))
  const row = rows[0]
  if (rows.length !== 1 || !row) throw new Error('Account must have exactly one current council')
  return { userId: user.id, ...row }
}

async function departmentIds(tx: Tx, councilId: string) {
  const rows = await tx
    .select({ id: department.id, name: department.name })
    .from(department)
    .where(eq(department.councilId, councilId))
  if (rows.length !== DEPARTMENT_COUNT) throw new Error('Current council must have four departments')
  return rows.sort((left, right) => left.id.localeCompare(right.id))
}

type NewMember = {
  name: string
  email: string
  rank: 'vice_president' | null
  majorName: string
  grade: number
}

async function addMember(tx: Tx, target: Target, person: NewMember) {
  const memberId = await createRecord(tx, {
    kind: 'member',
    councilId: null,
    actor: null,
    values: {
      name: person.name,
      email: person.email,
      schoolName: '한양대학교 ERICA',
      collegeName: '소프트웨어융합대학',
      majorName: person.majorName,
      grade: person.grade,
    },
  })
  await createRecord(tx, {
    kind: 'council_membership',
    councilId: target.councilId,
    actor: target.memberId,
    values: {
      memberId,
      cohortId: target.cohortId,
      councilRank: person.rank,
      startsAt: clockNow,
    },
  })
  return memberId
}

async function updateProfile(tx: Tx, email: string, person: NewMember) {
  await tx
    .update(member)
    .set({
      schoolName: '한양대학교 ERICA',
      collegeName: '소프트웨어융합대학',
      majorName: person.majorName,
      grade: person.grade,
    })
    .where(eq(member.email, email))
}

async function existingIds(tx: Tx, councilId: string) {
  const rows = await tx
    .select({ email: member.email })
    .from(member)
    .innerJoin(councilMembership, eq(councilMembership.memberId, member.id))
    .innerJoin(cohort, eq(cohort.id, councilMembership.cohortId))
    .where(eq(cohort.councilId, councilId))
  return new Set(rows.flatMap(row => (row.email?.endsWith(VIRTUAL_EMAIL) ? [row.email] : [])))
}

async function seed(tx: Tx, email: string, now: Date) {
  const target = await targetOf(tx, email, now)
  await lockCouncil(tx, target.councilId)
  const president = await actorOf(tx, target.userId, target.councilId, now)
  if (!president || president.councilRank !== 'president') throw new Error('Account must be president')
  const departments = await departmentIds(tx, target.councilId)
  const existing = await existingIds(tx, target.councilId)
  const memberIds: string[] = []
  const viceEmail = `vice${VIRTUAL_EMAIL}`
  const vice = {
    name: '가상 부회장',
    email: viceEmail,
    rank: 'vice_president' as const,
    majorName: '컴퓨터학부',
    grade: 4,
  }
  if (existing.has(viceEmail)) await updateProfile(tx, viceEmail, vice)
  else memberIds.push(await addMember(tx, target, vice))
  for (const [departmentIndex, item] of departments.entries()) {
    for (let memberIndex = 0; memberIndex < DEPARTMENT_MEMBER_COUNT; memberIndex += 1) {
      const number = departmentIndex * DEPARTMENT_MEMBER_COUNT + memberIndex + 1
      const virtualEmail = `member-${number}${VIRTUAL_EMAIL}`
      const person = {
        name: `가상 구성원 ${number}`,
        email: virtualEmail,
        rank: null,
        majorName:
          departmentIndex % PROFILE_VARIETY === 0 ? '컴퓨터학부' : 'ICT융합학부',
        grade: (memberIndex % GRADE_VARIETY) + 1,
      } as const
      if (existing.has(virtualEmail)) {
        await updateProfile(tx, virtualEmail, person)
        continue
      }
      const memberId = await addMember(tx, target, person)
      await assignDepartment(tx, president, {
        memberId,
        departmentId: item.id,
        rank: memberIndex === 0 ? 'head' : null,
      })
      memberIds.push(memberId)
    }
  }
  await syncRooms(tx, president)
  return memberIds.length
}

function applyOf(args: readonly string[]) {
  return args.includes('--apply')
}

async function main() {
  const email = process.argv[FIRST_ARGUMENT]?.trim().toLowerCase()
  if (!email || process.argv.slice(FIRST_ARGUMENT + 1).some(arg => !['--apply'].includes(arg))) {
    throw new Error('Usage: organization-preview-data <email> [--apply]')
  }
  const env = readLocalEnv()
  if (!env.DATABASE_URL) throw new Error('Missing configuration')
  const client = postgres(env.DATABASE_URL, { max: 1, ssl: { rejectUnauthorized: true } })
  try {
    const db = drizzle(client)
    if (!applyOf(process.argv.slice(FIRST_ARGUMENT))) {
      console.log('미리 보기: 현재 학생회에 가상 부회장 1명과 부서별 구성원 20명을 넣는다.')
      return
    }
    const added = await db.transaction(tx => seed(tx, email, new Date()))
    console.log(`가상 구성원 ${added}명을 추가했어요. 본인을 포함한 목표 인원은 22명이에요.`)
  } finally {
    await client.end({ timeout: 5 })
  }
}

main().catch(() => {
  console.error('처리하지 못했어요. 계정 이메일, 현재 학생회 회장 권한, 부서 4개를 확인해 주세요.')
  process.exitCode = 1
})
