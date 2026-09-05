import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createApp, type Deps } from '../app.ts'
import type { Db } from '../db/client.ts'
import { freshDb } from '../db/testing.ts'
import {
  departments,
  educationColleges,
  educationSchools,
  members,
  organizations,
  rosterUpdates,
  students,
} from '../db/schema.ts'
import { inMemoryAttempts } from '../idempotency.ts'
import type { Viewer } from '../permissions.ts'
import { inMemoryCounter } from '../public/rate-limit.ts'

// 학생 명단(ORG-07A)과 그 곁의 셋.
//
// **이 명단은 학생회 구성원이 아니다.** 단과대학 학생 전체이고, 행사 참가 확인과
// 학생회비 조회에 쓴다 — `members`와 `students`가 다른 표인 까닭이다.
//
// 이 파일이 재는 것이 넷이다.
//
// 1. **거르는 것을 서버가 한다.** 화면이 전부 받아 거르면 천 명짜리 명단이 통째로 온다.
// 2. **완성된 글을 준다.** '납부'·'미납'·'확인 필요'와 그 색은 서버가 정한다 — 화면마다
//    적으면 화면마다 다른 말이 나온다.
// 3. **총 건수는 거른 뒤의 것이다.** 한 쪽만 받아 오므로 목록 자신이 셀 수 없다.
// 4. **울타리가 선다.** 남의 학생회 명단이 섞이지 않는다.

let db: Db
let close: () => Promise<void>
const NOW = new Date('2026-09-01T10:00:00+09:00')

function viewer(orgId = 'ORG-01'): Viewer {
  return {
    userId: 'U-01',
    membership: {
      orgId,
      memberId: 'M-01',
      role: 'member',
      departmentId: null,
      inFinanceDepartment: false,
    },
  }
}

function harness(who: Viewer | null = viewer()) {
  const deps: Deps = {
    audit: { async write() {} },
    db,
    who: async () => who,
    lookups: {
      isEventStaff: async () => false,
      isEventStaffManager: async () => false,
      isMeetingHost: async () => false,
      isMeetingCreator: async () => false,
      isMeetingParticipant: async () => false,
    },
    signIn: {
      open: () => ({ google: true, kakao: false }),
      start: async (provider: string) => ({ url: `https://example.test/${provider}` }),
    },
    attempts: inMemoryAttempts(),
    counter: inMemoryCounter(),
    invite: { linkBase: 'https://vada.app/join', now: () => NOW, newCode: () => 'CODE' },
    newId: () => 'X-01',
  }
  return createApp(deps)
}

const roster = (query = '') => harness().request(`/api/org/students${query}`)
const rows = async (query = '') =>
  (await (await roster(query)).json()) as Array<Record<string, string>>

