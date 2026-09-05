import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import Ajv from 'ajv'
import { asc, eq } from 'drizzle-orm'
import openapi from '../../../../specs/figma/vada-wireframe/openapi.json' with { type: 'json' }
import { createApp, type Deps } from '../app.ts'
import type { AuditEntry } from '../audit.ts'
import type { Db } from '../db/client.ts'
import { freshDb } from '../db/testing.ts'
import {
  departments,
  educationColleges,
  educationSchools,
  invites,
  members,
  organizations,
  users,
} from '../db/schema.ts'
import { inMemoryAttempts, type Attempts } from '../idempotency.ts'
import type { Viewer } from '../permissions.ts'
import { inMemoryCounter } from '../public/rate-limit.ts'
import { routeOf } from '../routes.ts'

// 들어오는 길(ONB-01 → ONB-02 → ORG-01 · ORG-02 또는 INV-00 · INV-01).
//
// 이 파일이 재는 것이 다섯이다.
//
// 1. **만든 사람이 회장이 된다.** 아니면 만들자마자 자기 학생회를 못 본다.
// 2. **두 번 눌러도 하나다.** 계약이 이 자리에 멱등 키를 요구하는데, 만드는 사람은
//    아직 아무 학생회에도 없어서 시도를 담을 칸이 없었다.
// 3. **읽지 못한 값을 조용히 대신하지 않는다.** 명세에 없는 유형, 남의 학교의 단과대,
//    이름이 겹치는 부서 — 전부 되돌린다.
// 4. **초대 코드는 열쇠다.** 없는 코드와 꺼진 코드를 가르지 않고, 마구 넣어 보면 막힌다.
// 5. **초대장의 넷은 완성된 글이다.** 표에는 값이 들어 있고 말은 서버가 만든다.

let db: Db
let close: () => Promise<void>
let made = 0

const NOW = new Date('2026-09-01T10:00:00+09:00')

/** 아직 어느 학생회의 것도 아닌 사람. 이 흐름의 주인공이다. */
function joining(userId = 'U-01'): Viewer {
  return { userId, membership: null }
}

function harness(
  who: Viewer | null = joining(),
  attempts: Attempts = inMemoryAttempts(),
  written: AuditEntry[] = [],
) {
  const deps: Deps = {
    // 검사는 밖으로 나가지 않는다. 열려 있다고만 답하고, 부르면 어디로 갈지 말해 준다.
    signIn: {
      open: () => ({ google: true, kakao: false }),
      start: async (provider: string) => ({ url: `https://example.test/${provider}` }),
    },
    audit: {
      async write(entry) {
        written.push(entry)
      },
    },
    db,
    who: async () => who,
    lookups: {
      isEventStaff: async () => false,
      isEventStaffManager: async () => false,
      isMeetingHost: async () => false,
      isMeetingCreator: async () => false,
    },
    attempts,
    counter: inMemoryCounter(),
    invite: { linkBase: 'https://vada.app/join', now: () => NOW, newCode: () => 'CODE' },
    newId: () => {
      made += 1
      return `N-${made}`
    },
  }
  return createApp(deps)
}

/** ORG-01과 ORG-02가 함께 채운 `orgCreationDraft`. */
const DRAFT = {
  orgType: 'college',
  repSchool: 'SCH-HYU-ERICA',
  repCollege: 'COL-HYU-ERICA-SW',
  orgName: '제12대 소프트웨어융합대학 학생회',
  operatingYear: '2026',
  setupMode: 'basic',
  departments: [{ name: '기획부' }, { name: '홍보부' }, { name: '디자인부' }],
}

function create(
  app: ReturnType<typeof harness>,
  over: Record<string, unknown> = {},
  key: string | null = 'KEY-01',
) {
  return app.request('/api/orgs', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(key === null ? {} : { 'Idempotency-Key': key }),
    },
    body: JSON.stringify({ ...DRAFT, ...over }),
  })
}

