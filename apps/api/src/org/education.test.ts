import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import Ajv from 'ajv'
import openapi from '../../../../specs/figma/vada-wireframe/openapi.json' with { type: 'json' }
import { createApp, type Deps } from '../app.ts'
import type { Db } from '../db/client.ts'
import { freshDb } from '../db/testing.ts'
import { educationColleges, educationSchools } from '../db/schema.ts'
import { inMemoryAttempts } from '../idempotency.ts'
import type { Viewer } from '../permissions.ts'
import { inMemoryCounter } from '../public/rate-limit.ts'
import { routeOf } from '../routes.ts'

// 학교의 편제를 고르는 세 자리(ONB-01 · ORG-01 · INV-01).
//
// 이 파일이 재는 것이 넷이다.
//
// 1. **씨앗이 옮김 파일에서 함께 든다.** 검사가 표를 만드는 SQL과 실서비스가 적용하는
//    옮김 파일이 같은 것이므로(scripts/build-schema-sql.mjs), 여기서 학교가 보이면
//    `npm run db:migrate`만 도는 실서비스에서도 보인다.
// 2. **너무 짧은 검색어는 찾지 않는다.** 최소 길이는 명세가 갖고 있다.
// 3. **울타리가 이음매마다 서 있다.** 남의 학교에서 온 단과대 id로 학과가 나오면 안 된다.
// 4. **아직 들어오는 사람에게 닫혀 있다.** 명세가 이 자리를 `member`로 적어 두었다.

let db: Db
let close: () => Promise<void>

const NOW = new Date('2026-09-01T10:00:00+09:00')

function viewer(): Viewer {
  return {
    userId: 'U-01',
    membership: {
      orgId: 'ORG-01',
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
    },
    attempts: inMemoryAttempts(),
    counter: inMemoryCounter(),
    invite: { linkBase: 'https://vada.app/join', now: () => NOW, newCode: () => 'CODE' },
    newId: () => 'X-01',
  }
  return createApp(deps)
}

/** 구성원으로 그 자리를 연다. 계약이 이 셋을 `member`로 적었다. */
const options = (url: string) => harness().request(url)

beforeAll(async () => {
  const fresh = await freshDb()
  db = fresh.db as unknown as Db
  close = fresh.close

  // **옆 학교를 하나 더 둔다.** 울타리를 재려면 넘어갈 담이 있어야 한다.
  await db.insert(educationSchools).values({ id: 'SCH-X', name: '옆에 있는 대학교' })
  await db.insert(educationColleges).values({
    id: 'COL-X',
    schoolId: 'SCH-X',
    name: '옆 단과대학',
  })
}, 60_000)

afterAll(async () => {
  await close()
})

describe('학교를 이름으로 찾는다', () => {
  // 옮김 파일이 넣은 그 학교다. 검사가 따로 넣지 않았다.
  it('옮김 파일이 넣은 학교가 검색된다', async () => {
    const res = await options('/api/education/schools?q=한양')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([{ value: 'SCH-HYU-ERICA', label: '한양대학교 ERICA' }])
  })

  // 명세가 `minLength: 2`를 적었고 화면은 그때까지 '학교명을 2자 이상 입력하세요'를
  // 그린다. 여기서 전국 목록을 통째로 답하면 화면이 그리는 말과 서버가 하는 일이 어긋난다.
  it('한 자로는 찾지 않는다', async () => {
    expect(await (await options('/api/education/schools?q=한')).json()).toEqual([])
    expect(await (await options('/api/education/schools')).json()).toEqual([])
  })

  it('없는 이름은 빈 목록이다 — 화면이 그릴 말을 명세가 갖고 있다', async () => {
    expect(await (await options('/api/education/schools?q=없는대학교')).json()).toEqual([])
  })
})

