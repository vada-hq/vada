import { beforeAll, afterAll, describe, expect, it } from 'vitest'
import Ajv from 'ajv'
import openapi from '../../../specs/figma/vada-wireframe/openapi.json' with { type: 'json' }
import { createApp, type Deps } from './app.ts'
import { maskSecrets, type AuditEntry } from './audit.ts'
import type { Db } from './db/client.ts'
import { freshDb } from './db/testing.ts'
import { departments, members, organizations } from './db/schema.ts'
import { allOperationIds, answeredOperationIds, routeOf } from './routes.ts'
import { inMemoryCounter } from './public/rate-limit.ts'
import { inMemoryAttempts } from './idempotency.ts'
import type { Viewer } from './permissions.ts'

// 서버가 명세대로 답하는가, 그리고 **명세 밖으로 새지 않는가.**

let db: Db
let close: () => Promise<void>

const NO_LOOKUPS = {
  isEventStaff: async () => false,
  isEventStaffManager: async () => false,
  isMeetingHost: async () => false,
  isMeetingCreator: async () => false,
  isMeetingParticipant: async () => false,
}

function viewer(role: 'chair' | 'head' | 'member' = 'member'): Viewer {
  return {
    userId: 'U-01',
    membership: {
      orgId: 'ORG-01',
      memberId: 'M-03',
      role,
      departmentId: 'D-01',
      inFinanceDepartment: false,
    },
  }
}

function harness(who: Viewer | null = viewer(), over: Partial<Deps> = {}) {
  const written: AuditEntry[] = []
  const deps: Deps = {
    audit: {
      async write(entry) {
        written.push(entry)
      },
    },
    db,
    who: async () => who,
    lookups: NO_LOOKUPS,
    // 검사는 밖으로 나가지 않는다. 열려 있다고만 답하고, 부르면 어디로 갈지 말해 준다.
    signIn: {
      open: () => ({ google: true, kakao: false }),
      start: async (provider: string) => ({ url: `https://example.test/${provider}` }),
    },
    attempts: inMemoryAttempts(),
    counter: inMemoryCounter(),
    invite: {
      linkBase: 'https://vada.app/join',
      now: () => new Date('2026-07-22T18:30:00+09:00'),
      newCode: () => 'AB12CD34',
    },
    newId: () => 'E-01',
    ...over,
  }
  return { app: createApp(deps), written }
}

beforeAll(async () => {
  const fresh = await freshDb()
  db = fresh.db as unknown as Db
  close = fresh.close
  await db.insert(organizations).values({ id: 'ORG-01', name: '제12대 소프트웨어융합대학 학생회' })
  await db.insert(departments).values({ id: 'D-01', orgId: 'ORG-01', name: '운영부' })
  await db.insert(members).values([
    { id: 'M-03', orgId: 'ORG-01', userId: null, name: '박해랑', role: 'member', departmentId: 'D-01' },
    { id: 'M-01', orgId: 'ORG-01', userId: null, name: '김바다', role: 'chair', departmentId: 'D-01' },
  ])
  // 로그인한 사람과 구성원을 잇는다. users 표가 Better Auth의 것이라 따로 넣는다.
  await db.execute(`insert into users (id, email) values ('U-01', 'a@b.c')`)
  await db.execute(`update members set user_id = 'U-01' where id = 'M-03'`)
}, 60_000)

afterAll(async () => {
  await close()
})

/** 계약이 그 자리의 성공 응답에 대해 말한 모양. */
function successSchema(operationId: string) {
  const at = routeOf(operationId)!
  const paths = openapi.paths as unknown as Record<string, Record<string, unknown>>
  const operation = paths[at.path]![at.method] as {
    responses: { 200: { content: { 'application/json': { schema: object } } } }
  }
  return operation.responses[200].content['application/json'].schema
}