/** INV-00이 보내는 `onboardingDraft`. 일곱을 계약이 전부 필수로 적었다. */
const ONBOARDING = {
  inviteCode: 'AB12CD34',
  school: 'SCH-HYU-ERICA',
  college: 'COL-HYU-ERICA-SW',
  department: 'DEP-HYU-ERICA-SW-CS',
  currentGrade: '3',
  studentNumber: '2022123456',
  name: '김바다',
}

function verify(app: ReturnType<typeof harness>, over: Record<string, unknown> = {}) {
  return app.request('/api/organizations/invite-code/verify', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ...ONBOARDING, ...over }),
  })
}

const message = async (res: Response) => ((await res.json()) as { message: string }).message

beforeAll(async () => {
  const fresh = await freshDb()
  db = fresh.db as unknown as Db
  close = fresh.close

  // 넘어갈 담 하나. 남의 학교의 단과대가 붙지 않는지 재는 데 쓴다.
  await db.insert(educationSchools).values({ id: 'SCH-X', name: '옆에 있는 대학교' })
  await db.insert(educationColleges).values({ id: 'COL-X', schoolId: 'SCH-X', name: '옆 단과대학' })
}, 60_000)

beforeEach(async () => {
  made = 0
  await db.delete(members)
  await db.delete(departments)
  await db.delete(invites)
  await db.delete(organizations)
  await db.delete(users)
  await db.insert(users).values([
    { id: 'U-01', email: 'bada@example.com', name: '김바다' },
    // 소셜 로그인이 이름을 주지 않은 계정. 지어내서 채우지 않는지 잰다.
    { id: 'U-02', email: 'noname@example.com' },
  ])
})

afterAll(async () => {
  await close()
})

