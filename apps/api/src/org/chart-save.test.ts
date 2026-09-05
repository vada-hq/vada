import { beforeAll, afterAll, beforeEach, describe, expect, it } from 'vitest'
import Ajv from 'ajv'
import openapi from '../../../../specs/figma/vada-wireframe/openapi.json' with { type: 'json' }
import { createApp, type Deps } from '../app.ts'
import type { Db } from '../db/client.ts'
import { freshDb } from '../db/testing.ts'
import { departments, members, organizations, permissionChanges, users } from '../db/schema.ts'
import { inMemoryCounter } from '../public/rate-limit.ts'
import { inMemoryAttempts } from '../idempotency.ts'
import { routeOf } from '../routes.ts'
import type { Viewer } from '../permissions.ts'

// 조직도 저장(ORG-03B · org.saveChart)이 실제로 도는가.
//
// **저장하고 다시 읽으면 같은 배치가 보여야 한다.** 읽는 자리(`chart.ts`)가 회장단을
// `role = chair`로, 부서장을 `isDepartmentLeader`로, 미배정을 `departmentId is null`로
// 읽으므로 저장이 그 열들을 그 뜻대로 두는지를 읽는 자리로 되물어 잰다.

let db: Db
let close: () => Promise<void>

function viewer(role: 'chair' | 'head' | 'member', memberId = 'M-01'): Viewer {
  return {
    userId: 'U-01',
    membership: {
      orgId: 'ORG-01',
      memberId,
      role,
      departmentId: null,
      inFinanceDepartment: false,
    },
  }
}

function harness(who: Viewer | null = viewer('chair')) {
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
    invite: {
      linkBase: 'https://vada.app/join',
      now: () => new Date('2026-07-22T18:30:00+09:00'),
      newCode: () => 'CODE-1',
    },
    newId: () => 'E-01',
  }
  return createApp(deps)
}

/** 화면이 초안에 쓰는 그 모양이다 — 자리 이름마다 줄바꿈으로 이은 사람 id. */
const SEED = {
  executives: 'M-01\nM-02',
  'D-01.leaders': 'M-11',
  'D-01.members': 'M-13',
  'D-02.leaders': '',
  'D-02.members': '',
  unassigned: 'M-99',
  memberQuery: '',
}

const put = (chart: unknown, who: Viewer | null = viewer('chair')) =>
  harness(who).request('/api/org/chart', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: typeof chart === 'string' ? chart : JSON.stringify(chart),
  })

async function readBack() {
  const app = harness()
  const executives = (await (await app.request('/api/org/executives')).json()) as Array<{
    name: string
    roleLabel: string
  }>
  const tree = (await (await app.request('/api/org/departments')).json()) as Array<{
    name: string
    leaders: Array<{ name: string }>
    members: Array<{ name: string }>
  }>
  const unassigned = (await (await app.request('/api/org/unassigned-members')).json()) as Array<{
    name: string
  }>
  return {
    executives: executives.map((row) => row.name),
    departments: tree.map((row) => [
      row.name,
      row.leaders.map((who) => who.name),
      row.members.map((who) => who.name),
    ]),
    unassigned: unassigned.map((row) => row.name),
  }
}

beforeAll(async () => {
  const fresh = await freshDb()
  db = fresh.db as unknown as Db
  close = fresh.close
}, 60_000)

beforeEach(async () => {
  await db.delete(permissionChanges)
  await db.delete(members)
  await db.delete(departments)
  await db.delete(organizations)
  await db.delete(users)

  await db.insert(users).values({ id: 'U-01', email: 'chair@example.ac.kr' })
  await db.insert(organizations).values([
    { id: 'ORG-01', name: '제12대 학생회' },
    { id: 'ORG-02', name: '옆 학생회' },
  ])
  await db.insert(departments).values([
    { id: 'D-01', orgId: 'ORG-01', name: '기획부', sortOrder: 0 },
    { id: 'D-02', orgId: 'ORG-01', name: '홍보부', sortOrder: 1 },
    { id: 'D-X', orgId: 'ORG-02', name: '남의 부서', sortOrder: 0 },
  ])
  await db.insert(members).values([
    { id: 'M-01', orgId: 'ORG-01', name: '김바다', role: 'chair', executiveTitle: '회장' },
    { id: 'M-02', orgId: 'ORG-01', name: '이윤슬', role: 'chair', executiveTitle: '부회장' },
    { id: 'M-11', orgId: 'ORG-01', name: '이수현', role: 'head', departmentId: 'D-01', isDepartmentLeader: true },
    { id: 'M-13', orgId: 'ORG-01', name: '박민수', role: 'member', departmentId: 'D-01' },
    { id: 'M-99', orgId: 'ORG-01', name: '한겨울', role: 'member' },
    { id: 'M-X', orgId: 'ORG-02', name: '남의사람', role: 'member', departmentId: 'D-X' },
  ])
})

afterAll(async () => {
  await close()
})