describe('단과대학과 학부·학과는 위에 걸려 있다', () => {
  it('그 학교의 단과대학만 준다', async () => {
    expect(await (await options('/api/education/colleges?schoolId=SCH-HYU-ERICA')).json()).toEqual(
      [{ value: 'COL-HYU-ERICA-SW', label: '소프트웨어융합대학' }],
    )
    expect(await (await options('/api/education/colleges?schoolId=SCH-X')).json()).toEqual([
      { value: 'COL-X', label: '옆 단과대학' },
    ])
  })

  it('학교를 고르지 않았으면 고를 것도 없다', async () => {
    expect(await (await options('/api/education/colleges?schoolId=')).json()).toEqual([])
  })

  it('그 단과대학의 학부·학과 셋을 준다', async () => {
    const rows = (await (
      await options(
        '/api/education/departments?schoolId=SCH-HYU-ERICA&collegeId=COL-HYU-ERICA-SW',
      )
    ).json()) as Array<{ value: string; label: string }>
    // 차례는 명세가 말하지 않는다. 무엇이 오는지만 잰다.
    expect(rows.map((row) => row.label).sort()).toEqual(
      ['ICT융합학부', '인공지능학과', '컴퓨터학부'].sort(),
    )
  })

  // **울타리를 이음매마다.** 단과대 id만 걸면 남의 학교에서 온 id가 그대로 통하고,
  // 그러면 이 목록은 '고른 학교의 학과'가 아니라 'id를 아는 사람이 볼 수 있는 학과'다.
  it('남의 학교의 단과대 id로는 학부·학과가 나오지 않는다', async () => {
    expect(
      await (
        await options('/api/education/departments?schoolId=SCH-X&collegeId=COL-HYU-ERICA-SW')
      ).json(),
    ).toEqual([])
  })
})

describe('아직 들어오는 사람에게 닫혀 있다', () => {
  // **명세가 이 셋의 `authorize.area`를 `member`로 적어 두었다.** 그런데 이것을 부르는
  // 화면(ONB-01 · ORG-01 · INV-01)의 viewer는 `joining`이다 — 아직 어느 학생회의
  // 구성원도 아닌 사람이 학교를 고르는 자리다. 그래서 지금은 403이 난다.
  //
  // **여기서 뚫지 않는다.** 고칠 자리는 `option-sources.json`의 그 한 줄(→ `signedIn`)이고
  // 그것은 `specs/` 안이다. 이 검사는 그 어긋남이 잊히지 않게 붙잡아 둔다 — 명세가
  // 고쳐지면 이 검사가 붉어지고, 그때 지우면 된다.
  it('구성원이 아니면 학교 목록이 열리지 않는다', async () => {
    const res = await harness({ userId: 'U-99', membership: null }).request(
      '/api/education/schools?q=한양',
    )
    expect(res.status).toBe(403)
  })

  it('로그인하지 않았으면 막는다', async () => {
    expect((await harness(null).request('/api/education/schools?q=한양')).status).toBe(401)
  })
})

describe('답이 계약의 모양을 지킨다', () => {
  const ajv = new Ajv({ strict: false })

  const cases: Array<[string, string]> = [
    ['education.schools.options', '/api/education/schools?q=한양'],
    ['education.colleges.options', '/api/education/colleges?schoolId=SCH-HYU-ERICA'],
    [
      'education.departments.options',
      '/api/education/departments?schoolId=SCH-HYU-ERICA&collegeId=COL-HYU-ERICA-SW',
    ],
  ]

  for (const [operationId, url] of cases) {
    it(`${operationId}의 답이 계약대로다`, async () => {
      const at = routeOf(operationId)!
      const paths = openapi.paths as unknown as Record<string, Record<string, unknown>>
      const operation = paths[at.path]![at.method] as {
        responses: { 200: { content: { 'application/json': { schema: object } } } }
      }
      const validate = ajv.compile(operation.responses[200].content['application/json'].schema)
      const body = await (await options(url)).json()
      expect(validate(body), JSON.stringify(validate.errors)).toBe(true)
    })
  }
})