describe('학생회를 만든다(ORG-01 · ORG-02)', () => {
  it('만든 사람이 그 학생회의 회장이 된다', async () => {
    const res = await create(harness())
    expect(res.status).toBe(200)
    // 계약이 돌려주는 값을 두지 않았다.
    expect(await res.json()).toEqual({})

    const org = (await db.select().from(organizations))[0]!
    expect(org.name).toBe('제12대 소프트웨어융합대학 학생회')
    // **딱지가 아니라 값을 담는다.** 말은 읽을 때 만든다.
    expect(org.kind).toBe('college')
    expect(org.term).toBe('2026')
    expect(org.repSchoolId).toBe('SCH-HYU-ERICA')
    expect(org.repCollegeId).toBe('COL-HYU-ERICA-SW')

    const chair = (await db.select().from(members))[0]!
    expect(chair.orgId).toBe(org.id)
    // 이 줄이 없으면 만든 사람이 자기 학생회를 못 본다.
    expect(chair.userId).toBe('U-01')
    expect(chair.role).toBe('chair')
    expect(chair.executiveTitle).toBe('회장')
    // 학적 정보는 이 자리로 넘어오지 않는다. 지어내서 채우지 않는다.
    expect(chair.studentNumber).toBe(null)
    expect(chair.major).toBe(null)
  })

  // **초대가 함께 생긴다.**
  //
  // 한동안 안 생겼다. 그러면 아무도 그 학생회에 못 들어오고, 조직도 화면(ORG-03C)이
  // 초대를 읽다 통째로 죽는다 — 다시 만드는 단추가 그 죽은 화면 안에 있으므로 스스로
  // 빠져나올 길도 없었다. 배포 모양으로 걷는 카나리가 찾았다(2026-09-05).
  it('학생회가 생기면 들어올 초대도 함께 생긴다', async () => {
    await create(harness())
    const org = (await db.select().from(organizations))[0]!
    const rows = await db.select().from(invites).where(eq(invites.orgId, org.id))
    expect(rows).toHaveLength(1)
    expect(rows[0]!.active).toBe(true)
    // 처음 만든 것이지 다시 만든 것이 아니다.
    expect(rows[0]!.regeneratedAt).toBe(null)
  })

  it('사람이 늘어놓은 부서 차례를 지킨다', async () => {
    await create(harness())
    const rows = await db.select().from(departments).orderBy(asc(departments.sortOrder))
    expect(rows.map((row) => row.name)).toEqual(['기획부', '홍보부', '디자인부'])
    expect(rows.map((row) => row.sortOrder)).toEqual([0, 1, 2])
  })

  it("'빈 조직'으로 시작하면 부서가 없다", async () => {
    await create(harness(), { setupMode: 'empty', departments: [] })
    expect(await db.select().from(departments)).toHaveLength(0)
    // 회장은 그래도 생긴다 — 부서가 없는 것과 사람이 없는 것은 다른 일이다.
    expect(await db.select().from(members)).toHaveLength(1)
  })

  // **두 번 눌리면 학생회가 둘 생긴다.** 계약이 이 자리에 멱등 키를 요구하는데,
  // 만드는 사람은 아직 아무 학생회에도 없어서 시도를 담을 칸이 없었다.
  it('같은 키로 두 번 보내도 학생회는 하나다', async () => {
    const attempts = inMemoryAttempts()
    const app = harness(joining(), attempts)
    expect((await create(app)).status).toBe(200)
    expect((await create(app)).status).toBe(200)
    expect(await db.select().from(organizations)).toHaveLength(1)
    expect(await db.select().from(members)).toHaveLength(1)
  })

  it('멱등 키가 없으면 막는다 — 계약이 요구한다', async () => {
    const res = await create(harness(), {}, null)
    expect(res.status).toBe(422)
    expect(await db.select().from(organizations)).toHaveLength(0)
  })

  it('명세에 없는 유형·연도·방식은 막는다', async () => {
    expect((await create(harness(), { orgType: '단과대' })).status).toBe(422)
    expect((await create(harness(), { operatingYear: '1999' })).status).toBe(422)
    expect((await create(harness(), { setupMode: 'whatever' })).status).toBe(422)
    expect(await db.select().from(organizations)).toHaveLength(0)
  })

  it('학생회명이 비면 막는다', async () => {
    expect((await create(harness(), { orgName: '  ' })).status).toBe(422)
  })

  // **울타리를 이음매마다.** 둘을 따로 확인하면 한양대 아래에 옆 학교의 단과대가 붙고,
  // 초대장이 있지도 않은 범위를 대표한다고 말한다.
  it('남의 학교의 단과대학은 대표 범위가 되지 못한다', async () => {
    const res = await create(harness(), { repSchool: 'SCH-X', repCollege: 'COL-HYU-ERICA-SW' })
    expect(res.status).toBe(422)
    expect(await db.select().from(organizations)).toHaveLength(0)
  })

  it('없는 학교는 막는다', async () => {
    expect((await create(harness(), { repSchool: 'SCH-없음' })).status).toBe(422)
  })

  // 표가 `(orgId, name)`을 유일하게 지킨다. 그냥 넣으면 500이 되고, 조용히 하나로
  // 합치면 사람은 둘을 만들었다고 믿는다.
  it('이름이 겹치는 부서는 막는다', async () => {
    const res = await create(harness(), {
      departments: [{ name: '기획부' }, { name: '기획부' }],
    })
    expect(res.status).toBe(422)
    expect(await message(res)).toContain('겹칩니다')
  })

  it('부서는 열까지다 — ORG-02가 그렇게 그렸다', async () => {
    const eleven = Array.from({ length: 11 }, (_, at) => ({ name: `부서${at}` }))
    expect((await create(harness(), { departments: eleven })).status).toBe(422)
  })

  // 계약이 '객체의 목록'이라 적었다. 다른 꼴을 함께 받아 주면 어느 쪽이 계약인지
  // 아무도 모르게 된다.
  it('부서 카드가 { name } 꼴이 아니면 막는다', async () => {
    expect((await create(harness(), { departments: ['기획부'] })).status).toBe(422)
    expect((await create(harness(), { departments: [{ title: '기획부' }] })).status).toBe(422)
    expect((await create(harness(), { departments: '기획부' })).status).toBe(422)
  })

  // 이메일이나 빈 글을 넣으면 그것이 조직도에 사람 이름으로 그려진다.
  it('계정에 이름이 없으면 회장을 만들 수 없다', async () => {
    const res = await create(harness(joining('U-02')))
    expect(res.status).toBe(422)
    expect(await db.select().from(organizations)).toHaveLength(0)
  })

  it('로그인하지 않으면 막는다', async () => {
    expect((await create(harness(null))).status).toBe(401)
  })

  // **만든 사람에게 아직 소속이 없다.** 기록 층은 보낸 사람의 소속에서 학생회를
  // 채우는데 이 자리에는 그것이 없어서, 손대지 않으면 '학생회가 언제 생겼나'가
  // 기록에서 사라진다.
  it('만든 기록에 누구의 것이고 어느 학생회인지 남는다', async () => {
    const written: AuditEntry[] = []
    await create(harness(joining(), inMemoryAttempts(), written))
    const org = (await db.select().from(organizations))[0]!
    expect(written).toHaveLength(1)
    expect(written[0]!.userId).toBe('U-01')
    expect(written[0]!.orgId).toBe(org.id)
    expect(written[0]!.subjectType).toBe('user')
    expect(written[0]!.failed).toBe(false)
  })
})