describe('셸이 읽는 두 자리', () => {
  it('학생회 이름을 명세가 적은 조각으로 답한다', async () => {
    const res = await harness().app.request('/api/shell/organization')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ name: '제12대 소프트웨어융합대학 학생회' })
  })

  // **서버가 완성해서 준다.** '운영부 · 부원'을 화면이 이어 붙이면 역할 이름의
  // 규칙이 화면에 박힌다.
  it('보는 사람의 역할을 이어 붙인 글로 답한다', async () => {
    const res = await harness().app.request('/api/shell/viewer')
    expect(await res.json()).toEqual({ name: '박해랑', role: '운영부 · 부원' })
  })

  it('로그인하지 않았으면 막는다', async () => {
    const res = await harness(null).app.request('/api/shell/organization')
    expect(res.status).toBe(401)
  })

  // 구성원이 아닌 사람은 그 학생회의 것을 볼 수 없다.
  it('구성원이 아니면 막는다', async () => {
    const res = await harness({ userId: 'U-99', membership: null }).app.request(
      '/api/shell/organization',
    )
    expect(res.status).toBe(403)
  })
})

describe('역할 및 권한(ORG-04 · ORG-04B)', () => {
  it('역할마다 몇인지 답한다', async () => {
    const res = await harness().app.request('/api/org/role-counts')
    expect(await res.json()).toEqual({ chairCount: 1, headCount: 0, memberCount: 1 })
  })

  it('권한 표 열세 줄을 답한다', async () => {
    const res = await harness().app.request('/api/org/permission-matrix')
    const rows = (await res.json()) as unknown[]
    expect(rows).toHaveLength(13)
  })

  it('구성원마다의 역할을 완성된 말로 답한다', async () => {
    const res = await harness().app.request('/api/org/role-assignments')
    const rows = (await res.json()) as Array<{ name: string; roleLabel: string }>
    expect(rows.map((row) => row.roleLabel)).toEqual(['회장단', '부원'])
  })

  it('목록 곁의 한 줄도 서버가 만든다', async () => {
    const res = await harness().app.request('/api/org/role-assignments/count')
    expect(await res.json()).toEqual({ total: '2명' })
  })
})

// **답의 모양이 계약과 같은가.** 자리마다 손으로 zod를 쓰는 대신 여기서 견준다 —
// 손으로 쓰면 그것이 명세를 두 번 적는 일이고, 두 벌은 갈린다.
describe('답이 계약의 모양을 지킨다', () => {
  const ajv = new Ajv({ strict: false })

  const cases: Array<[string, string]> = [
    ['shell.organization', '/api/shell/organization'],
    ['shell.viewer', '/api/shell/viewer'],
    ['org.roleCounts', '/api/org/role-counts'],
    ['org.permissionMatrix', '/api/org/permission-matrix'],
    ['org.roleAssignments', '/api/org/role-assignments'],
    ['org.roleAssignmentCount', '/api/org/role-assignments/count'],
  ]

  for (const [operationId, url] of cases) {
    it(`${operationId}의 답이 계약대로다`, async () => {
      const res = await harness().app.request(url)
      const body = await res.json()
      const validate = ajv.compile(successSchema(operationId))
      expect(validate(body), JSON.stringify(validate.errors)).toBe(true)
    })
  }
})

