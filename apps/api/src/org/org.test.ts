import { beforeAll, afterAll, beforeEach, describe, expect, it } from 'vitest'
import Ajv from 'ajv'
import openapi from '../../../../specs/figma/vada-wireframe/openapi.json' with { type: 'json' }
import { createApp, type Deps } from '../app.ts'
import type { Db } from '../db/client.ts'
import { freshDb } from '../db/testing.ts'
import { departments, invites, members, organizations } from '../db/schema.ts'
import { inMemoryAttempts } from '../idempotency.ts'
import { routeOf } from '../routes.ts'
import type { AuditEntry } from '../audit.ts'
import type { Viewer } from '../permissions.ts'

// 조직 관리 영역이 실제로 도는가. **읽기 여섯과 쓰기 셋**이 한 화면 묶음이다.

let db: Db
let close: () => Promise<void>
let codes = 1

function viewer(role: 'chair' | 'head' | 'member'): Viewer {
  return {
    userId: 'U-01',
    membership: {
      orgId: 'ORG-01',
      memberId: 'M-01',
      role,
      departmentId: 'D-01',
      inFinanceDepartment: false,
    },
  }
}

function harness(who: Viewer | null = viewer('chair')) {
  const written: AuditEntry[] = []
  const deps: Deps = {
    audit: {
      async write(entry) {
        written.push(entry)
      },
    },
    db,
    who: () => who,
    lookups: {
      isEventStaff: async () => false,
      isEventStaffManager: async () => false,
      isMeetingHost: async () => false,
      isMeetingCreator: async () => false,
    },
    attempts: inMemoryAttempts(),
    invite: {
      linkBase: 'https://vada.app/join',
      now: () => new Date('2026-07-22T18:30:00+09:00'),
      newCode: () => 'CODE-' + codes++,
    },
  }
  return { app: createApp(deps), written }
}

// **한 번만 띄운다.** 검사마다 띄우면 진짜 Postgres를 열넷 번 띄우는 일이 되고
// 그것만으로 100초가 넘는다. 재는 저울이 느려지면 사람이 덜 재게 된다.
beforeAll(async () => {
  const fresh = await freshDb()
  db = fresh.db as unknown as Db
  close = fresh.close
  await db.insert(organizations).values({ id: 'ORG-01', name: '제12대 학생회' })
  await db.insert(departments).values([
    { id: 'D-01', orgId: 'ORG-01', name: '기획부', sortOrder: 0 },
    { id: 'D-02', orgId: 'ORG-01', name: '홍보부', sortOrder: 1 },
  ])
  await db.insert(members).values([
    { id: 'M-01', orgId: 'ORG-01', name: '김바다', role: 'chair', major: '컴퓨터학부', grade: '3학년', executiveTitle: '회장' },
    { id: 'M-02', orgId: 'ORG-01', name: '이윤슬', role: 'chair', major: 'ICT융합학부', grade: '4학년', executiveTitle: '부회장' },
    { id: 'M-11', orgId: 'ORG-01', name: '이수현', role: 'head', departmentId: 'D-01', isDepartmentLeader: true, major: '컴퓨터학부', grade: '3학년' },
    { id: 'M-13', orgId: 'ORG-01', name: '박민수', role: 'member', departmentId: 'D-01', major: '컴퓨터학부', grade: '2학년' },
    { id: 'M-99', orgId: 'ORG-01', name: '한겨울', role: 'member', major: '수학과', grade: '1학년' },
  ])
  await db.insert(invites).values({
    code: 'AB12CD34',
    orgId: 'ORG-01',
    active: true,
    createdAt: new Date('2026-07-01T10:00:00+09:00'),
  })
}, 60_000)

// 바뀌는 표는 초대 하나뿐이다. 그것만 되돌린다.
beforeEach(async () => {
  codes = 1
  await db.delete(invites)
  await db.insert(invites).values({
    code: 'AB12CD34',
    orgId: 'ORG-01',
    active: true,
    createdAt: new Date('2026-07-01T10:00:00+09:00'),
  })
})

afterAll(async () => {
  await close()
})

describe('조직도가 읽는 것', () => {
  it('회장과 부회장을 다른 색으로 가른다', async () => {
    const res = await harness().app.request('/api/org/executives')
    const rows = (await res.json()) as Array<{ roleLabel: string; roleTone: string }>
    expect(rows.map((row) => [row.roleLabel, row.roleTone])).toEqual([
      ['회장', 'yellow'],
      ['부회장', 'blue'],
    ])
  })

  // 세는 말은 저장하는 값이 아니라 세어서 만든 것이다.
  it('부원 수를 세어 말로 만든다', async () => {
    const res = await harness().app.request('/api/org/departments')
    const rows = (await res.json()) as Array<{
      name: string
      memberCountLabel: string
      leaders: unknown[]
    }>
    expect(rows.map((row) => [row.name, row.memberCountLabel, row.leaders.length])).toEqual([
      ['기획부', '부원 1명', 1],
      ['홍보부', '부원 0명', 0],
    ])
  })

  // 거르는 것은 서버가 한다 — 화면에서 거르면 몇 명인지가 걸러지기 전 수가 된다.
  it('검색어로 거르면 센 수도 함께 준다', async () => {
    const res = await harness().app.request('/api/org/departments?query=없는사람')
    const rows = (await res.json()) as Array<{ memberCountLabel: string }>
    expect(rows.map((row) => row.memberCountLabel)).toEqual(['부원 0명', '부원 0명'])
  })

  // 회장단은 부서에 안 들어도 배정된 것이다. 자리가 따로 있다.
  it('미배정에 회장단을 넣지 않는다', async () => {
    const res = await harness().app.request('/api/org/unassigned-members')
    const rows = (await res.json()) as Array<{ name: string }>
    expect(rows.map((row) => row.name)).toEqual(['한겨울'])
  })

  it('미배정 안내도 서버가 완성한다', async () => {
    const res = await harness().app.request('/api/org/unassigned-hint')
    expect(await res.json()).toEqual({ hint: '1명 · 드래그해서 부서로 이동' })
  })
})