beforeAll(async () => {
  const fresh = await freshDb()
  db = fresh.db as unknown as Db
  close = fresh.close

  await db.insert(organizations).values([
    { id: 'ORG-01', name: '제12대 학생회', term: '2026', repSchoolId: 'SCH-HYU-ERICA', repCollegeId: 'COL-HYU-ERICA-SW' },
    // **옆 학생회를 하나 더 둔다.** 울타리를 재려면 넘어갈 담이 있어야 한다.
    //
    // 운영 연도를 안 적어 둔 학생회이기도 하다 — 그 열이 생기기 전에 만들어진
    // 학생회가 실제로 있고, 그때 학기 목록이 무엇을 답하는지를 이 줄이 잰다.
    { id: 'ORG-02', name: '옆 학생회', createdAt: new Date('2024-03-02T09:00:00+09:00') },
  ])
  await db.insert(departments).values([
    { id: 'D-01', orgId: 'ORG-01', name: '기획부' },
    { id: 'D-02', orgId: 'ORG-01', name: '재정부', handlesFinance: true },
    // 옆 학생회의 부서. 이 목록에 나오면 안 된다.
    { id: 'D-99', orgId: 'ORG-02', name: '남의 부서' },
  ])
  await db.insert(members).values({ id: 'M-01', orgId: 'ORG-01', name: '이지원', role: 'chair' })

  await db.insert(students).values([
    { id: 'S-01', orgId: 'ORG-01', name: '김바다', studentNumber: '2022123456', college: '소프트웨어융합대학', department: '컴퓨터학부', grade: '3학년', duesStatus: 'paid' },
    { id: 'S-02', orgId: 'ORG-01', name: '박해랑', studentNumber: '2023234567', college: '소프트웨어융합대학', department: '컴퓨터학부', grade: '2학년', duesStatus: 'paid' },
    { id: 'S-03', orgId: 'ORG-01', name: '이윤슬', studentNumber: '2020345678', college: '소프트웨어융합대학', department: 'ICT융합학부', grade: '4학년', duesStatus: 'unpaid' },
    { id: 'S-05', orgId: 'ORG-01', name: '최바람', studentNumber: '2021567890', college: '소프트웨어융합대학', department: '컴퓨터학부', grade: '3학년', duesStatus: 'check' },
    // 옆 학생회의 사람. 이 명단에 나오면 안 된다.
    { id: 'S-99', orgId: 'ORG-02', name: '남의학생', studentNumber: '2099999999', college: '옆 대학', department: '옆 학부', grade: '1학년', duesStatus: 'paid' },
  ])

  await db.insert(rosterUpdates).values([
    { id: 'RU-01', orgId: 'ORG-01', kind: 'roster', updatedAt: new Date('2026-07-20T14:32:00+09:00'), updatedByMemberId: 'M-01' },
    { id: 'RU-02', orgId: 'ORG-01', kind: 'dues', updatedAt: new Date('2026-07-18T10:15:00+09:00'), updatedByMemberId: 'M-01' },
  ])

  await db.insert(educationSchools).values({ id: 'SCH-X', name: '옆에 있는 대학교' }).onConflictDoNothing()
  await db.insert(educationColleges).values({ id: 'COL-X', schoolId: 'SCH-X', name: '옆 단과대학' }).onConflictDoNothing()
}, 60_000)

afterAll(async () => {
  await close()
})

describe('명단을 읽는다', () => {
  it('내 학생회의 사람만 온다', async () => {
    const found = await rows()
    expect(found.map((row) => row.name).sort()).toEqual(['김바다', '박해랑', '이윤슬', '최바람'])
  })

  // **완성된 글을 준다.** 화면이 'paid'를 '납부'로 옮기면 화면마다 다른 말이 나온다.
  it('학생회비 상태를 완성된 글과 색으로 준다', async () => {
    const found = await rows()
    const bada = found.find((row) => row.name === '김바다')!
    expect(bada.duesLabel).toBe('납부')
    expect(bada.duesTone).toBe('green')
    const baram = found.find((row) => row.name === '최바람')!
    expect(baram.duesLabel).toBe('확인 필요')
    expect(baram.duesTone).toBe('yellow')
  })

  // **손봐야 하는 줄에만 색이 붙는다.** 전부에 붙이면 아무것도 눈에 띄지 않는다.
  it('확인이 필요한 줄만 줄 색을 갖는다', async () => {
    const found = await rows()
    expect(found.find((row) => row.name === '최바람')!.rowTone).toBe('yellow')
    expect(found.find((row) => row.name === '김바다')!.rowTone).toBe('')
  })
})

describe('거르는 것을 서버가 한다', () => {
  it('이름으로 찾는다', async () => {
    expect((await rows('?query=바다')).map((row) => row.name)).toEqual(['김바다'])
  })

  it('학번으로도 찾는다', async () => {
    expect((await rows('?query=2020345678')).map((row) => row.name)).toEqual(['이윤슬'])
  })

  it('학년으로 거른다', async () => {
    expect((await rows('?grade=3학년')).map((row) => row.name).sort()).toEqual(['김바다', '최바람'])
  })

  it('납부 상태로 거른다', async () => {
    expect((await rows('?duesStatus=unpaid')).map((row) => row.name)).toEqual(['이윤슬'])
  })

  // 화면의 거르개가 '전체'를 값으로 보낸다. 그것은 거르지 않는다는 뜻이다.
  it("'전체'는 거르지 않는다", async () => {
    expect((await rows('?duesStatus=all')).length).toBe(4)
  })
})

describe('총 건수는 거른 뒤의 것이다', () => {
  const paging = async (query = '') =>
    (await (await harness().request(`/api/org/students/paging${query}`)).json()) as {
      totalNote: string
      pageCount: number
    }

  it('모두 몇인지 완성된 문구로 준다', async () => {
    expect((await paging()).totalNote).toBe('총 4명')
  })

  // **거르고 나서 센다.** 거르기 전 수를 주면 화면이 '총 4명'이라 적고 한 줄만 그린다.
  it('거른 뒤의 수를 센다', async () => {
    expect((await paging('?grade=3학년')).totalNote).toBe('총 2명')
  })

  it('쪽 수를 말한다', async () => {
    expect((await paging()).pageCount).toBeGreaterThanOrEqual(1)
  })
})