describe('저장한 배치가 그대로 읽힌다', () => {
  // 한겨울을 홍보부 부서장으로, 박민수를 미배정으로, 이윤슬을 회장단에서 기획부 부원으로.
  const moved = {
    ...SEED,
    executives: 'M-01',
    'D-01.members': 'M-02',
    'D-02.leaders': 'M-99',
    unassigned: 'M-13',
  }

  it('회장단·부서장·부원·미배정이 보낸 대로 놓인다', async () => {
    const res = await put(moved)
    expect(res.status).toBe(200)
    expect(await readBack()).toEqual({
      executives: ['김바다'],
      departments: [
        ['기획부', ['이수현'], ['이윤슬']],
        ['홍보부', ['한겨울'], []],
      ],
      unassigned: ['박민수'],
    })
  })

  // **자리가 곧 역할이다.** ORG-04(역할 및 권한)이 `role`을 읽으므로 조직도가 옮긴
  // 사람을 저쪽도 같은 말로 불러야 한다 — 갈리면 두 화면이 다른 말을 한다.
  it('ORG-04이 옮긴 자리를 같은 말로 부른다', async () => {
    await put(moved)
    const res = await harness().request('/api/org/role-assignments')
    const rows = (await res.json()) as Array<{ name: string; roleLabel: string; department: string }>
    expect(rows.map((row) => [row.name, row.roleLabel, row.department])).toEqual([
      ['김바다', '회장단', '소속 없음'],
      ['이수현', '부서장', '기획부'],
      ['한겨울', '부서장', '홍보부'],
      ['박민수', '부원', '소속 없음'],
      ['이윤슬', '부원', '기획부'],
    ])
  })

  // 회장단 안의 자리 이름('회장'·'부회장')은 회장단이 아닌 사람에게는 없다.
  // 남은 사람의 것은 그대로다 — 조직도가 그 말로 차례와 색을 정한다.
  it('회장단에서 나간 사람은 자리 이름을 잃고 남은 사람은 지킨다', async () => {
    await put(moved)
    const rows = await db
      .select({ id: members.id, title: members.executiveTitle })
      .from(members)
    const titles = new Map(rows.map((row) => [row.id, row.title]))
    expect(titles.get('M-01')).toBe('회장')
    expect(titles.get('M-02')).toBe(null)
  })

  // **회장단에 새로 든 사람의 자리 이름은 아직 정할 수 없다.** 그것을 고치는 화면이
  // 명세에 없다(ORG-03B의 '수정'이 pending). 비워 두면 조직도가 '회장단'으로 그린다.
  it('회장단에 새로 든 사람은 자리 이름 없이 회장단으로 읽힌다', async () => {
    await put({ ...SEED, executives: 'M-01\nM-02\nM-99', unassigned: '' })
    const res = await harness().request('/api/org/executives')
    const rows = (await res.json()) as Array<{ name: string; roleLabel: string }>
    expect(rows.map((row) => [row.name, row.roleLabel])).toEqual([
      ['김바다', '회장'],
      ['이윤슬', '부회장'],
      ['한겨울', '회장단'],
    ])
  })

  // 회장이 부서에도 속한 것은 흔한 일이고 읽는 자리가 둘 다 그린다. 저장도 둘 다 지킨다.
  it('회장이 부서에도 있으면 두 자리를 다 지킨다', async () => {
    const res = await put({ ...SEED, 'D-01.members': 'M-13\nM-01' })
    expect(res.status).toBe(200)
    const back = await readBack()
    expect(back.executives).toEqual(['김바다', '이윤슬'])
    expect(back.departments[0]).toEqual(['기획부', ['이수현'], ['김바다', '박민수']])
  })
})

describe('덮어쓰기다', () => {
  // 계약의 `repeat: overwrite`. 같은 것을 다시 보내면 같은 결과이고 아무것도 더 남지 않는다.
  it('읽은 그대로 다시 보내면 아무것도 바뀌지 않는다', async () => {
    const before = await readBack()
    expect((await put(SEED)).status).toBe(200)
    expect(await readBack()).toEqual(before)
    expect(await db.select().from(permissionChanges)).toHaveLength(0)
  })

  it('답은 빈 것이고 계약의 모양이다', async () => {
    const res = await put(SEED)
    const body = await res.json()
    expect(body).toEqual({})
    const at = routeOf('org.saveChart')!
    const paths = openapi.paths as unknown as Record<string, Record<string, unknown>>
    const operation = paths[at.path]![at.method] as {
      responses: { 200: { content: { 'application/json': { schema: object } } } }
    }
    const validate = new Ajv({ strict: false }).compile(
      operation.responses[200].content['application/json'].schema,
    )
    expect(validate(body), JSON.stringify(validate.errors)).toBe(true)
  })
})