/** 초대 코드 하나를 가진 학생회. INV-00·INV-01이 읽는 것. */
async function invitedOrg(code = 'AB12CD34', active = true) {
  await db.insert(organizations).values({
    id: 'ORG-INV',
    name: '제12대 소프트웨어융합대학 학생회',
    kind: 'college',
    term: '2026',
    repSchoolId: 'SCH-HYU-ERICA',
    repCollegeId: 'COL-HYU-ERICA-SW',
  })
  await db.insert(invites).values({ code, orgId: 'ORG-INV', active, createdAt: NOW })
}

describe('초대 코드를 확인한다(INV-00)', () => {
  it('쓸 수 있는 코드면 통과한다', async () => {
    await invitedOrg()
    const res = await verify(harness())
    expect(res.status).toBe(200)
    // 계약이 돌려주는 값을 두지 않았다.
    expect(await res.json()).toEqual({})
    // **묻기만 하고 아무것도 바꾸지 않는다.** 들어가는 자리는 명세에 없다.
    expect(await db.select().from(members)).toHaveLength(0)
  })

  // 둘을 다르게 답하면 그 답으로 어떤 코드가 있었는지를 알아낼 수 있다.
  it('없는 코드와 꺼진 코드가 같은 답이다', async () => {
    await invitedOrg('OFF12345', false)
    const off = await verify(harness(), { inviteCode: 'OFF12345' })
    const none = await verify(harness(), { inviteCode: 'NOTHERE1' })
    expect(off.status).toBe(422)
    expect(none.status).toBe(422)
    expect(await message(off)).toBe(await message(none))
  })

  // 두 번 들어갈 수 없는 것은 **같은 학생회**다 — 한 사람이 여러 학생회에 속할 수 있다.
  it('이미 그 학생회의 구성원이면 막는다', async () => {
    await invitedOrg()
    await db.insert(members).values({
      id: 'M-01',
      orgId: 'ORG-INV',
      userId: 'U-01',
      name: '김바다',
    })
    expect((await verify(harness())).status).toBe(422)
    // 다른 사람은 그대로 들어올 수 있다.
    expect((await verify(harness(joining('U-02')))).status).toBe(200)
  })

  it('있지도 않은 학부·학과는 막는다', async () => {
    await invitedOrg()
    expect((await verify(harness(), { department: 'DEP-없음' })).status).toBe(422)
    // 남의 학교에서 온 단과대 id로도 통하지 않는다.
    expect((await verify(harness(), { school: 'SCH-X' })).status).toBe(422)
  })

  it('계약이 필수라 적은 칸이 비면 막는다', async () => {
    await invitedOrg()
    expect((await verify(harness(), { studentNumber: '' })).status).toBe(422)
    expect((await verify(harness(), { name: '   ' })).status).toBe(422)
    // 학년은 명세가 든 여섯뿐이다.
    expect((await verify(harness(), { currentGrade: '7' })).status).toBe(422)
  })

  it('로그인하지 않으면 막는다', async () => {
    expect((await verify(harness(null))).status).toBe(401)
  })
})

