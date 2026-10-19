import type { PGlite } from '@electric-sql/pglite'
import { memberLogin } from '../db/schema.js'
import { clockNow, createRecord, updateRecord, type Db } from '../records/records.js'

export type Person = { userId: string; memberId: string }

// 시험용 로그인 계정. better-auth가 만드는 users 행과 같은 칸만 채운다. Google 로그인처럼 이메일은 확인된 것이 기본이다.
export async function addUser(
  pg: PGlite,
  userId: string,
  name = userId,
  email = `${userId}@example.test`,
  emailVerified = true,
) {
  await pg.query('INSERT INTO users (id, name, email, email_verified) VALUES ($1, $2, $3, $4)', [
    userId,
    name,
    email,
    emailVerified,
  ])
}

// 학생회 하나와 여러 처지의 사람을 기록 모듈로 만든다. 권한과 소속 시험이 같이 쓴다.
// 사람: 회장, 부회장, 재정부원, 기획부장, 기획부 부부장, 기획부원, 직급과 부서가 없는 운영진, 내보낸 운영진(소속이 끝남).
export async function seedCouncil(
  db: Db,
  pg: PGlite,
  prefix = 's',
  period = { startsOn: '2026-01-01', endsOn: '2026-12-31' },
) {
  const names = [
    'president',
    'vicePresident',
    'financeMember',
    'planningHead',
    'planningViceHead',
    'planningMember',
    'plain',
    'ended',
  ] as const
  for (const name of names) await addUser(pg, `${prefix}-${name}`, `${prefix} ${name}`)
  return db.transaction(async tx => {
    const people = {} as Record<(typeof names)[number], Person>
    for (const name of names) {
      const memberId = await createRecord(tx, {
        kind: 'member',
        councilId: null,
        actor: null,
        values: { name: `${prefix} ${name}`, email: `${prefix}-${name}@example.test` },
      })
      await tx.insert(memberLogin).values({ memberId, userId: `${prefix}-${name}` })
      people[name] = { userId: `${prefix}-${name}`, memberId }
    }
    const actor = people.president.memberId
    const councilId = await createRecord(tx, {
      kind: 'council',
      councilId: null,
      actor,
      values: { name: `${prefix} 학생회`, unit: 'department', schoolName: '한양대학교 ERICA' },
    })
    const cohortId = await createRecord(tx, {
      kind: 'cohort',
      councilId,
      actor,
      values: { name: period.startsOn.slice(0, 4), ...period },
    })
    const finance = await createRecord(tx, {
      kind: 'department',
      councilId,
      actor,
      values: { name: '재정부', role: 'finance' },
    })
    const planning = await createRecord(tx, {
      kind: 'department',
      councilId,
      actor,
      values: { name: '기획부' },
    })
    const memberships: Record<string, string> = {}
    for (const name of names) {
      const councilRank =
        name === 'president'
          ? ('president' as const)
          : name === 'vicePresident'
            ? ('vice_president' as const)
            : null
      memberships[name] = await createRecord(tx, {
        kind: 'council_membership',
        councilId,
        actor,
        values: { memberId: people[name].memberId, cohortId, councilRank, startsAt: clockNow },
      })
    }
    const placements = [
      ['financeMember', finance, null],
      ['planningHead', planning, 'head'],
      ['planningViceHead', planning, 'vice_head'],
      ['planningMember', planning, null],
    ] as const
    for (const [name, departmentId, departmentRank] of placements) {
      await createRecord(tx, {
        kind: 'department_membership',
        councilId,
        actor,
        values: {
          memberId: people[name].memberId,
          departmentId,
          cohortId,
          departmentRank,
          startsAt: clockNow,
        },
      })
    }
    await updateRecord(tx, {
      kind: 'council_membership',
      id: memberships.ended!,
      actor,
      reason: null,
      changes: { endsAt: clockNow },
    })
    return { councilId, cohortId, departments: { finance, planning }, people }
  })
}
export type SeededCouncil = Awaited<ReturnType<typeof seedCouncil>>
