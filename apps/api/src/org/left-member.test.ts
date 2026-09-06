import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { freshDb } from '../db/testing.ts'
import {
  departments,
  events,
  eventStaffMembers,
  members,
  organizations,
  users,
} from '../db/schema.ts'
import type { Db } from '../db/client.ts'
import { departmentTree, executives, unassignedHint, unassignedMembers } from './chart.ts'
import { roleAssignmentCount, roleAssignments, roleCounts } from './roles.ts'
import { roleAssignmentOf } from './role-change.ts'
import { memberCandidates } from '../meetings/meetings.ts'
import { eventStaffLeaders, staffLeaderCandidates, staffUnassignedMembers } from '../events/staff.ts'
import { viewerLookup } from '../auth/viewer.ts'

// **내보낸 사람이 다시 나타나는가.**
//
// 내보내기는 줄을 지우지 않는다 — 지우면 그 사람이 쓴 문서와 올린 요청이 이름을
// 잃는다. 대신 `members.leftAt`에 나간 때를 적고 **사람을 늘어놓는 조회와 권한을
// 판정하는 조회에서만** 뺀다(`stillHere`).
//
// 잊기 쉬운 자리다. `members`를 읽는 자리가 예순 곳이 넘고 그중 하나만 잊어도
// 내보낸 사람이 그 화면에 그대로 앉아 있다. **원본을 훑어 '조건을 썼는가'를 세지
// 않는다** — 그러면 조건을 쓰고도 엉뚱한 데 건 자리를 놓친다. 나간 사람을 심어
// 두고 **진짜 조회를 불러서** 나오는지 본다.
//
// **뒤집힌 쪽도 함께 잰다.** 다 거르면 이 검사는 통과하지만 제품이 망가진다:
//
// - **이미 앉은 자리는 그대로 둔다.** 행사 운영 조직에 든 사람이 학생회에서
//   나갔다고 그 행사의 조직이 저 혼자 바뀌면, 아무도 모르는 사이에 책임자가
//   사라진다. 고르는 목록에서만 빼고, 앉은 자리는 사람이 보고 사람이 바꾼다.
// - **기록은 이름을 잃지 않는다.** id로 이어 붙여 이름을 붙이는 자리에서 거르면
//   그 사람이 남긴 것이 전부 '알 수 없음'이 된다.

let db: Db
let close: () => Promise<void>

const CHAIR = 'M-CHAIR'
const HERE = 'M-HERE'
const GONE = 'M-GONE'
const LEFT_AT = new Date('2026-09-06T10:00:00+09:00')

beforeAll(async () => {
  const fresh = await freshDb()
  db = fresh.db as unknown as Db
  close = fresh.close
}, 60_000)

afterAll(async () => {
  await close()
})

beforeEach(async () => {
  await db.delete(eventStaffMembers)
  await db.delete(events)
  await db.delete(members)
  await db.delete(departments)
  await db.delete(organizations)
  await db.delete(users)

  await db.insert(users).values([
    { id: 'U-CHAIR', email: 'chair@example.com' },
    { id: 'U-GONE', email: 'gone@example.com' },
  ])
  await db.insert(organizations).values({ id: 'ORG-01', name: '우리 학생회' })
  await db.insert(departments).values({ id: 'D-01', orgId: 'ORG-01', name: '기획부' })
  await db.insert(events).values({ id: 'E-01', orgId: 'ORG-01', title: '한마당' })
  await db.insert(members).values([
    {
      id: CHAIR,
      orgId: 'ORG-01',
      userId: 'U-CHAIR',
      name: '남는회장',
      role: 'chair',
      executiveTitle: '회장',
    },
    { id: HERE, orgId: 'ORG-01', name: '남는사람', role: 'member', departmentId: 'D-01' },
    { id: GONE, orgId: 'ORG-01', userId: 'U-GONE', name: '나간사람', role: 'member', leftAt: LEFT_AT },
  ])
})