describe('명단의 범위와 갱신된 때', () => {
  const scope = async () =>
    (await (await harness().request('/api/org/roster/scope')).json()) as Record<string, string>

  // **범위는 조직 설정이 정한다.** 화면이 지어낼 수 없다.
  it('대표 범위를 경로로 잇는다', async () => {
    expect((await scope()).path).toContain('한양대학교 ERICA')
  })

  it('언제 누가 갈아 끼웠는지 말한다', async () => {
    const row = await scope()
    expect(row.rosterUpdatedAt).toBe('2026-07-20 14:32')
    expect(row.rosterUpdatedBy).toContain('이지원')
    expect(row.duesUpdatedAt).toBe('2026-07-18 10:15')
  })
})

describe('조직 관리 영역의 한 줄', () => {
  it('셋 다 완성된 문장으로 온다', async () => {
    const row = (await (await harness().request('/api/org/area-summaries')).json()) as Record<
      string,
      string
    >
    // 부서는 아직 없고 구성원은 하나다. 셈한 것이 그대로 글이 된다.
    expect(row.departments).toContain('구성원 1명')
    expect(row.students).toContain('학생 4명')
    expect(row.roles).toContain('기본 역할 3종')
  })
})

describe('고르는 부서 목록', () => {
  // **학생회의 부서다.** 학교의 학부·학과(education.departments)와 다른 물건이고,
  // 조직도가 읽는 자리와도 다르다 — 저기는 부서장과 부원까지 실은 나무를 주고
  // 여기는 값과 글만 있으면 된다.
  it('내 학생회의 부서만 고를 수 있다', async () => {
    const found = (await (
      await harness().request('/api/org/departments/options')
    ).json()) as Array<{ value: string; label: string }>
    expect(found.map((row) => row.label)).toEqual(['기획부', '재정부'])
  })

  // 값은 부서의 id다 — 이름으로 고르면 이름을 바꾼 순간 고른 것이 사라진다.
  it('값은 이름이 아니라 부서의 id다', async () => {
    const found = (await (
      await harness().request('/api/org/departments/options')
    ).json()) as Array<{ value: string; label: string }>
    expect(found.find((row) => row.label === '기획부')!.value).toBe('D-01')
  })
})

describe('학생회비를 걷는 학기', () => {
  const terms = async (who = viewer()) =>
    (await (await harness(who).request('/api/org/dues-terms')).json()) as Array<{
      value: string
      label: string
    }>

  // **운영 연도가 정한다.** 명세가 목록을 들 수 없다고 적은 까닭이 이것이다 —
  // 학기는 하나씩 지나가고, 지나갈 때마다 명세에 적힌 목록이 틀린다.
  it('운영 연도의 두 학기를 준다', async () => {
    expect((await terms()).map((row) => row.label)).toEqual(['2026년 1학기', '2026년 2학기'])
  })

  // 값은 글이 아니다. '2026년 1학기'를 값으로 두면 글을 다듬는 날 이미 올라간
  // 명단들이 어느 학기의 것인지 모르게 된다.
  it('값은 글이 아니라 학기다', async () => {
    expect((await terms()).map((row) => row.value)).toEqual(['2026-1', '2026-2'])
  })

  // **남의 대의 학기는 없다.** 지난 대의 명단을 이 대의 이름으로 올리게 두면
  // 그 학기의 납부자가 두 대에 걸쳐 두 벌이 된다.
  it('운영 연도 밖의 학기는 고를 수 없다', async () => {
    const found = await terms()
    expect(found.some((row) => row.value.startsWith('2025'))).toBe(false)
    expect(found.some((row) => row.value.startsWith('2027'))).toBe(false)
  })

  // 운영 연도 열이 생기기 전에 만들어진 학생회가 있다. 빈 목록을 주면 그 학생회는
  // 명단을 영영 못 올린다 — 만들어진 해로 대신한다.
  it('운영 연도가 없으면 만들어진 해로 대신한다', async () => {
    expect((await terms(viewer('ORG-02'))).map((row) => row.value)).toEqual(['2024-1', '2024-2'])
  })
})