describe('누가 무엇을 만졌는지 남는다', () => {
  it('읽기도 남긴다 — 법이 말하는 처리에 조회가 든다', async () => {
    const { app, written } = harness()
    await app.request('/api/org/role-assignments')
    expect(written).toHaveLength(1)
    expect(written[0]!.action).toContain('/api/org/role-assignments')
    // **누가 보냈는지가 남는다.** 한동안 이 자리가 null이었고 검사가 그것을
    // 승인하고 있었다 — 기준이 요구하는 식별자가 빈 기록은 기록이 아니다.
    expect(written[0]!.userId).toBe('U-01')
    expect(written[0]!.orgId).toBe('ORG-01')
    expect(written[0]!.subjectType).toBe('organization')
    expect(written[0]!.failed).toBe(false)
  })

  // 막힌 요청이 오히려 봐야 할 것이다.
  it('막힌 요청도 남고 실패로 표시된다', async () => {
    const { app, written } = harness(null)
    const res = await app.request('/api/org/role-counts')
    expect(res.status).toBe(401)
    expect(written).toHaveLength(1)
    // **막힌 것도 실패다.** 터진 것만 실패로 세었더니 401·403·404가 전부
    // '성공'으로 남았다.
    expect(written[0]!.failed).toBe(true)
  })

  // 구성원이 아니어도 누구인지는 남는다 — 학생회를 만들려는 사람도 사람이다.
  it('구성원이 아닌 사람도 누구인지 남는다', async () => {
    const { app, written } = harness({ userId: 'U-99', membership: null })
    await app.request('/api/org/role-counts')
    expect(written[0]!.userId).toBe('U-99')
    expect(written[0]!.orgId).toBe(null)
    expect(written[0]!.failed).toBe(true)
  })

  it('밖에서 열리는 자리의 주소에서 토큰을 지운다', () => {
    expect(maskSecrets('POST', '/api/public/attendance/T-01/check-in')).toBe(
      '/api/public/attendance/*/check-in',
    )
  })

  // **지우는 자리를 계약이 정한다.** 자리 규칙으로 지우던 동안 이 셋이 틀렸다.
  it('정적 경로 이름은 지우지 않는다', () => {
    // 넷째 자리가 토큰이 아니라 자리 이름이다. 지우면 기록이 '무엇을 했는가'를
    // 말하지 못한다 — 그러면 접속 기록이 아니다.
    expect(maskSecrets('GET', '/api/public/attendance/check-in-form')).toBe(
      '/api/public/attendance/check-in-form',
    )
  })

  it('열쇠가 홀수 자리에 있어도 지운다', () => {
    // `{surveyToken}`이 다섯째다. 한 칸 걸러 세던 규칙은 이 자리를 그냥 지나갔다.
    expect(maskSecrets('POST', '/api/public/surveys/S-01/applications')).toBe(
      '/api/public/surveys/*/applications',
    )
  })

  it('밖이 아닌 자리의 초대 코드도 지운다', () => {
    // 학생회에 들어오는 열쇠다. `/api/public/` 밖이라 한동안 원문으로 남았다.
    expect(maskSecrets('GET', '/api/organizations/by-invite-code/ABCD1234')).toBe(
      '/api/organizations/by-invite-code/*',
    )
  })

  it('열쇠가 없는 자리는 그대로 남긴다', () => {
    expect(maskSecrets('GET', '/api/org/role-counts')).toBe('/api/org/role-counts')
  })

  // 계약이 모르는 자리에 진짜 열쇠가 실려 올 수 있다. 모르면 남기지 않는 쪽으로 기운다.
  it('계약이 모르는 밖의 자리는 통째로 지운다', () => {
    expect(maskSecrets('GET', '/api/public/surveys/오타/AAAA')).toBe('/api/public/*')
    expect(maskSecrets('GET', '/api/이런자리는없다')).toBe('/api/이런자리는없다')
  })
})

describe('명세 밖으로 새지 않는다', () => {
  it('계약에 없는 자리는 막는다', async () => {
    const res = await harness().app.request('/api/이런자리는없다')
    expect(res.status).toBe(403)
  })

  // 얼마나 남았는지를 검사가 센다. 손으로 세면 언젠가 틀리고, 틀린 수는
  // '거의 다 됐다'로 읽힌다.
  it('아직 답하지 않는 자리가 몇인지 센다', () => {
    // **찔러 보지 않고 센다.** 한동안 자리마다 불러 보고 403·404가 아니면 답한
    // 것으로 세었는데, 진짜로 404를 내는 자리(없는 구성원을 물었을 때)와 아직
    // 안 만든 자리가 같은 모양이라 **만든 것을 안 만든 것으로 세고 있었다.**
    harness()
    const answered = answeredOperationIds().length
    const all = allOperationIds().length
    // eslint-disable-next-line no-console
    console.log(`
  계약 ${all}자리 중 답하는 것 ${answered}개 · 남은 것 ${all - answered}개
`)
    // **래칫이다.** 정확한 수를 박아 두면 자리를 하나 열 때마다 이 줄을 고쳐야 하고,
    // 영역 둘을 나란히 열면 **이 한 줄에서 부딪힌다** — 답을 영역별로 가른 뜻이
    // 여기서 무너진다. 지키려는 것은 '지금 몇인가'가 아니라 '줄지 않는가'다.
    //
    // **바닥은 지금 값이다.** 한동안 52로 두었는데 그 사이 83이 되었고, 그러면
    // 서른한 자리를 되돌려도 이 검사가 조용하다 — 래칫이 아니라 기록이 된다.
    // 흐름을 붙일 때마다 이 수를 올리는 것이 그 흐름을 끝내는 일의 일부다.
    //
    // 교차검토가 짚었다(2026-09-05): '녹색'과 '지금 상태를 정확히 안다'가 갈려
    // 있었다.
    expect(answered).toBeGreaterThanOrEqual(207)
    expect(all).toBe(219)
  })
})