describe('초대 코드가 찾아낸 학생회(INV-01)', () => {
  const card = (app: ReturnType<typeof harness>, code = 'AB12CD34') =>
    app.request(`/api/organizations/by-invite-code/${code}`)

  it('넷 다 완성된 글로 답한다', async () => {
    await invitedOrg()
    const res = await card(harness())
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      name: '제12대 소프트웨어융합대학 학생회',
      // 표에는 'college'와 '2026'이 들어 있다. 말은 여기서 만든다.
      kind: '단과대 학생회',
      scope: '한양대학교 ERICA · 소프트웨어융합대학',
      term: '2026년',
    })
  })

  // **없다고 말한다.** 빈 글을 주면 화면은 아무것도 없는 카드를 그리고, 사람은
  // '유형' 옆이 왜 비었는지 알 수 없다.
  it('대표 범위를 모르는 학생회에는 모른다고 답한다', async () => {
    await db.insert(organizations).values({ id: 'ORG-OLD', name: '옛 학생회' })
    await db.insert(invites).values({ code: 'OLD12345', orgId: 'ORG-OLD', createdAt: NOW })
    expect(await (await card(harness(), 'OLD12345')).json()).toEqual({
      name: '옛 학생회',
      kind: '유형 미등록',
      scope: '대표 범위 미등록',
      term: '운영 연도 미등록',
    })
  })

  it('없는 코드와 꺼진 코드는 둘 다 404다', async () => {
    await invitedOrg('OFF12345', false)
    expect((await card(harness(), 'OFF12345')).status).toBe(404)
    expect((await card(harness(), 'NOTHERE1')).status).toBe(404)
  })

  it('로그인하지 않으면 막는다', async () => {
    await invitedOrg()
    expect((await card(harness(null))).status).toBe(401)
  })

  // **코드는 학생회에 들어오는 열쇠다.** 로그인은 '누가 두드리는지'만 정하고 코드를
  // 못 맞히게 하지는 않는다. 계약이 이 인자에 `x-secret`을 달아 두었고, 속도 세기가
  // 그 표시를 보고 이 자리를 함께 막는다.
  it('코드를 마구 넣어 보면 막힌다', async () => {
    const app = harness()
    let last = 0
    for (let tried = 0; tried < 60; tried += 1) {
      last = (await card(app, `NOPE${tried}`)).status
      if (last === 429) break
    }
    expect(last).toBe(429)
  })

  it('답이 계약의 모양을 지킨다', async () => {
    await invitedOrg()
    const at = routeOf('org.invitedOrganization')!
    const paths = openapi.paths as unknown as Record<string, Record<string, unknown>>
    const operation = paths[at.path]![at.method] as {
      responses: { 200: { content: { 'application/json': { schema: object } } } }
    }
    const validate = new Ajv({ strict: false }).compile(
      operation.responses[200].content['application/json'].schema,
    )
    const body = await (await card(harness())).json()
    expect(validate(body), JSON.stringify(validate.errors)).toBe(true)
  })
})

describe('만든 뒤에는 그 학생회가 보인다', () => {
  // **고리를 닫는다.** 만드는 쪽만 재면 '만들어졌다'까지만 알 수 있고, 만든 사람이
  // 자기 학생회를 여는지는 모른다 — 그것이 이 자리의 목적이다.
  it('만든 사람의 소속으로 셸이 열린다', async () => {
    await create(harness())
    const org = (await db.select().from(organizations))[0]!
    const chair = (await db.select().from(members).where(eq(members.orgId, org.id)))[0]!
    const app = harness({
      userId: 'U-01',
      membership: {
        orgId: org.id,
        memberId: chair.id,
        role: 'chair',
        departmentId: null,
        inFinanceDepartment: false,
      },
    })
    expect(await (await app.request('/api/shell/organization')).json()).toEqual({
      name: '제12대 소프트웨어융합대학 학생회',
    })
    // 아직 부서에 들지 않았으므로 역할만 온다. '회장단'은 `org.baseRoles`의 딱지다.
    expect(await (await app.request('/api/shell/viewer')).json()).toEqual({
      name: '김바다',
      role: '회장단',
    })
  })
})