/** 나간 사람을 어느 자리에 두고 재는가. 자리마다 조회가 다르다. */
async function goneSits(seat: {
  role?: 'chair' | 'head' | 'member'
  departmentId?: string | null
}) {
  await db
    .update(members)
    .set({
      role: seat.role === 'head' ? 'head' : (seat.role ?? 'member'),
      departmentId: seat.departmentId ?? null,
      isDepartmentLeader: seat.role === 'head',
      executiveTitle: seat.role === 'chair' ? '부회장' : null,
    })
    .where(eq(members.id, GONE))
}

const names = (rows: Array<{ name: string }>) => rows.map((row) => row.name).sort()

describe('내보낸 사람은 사람을 늘어놓는 자리에 없다', () => {
  it('조직도의 회장단', async () => {
    await goneSits({ role: 'chair' })
    expect(names(await executives(db, 'ORG-01'))).toEqual(['남는회장'])
  })

  it('조직도의 부서원', async () => {
    await goneSits({ departmentId: 'D-01' })
    const tree = await departmentTree(db, 'ORG-01')
    expect(names(tree.flatMap((row) => [...row.leaders, ...row.members]))).toEqual(['남는사람'])
  })

  it('조직도의 부서장', async () => {
    await goneSits({ role: 'head', departmentId: 'D-01' })
    const tree = await departmentTree(db, 'ORG-01')
    expect(names(tree.flatMap((row) => row.leaders))).toEqual([])
  })

  it('부서 인원 수를 세는 말', async () => {
    await goneSits({ departmentId: 'D-01' })
    const tree = await departmentTree(db, 'ORG-01')
    expect(tree[0]!.memberCountLabel).toContain('1')
  })

  it('미배정 구성원과 그 안내', async () => {
    expect(names(await unassignedMembers(db, 'ORG-01'))).toEqual([])
    expect((await unassignedHint(db, 'ORG-01')).hint).toContain('0')
  })

  it('역할 배정 목록과 그 수', async () => {
    expect(names(await roleAssignments(db, 'ORG-01'))).toEqual(['남는사람', '남는회장'])
    expect((await roleAssignmentCount(db, 'ORG-01')).total).toBe('2명')
    expect((await roleCounts(db, 'ORG-01')).memberCount).toBe(1)
  })

  it('역할을 바꾸려고 고른 한 사람', async () => {
    expect(await roleAssignmentOf(db, 'ORG-01', GONE)).toBeNull()
    expect((await roleAssignmentOf(db, 'ORG-01', HERE))?.name).toBe('남는사람')
  })

  it('회의에 부를 사람', async () => {
    expect(names(await memberCandidates(db, 'ORG-01', {}))).toEqual(['남는사람', '남는회장'])
  })

  it('행사 책임자가 될 사람', async () => {
    const rows = await staffLeaderCandidates(db, 'ORG-01', 'E-01')
    expect(rows.map((row) => row.label).sort()).toEqual(['남는사람', '남는회장'])
  })

  it('행사 운영 조직에 아직 안 든 사람', async () => {
    expect(names(await staffUnassignedMembers(db, 'ORG-01', 'E-01'))).toEqual([
      '남는사람',
      '남는회장',
    ])
  })
})

describe('내보낸 사람은 들어오지 못한다', () => {
  it('권한 조회가 이 사람을 구성원으로 보지 않는다', async () => {
    const look = viewerLookup(db)
    expect((await look.who({ userId: 'U-GONE' }))?.membership).toBeNull()
    expect((await look.who({ userId: 'U-CHAIR' }))?.membership?.memberId).toBe(CHAIR)
  })
})

describe('그래도 지우지는 않는다', () => {
  it('줄과 이름이 표에 남는다', async () => {
    const rows = await db.select().from(members).where(eq(members.id, GONE))
    expect(rows[0]?.name).toBe('나간사람')
    expect(rows[0]?.leftAt).toEqual(LEFT_AT)
  })

  it('이미 앉은 행사 책임자 자리는 저 혼자 비지 않는다', async () => {
    await db.insert(eventStaffMembers).values({
      id: 'ES-01',
      orgId: 'ORG-01',
      eventId: 'E-01',
      memberId: GONE,
      isEventLeader: true,
      roleTitle: '총괄',
    })
    const leaders = await eventStaffLeaders(db, 'ORG-01', 'E-01')
    expect(leaders.map((row) => row.name)).toEqual(['나간사람'])
  })
})