describe('초대', () => {
  it('링크와 코드를 한 건으로 준다', async () => {
    const res = await harness().app.request('/api/org/invite')
    expect(await res.json()).toEqual({
      stateLabel: '활성',
      stateTone: 'green',
      stateNote: '현재 사용할 수 있는 초대 정보입니다.',
      regeneratedNote: '만든 때: 2026.07.01 10:00',
      url: 'https://vada.app/join/AB12CD34',
      code: 'AB12CD34',
    })
  })

  // **초대는 회장단만.** 그림은 부서장에게 자기 부서만을 그렸지만 코드가 학생회에
  // 하나뿐이라 부서를 가릴 수가 없어 2026-08-30에 회장단만으로 정했다.
  it('부서장은 다시 만들 수 없다', async () => {
    const res = await harness(viewer('head')).app.request('/api/org/invite/code', {
      method: 'POST',
      headers: { 'Idempotency-Key': 'K-1' },
    })
    expect(res.status).toBe(403)
  })

  it('다시 만들면 전에 나눠 준 것이 죽는다', async () => {
    const { app } = harness()
    const res = await app.request('/api/org/invite/code', {
      method: 'POST',
      headers: { 'Idempotency-Key': 'K-1' },
    })
    const made = (await res.json()) as { code: string }
    expect(made.code).toBe('CODE-1')

    const now = (await (await app.request('/api/org/invite')).json()) as { code: string }
    expect(now.code).toBe('CODE-1')
  })
})

describe('두 번 눌린 것을 가린다', () => {
  // **적어 두는 것과 지키는 것은 다른 일이다.** 지키는 코드가 없으면 두 번 눌린
  // 요청이 그대로 두 번 돌아, 방금 복사한 링크가 죽는다.
  it('같은 키로 두 번 오면 처음의 답을 그대로 준다', async () => {
    const { app } = harness()
    const first = await (
      await app.request('/api/org/invite/code', {
        method: 'POST',
        headers: { 'Idempotency-Key': 'K-1' },
      })
    ).json()
    const second = await (
      await app.request('/api/org/invite/code', {
        method: 'POST',
        headers: { 'Idempotency-Key': 'K-1' },
      })
    ).json()
    expect(second).toEqual(first)
  })

  it('키가 다르면 다시 만든다', async () => {
    const { app } = harness()
    const first = (await (
      await app.request('/api/org/invite/code', {
        method: 'POST',
        headers: { 'Idempotency-Key': 'K-1' },
      })
    ).json()) as { code: string }
    const second = (await (
      await app.request('/api/org/invite/code', {
        method: 'POST',
        headers: { 'Idempotency-Key': 'K-2' },
      })
    ).json()) as { code: string }
    expect(second.code).not.toBe(first.code)
  })

  // 없이 받아 주면 그 자리는 계약과 다르게 도는 것이고, 두 번 눌린 요청을
  // 가릴 방법이 사라진다.
  it('계약이 요구하는데 키가 없으면 막는다', async () => {
    const res = await harness().app.request('/api/org/invite/code', { method: 'POST' })
    expect(res.status).toBe(422)
  })
})

describe('답이 계약의 모양을 지킨다', () => {
  const ajv = new Ajv({ strict: false })
  const cases: Array<[string, string]> = [
    ['org.chartTitle', '/api/org/chart-title'],
    ['org.executives', '/api/org/executives'],
    ['org.departments', '/api/org/departments'],
    ['org.unassignedMembers', '/api/org/unassigned-members'],
    ['org.unassignedHint', '/api/org/unassigned-hint'],
    ['org.invite', '/api/org/invite'],
  ]
  for (const [operationId, url] of cases) {
    it(operationId + '의 답이 계약대로다', async () => {
      const res = await harness().app.request(url)
      const at = routeOf(operationId)!
      const paths = openapi.paths as unknown as Record<string, Record<string, unknown>>
      const operation = paths[at.path]![at.method] as {
        responses: { 200: { content: { 'application/json': { schema: object } } } }
      }
      const validate = ajv.compile(operation.responses[200].content['application/json'].schema)
      const body = await res.json()
      expect(validate(body), JSON.stringify(validate.errors)).toBe(true)
    })
  }
})