describe('권한을 바꾼 기록은 3년 남는다', () => {
  // 회장단에 넣는 것은 권한을 주는 일이고 부서장 자리에서 빼는 것은 없애는 일이다.
  // ORG-04B가 남기는 그 기록을 조직도도 남긴다 — 길이 다르다고 기록이 빠지면 안 된다.
  it('자리 이동으로 역할이 바뀐 사람만 적힌다', async () => {
    await put({
      ...SEED,
      executives: 'M-01\nM-99',
      'D-01.members': 'M-13\nM-02',
      unassigned: '',
    })
    const rows = await db.select().from(permissionChanges)
    expect(
      rows
        .map((row) => [row.subjectMemberId, row.subjectName, row.before, row.after, row.change])
        .sort(),
    ).toEqual([
      ['M-02', '이윤슬', 'chair', 'member', '기본 역할 변경'],
      ['M-99', '한겨울', 'member', 'chair', '기본 역할 변경'],
    ])
    expect(rows[0]!.orgId).toBe('ORG-01')
    expect(rows[0]!.actorUserId).toBe('U-01')
  })

  it('부서 안에서만 옮긴 사람은 적히지 않는다', async () => {
    // 박민수가 기획부에서 홍보부로. 부원은 부원이다.
    await put({ ...SEED, 'D-01.members': '', 'D-02.members': 'M-13' })
    expect(await db.select().from(permissionChanges)).toHaveLength(0)
  })
})

describe('받을 수 없는 배치', () => {
  // **회장이 없는 학생회가 생기지 않게 한다.** 조직 구조를 고치는 것은 회장단뿐이라,
  // 자기 자신을 빼면 다음 순간 아무도 이 화면을 못 여는 학생회가 될 수 있다.
  // 다른 회장이 빼야 한다.
  it('자기 자신을 회장단에서 빼지 못한다', async () => {
    const before = await readBack()
    const res = await put({ ...SEED, executives: 'M-02', unassigned: 'M-99\nM-01' })
    expect(res.status).toBe(422)
    expect(await readBack()).toEqual(before)
  })

  it('이 학생회에 없는 사람은 받지 않는다', async () => {
    expect((await put({ ...SEED, unassigned: 'M-99\nM-없음' })).status).toBe(422)
    // 옆 학생회의 사람도 마찬가지다 — 남의 사람을 우리 조직도에 끌어오지 못한다.
    expect((await put({ ...SEED, unassigned: 'M-99\nM-X' })).status).toBe(422)
    const rows = await db.select({ orgId: members.orgId }).from(members)
    expect(rows.filter((row) => row.orgId === 'ORG-02')).toHaveLength(1)
  })

  it('이 학생회에 없는 부서는 받지 않는다', async () => {
    expect((await put({ ...SEED, 'D-없음.members': 'M-99', unassigned: '' })).status).toBe(422)
    expect((await put({ ...SEED, 'D-X.members': 'M-99', unassigned: '' })).status).toBe(422)
  })

  // 한 사람은 한 자리다. 미배정이면서 부서에 있을 수 없고, 두 부서에 있을 수 없다.
  it('한 사람이 두 자리에 오면 받지 않는다', async () => {
    expect((await put({ ...SEED, 'D-02.members': 'M-13' })).status).toBe(422)
    expect((await put({ ...SEED, 'D-02.leaders': 'M-99' })).status).toBe(422)
  })

  // **지우는 것은 이 자리의 일이 아니다.** 계약이 이 자리를 되돌릴 수 없는 것으로
  // 두지 않았고, 사람을 조직에서 없애는 것은 되돌릴 수 없다. 배치에서 빠진
  // 사람이 있으면 받지 않는다 — 조용히 남겨 두면 '전부를 보내 덮어쓴다'가 거짓이 된다.
  it('배치에 없는 구성원이 있으면 받지 않는다', async () => {
    const before = await readBack()
    expect((await put({ ...SEED, unassigned: '' })).status).toBe(422)
    expect(await readBack()).toEqual(before)
  })

  it('조직도의 모양이 아니면 받지 않는다', async () => {
    expect((await put([])).status).toBe(422)
    expect((await put('{이건 json이 아니다')).status).toBe(422)
    expect((await put({ ...SEED, 알수없는자리: 'M-99' })).status).toBe(422)
    expect((await put({ ...SEED, unassigned: 42 })).status).toBe(422)
  })

  // 검색어는 초안에 함께 실려 오지만 배치가 아니다. 있어도 없어도 같다.
  it('검색어는 배치가 아니다', async () => {
    const { memberQuery: _, ...without } = SEED
    void _
    expect((await put(without)).status).toBe(200)
    expect((await put({ ...SEED, memberQuery: '한겨울' })).status).toBe(200)
  })

  // 조직 구조 수정은 회장단만이다(권한 행렬 `org.structure`).
  it('회장단이 아니면 막는다', async () => {
    expect((await put(SEED, viewer('head', 'M-11'))).status).toBe(403)
    expect((await put(SEED, viewer('member', 'M-13'))).status).toBe(403)
  })
})
