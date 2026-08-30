import { beforeAll, afterAll, beforeEach, describe, expect, it } from 'vitest'
import Ajv from 'ajv'
import openapi from '../../../../specs/figma/vada-wireframe/openapi.json' with { type: 'json' }
import { createApp, type Deps } from '../app.ts'
import type { Db } from '../db/client.ts'
import { freshDb } from '../db/testing.ts'
import { departments, events, members, organizations, users } from '../db/schema.ts'
import { inMemoryAttempts } from '../idempotency.ts'
import { routeOf } from '../routes.ts'
import type { AuditEntry } from '../audit.ts'
import type { Viewer } from '../permissions.ts'

// 행사를 만들고 · 목록에서 보고 · 열어서 머리를 그린다.
//
// **저장하는 것과 그리는 것이 다르다.** 표에는 때가 하나 들어 있고 화면은
// '2026. 08. 20 10:00'이나 '일시 미정'을 받는다 — 어느 쪽인지 고르는 것도 형식을
// 만드는 것도 서버의 일이다.

let db: Db
let close: () => Promise<void>
let made = 1

const NOW = new Date('2026-07-18T09:00:00+09:00')

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
    who: async () => who,
    lookups: {
      isEventStaff: async () => false,
      isEventStaffManager: async () => false,
      isMeetingHost: async () => false,
      isMeetingCreator: async () => false,
    },
    attempts: inMemoryAttempts(),
    invite: { linkBase: 'https://vada.app/join', now: () => NOW, newCode: () => 'CODE' },
    newId: () => 'E-new-' + made++,
  }
  return { app: createApp(deps), written }
}

beforeAll(async () => {
  const fresh = await freshDb()
  db = fresh.db as unknown as Db
  close = fresh.close
}, 60_000)

beforeEach(async () => {
  made = 1
  await db.delete(events)
  await db.delete(members)
  await db.delete(departments)
  await db.delete(organizations)
  await db.delete(users)

  await db.insert(organizations).values({ id: 'ORG-01', name: '제12대 학생회' })
  await db.insert(departments).values({ id: 'D-01', orgId: 'ORG-01', name: '학술체육부' })
  await db.insert(members).values({
    id: 'M-01',
    orgId: 'ORG-01',
    name: '김바다',
    role: 'chair',
    departmentId: 'D-01',
  })
  await db.insert(events).values([
    {
      id: 'E-01',
      orgId: 'ORG-01',
      title: '2026 소프트웨어융합대학 체육대회',
      status: 'inProgress',
      startAt: new Date('2026-08-20T10:00:00+09:00'),
      place: 'ERICA 체육관',
      audience: '소프트웨어융합대학 전체',
      hostDepartmentId: 'D-01',
      hostMemberId: 'M-01',
      updatedAt: NOW,
    },
    // 행사명 하나만 있는 행사. **비어 있는 것이 정상이다** — 나머지는 행사 공간에서 채운다.
    { id: 'E-02', orgId: 'ORG-01', title: '가칭 신입생 환영회', updatedAt: NOW },
    // 완료된 행사는 목록에 오지 않는다.
    { id: 'E-09', orgId: 'ORG-01', title: '끝난 행사', status: 'done', updatedAt: NOW },
  ])
})

afterAll(async () => {
  await close()
})

describe('행사 목록', () => {
  it('완료된 행사는 오지 않는다', async () => {
    const res = await harness().app.request('/api/ops/events')
    const rows = (await res.json()) as Array<{ title: string }>
    expect(rows.map((row) => row.title)).toEqual([
      '2026 소프트웨어융합대학 체육대회',
      '가칭 신입생 환영회',
    ])
  })

  // **정해지지 않은 것은 그 사실을 말로 준다.** 빈 글을 주면 화면이 그 자리에
  // 무엇이든 그린다.
  it('아직 안 채운 자리를 완성된 안내로 준다', async () => {
    const res = await harness().app.request('/api/ops/events')
    const rows = (await res.json()) as Array<{
      title: string
      startAt: string
      place: string
      host: string
    }>
    const 빈행사 = rows.find((row) => row.title === '가칭 신입생 환영회')!
    expect(빈행사).toMatchObject({ startAt: '일시 미정', place: '장소 미정', host: '담당 미정' })
  })

  // 무엇이 눈에 띄어야 하는지는 행사마다 다르다. 개수도 데이터가 정한다.
  it('눈에 띄어야 하는 것의 개수가 행사마다 다르다', async () => {
    const res = await harness().app.request('/api/ops/events')
    const rows = (await res.json()) as Array<{ title: string; highlights: unknown[] }>
    expect(rows.find((row) => row.title === '가칭 신입생 환영회')!.highlights).toHaveLength(3)
    expect(rows.find((row) => row.title.includes('체육대회'))!.highlights).toHaveLength(0)
  })

  it('행사명으로 거른다', async () => {
    const res = await harness().app.request('/api/ops/events?query=체육')
    expect((await res.json()) as unknown[]).toHaveLength(1)
  })

  it('진행 단계로 거른다', async () => {
    const res = await harness().app.request('/api/ops/events?status=planning')
    const rows = (await res.json()) as Array<{ title: string }>
    expect(rows.map((row) => row.title)).toEqual(['가칭 신입생 환영회'])
  })

  // 만들 수 있는 사람에게만 머리에 그 단추가 그려진다.
  it('만들 수 있는가는 정책이 답한다', async () => {
    const 회장단 = await (
      await harness(viewer('chair')).app.request('/api/ops/events/viewer')
    ).json()
    const 부원 = await (
      await harness(viewer('member')).app.request('/api/ops/events/viewer')
    ).json()
    expect(회장단).toEqual({ canCreateEvent: true })
    expect(부원).toEqual({ canCreateEvent: false })
  })
})

describe('행사 하나', () => {
  // **남은 날은 서버가 센다** — 오늘이 언제인지 화면이 알 수 없다.
  it('남은 날과 일정을 완성된 글로 준다', async () => {
    const res = await harness().app.request('/api/ops/event/summary?eventId=E-01')
    expect(await res.json()).toMatchObject({
      title: '2026 소프트웨어융합대학 체육대회',
      schedule: '행사일 2026-08-20 · ERICA 체육관',
      dday: 'D-33',
    })
  })

  it('없는 행사는 없다고 한다', async () => {
    const res = await harness().app.request('/api/ops/event/summary?eventId=E-9999')
    expect(res.status).toBe(404)
  })

  // 갈피를 옮겨 다녀도 그대로인 한 줄. 화면이 아니라 행사에 딸린 값이다.
  it('작업공간 머리는 단계와 담당을 완성된 글로 준다', async () => {
    const res = await harness().app.request('/api/ops/event/workspace?eventId=E-01')
    expect(await res.json()).toMatchObject({
      status: '진행 중',
      statusKey: 'inProgress',
      statusTone: 'green',
      host: '담당 학술체육부 · 김바다',
      startAt: '08.20 10:00',
    })
  })

  // **역할 이름을 들지 않는다.** 무엇을 할 수 있는지로 말한다.
  it('무엇을 할 수 있는지는 보는 사람마다 다르다', async () => {
    const 회장단 = (await (
      await harness(viewer('chair')).app.request('/api/ops/event/workspace?eventId=E-01')
    ).json()) as { permissionNote: string }
    const 부원 = (await (
      await harness(viewer('member')).app.request('/api/ops/event/workspace?eventId=E-01')
    ).json()) as { permissionNote: string }
    expect(회장단.permissionNote).not.toBe(부원.permissionNote)
    expect(부원.permissionNote).toContain('열람')
  })

  it('기본정보의 빈 자리를 완성된 안내로 준다', async () => {
    const res = await harness().app.request('/api/ops/event/basics?eventId=E-02')
    expect(await res.json()).toMatchObject({
      title: '가칭 신입생 환영회',
      startAt: '일시 미정',
      place: '장소 미정',
      fee: '참가비 미정',
      attendeeCount: '집계 전',
    })
  })
})

describe('행사 만들기', () => {
  const create = (title: unknown, who = viewer('chair')) =>
    harness(who).app.request('/api/ops/events', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'Idempotency-Key': 'K-1' },
      body: JSON.stringify({ title }),
    })

  it('행사명 하나로 만든다', async () => {
    expect((await create('새 행사')).status).toBe(200)
    const rows = (await (
      await harness().app.request('/api/ops/events?query=새 행사')
    ).json()) as unknown[]
    expect(rows).toHaveLength(1)
  })

  it('부원은 만들 수 없다', async () => {
    expect((await create('새 행사', viewer('member'))).status).toBe(403)
  })

  it('행사명이 비면 막는다', async () => {
    expect((await create('   ')).status).toBe(422)
  })

  // **같은 이름의 행사를 둘 만드는 것이 정당할 수 있다.** 그래서 이름으로는 가릴 수
  // 없고, 두 번 눌린 것과 두 번 의도한 것은 보내는 쪽만 안다.
  it('같은 키로 두 번 오면 하나만 생긴다', async () => {
    const { app } = harness()
    const send = () =>
      app.request('/api/ops/events', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'Idempotency-Key': 'K-1' },
        body: JSON.stringify({ title: '두 번 눌린 행사' }),
      })
    const first = await (await send()).json()
    const second = await (await send()).json()
    expect(second).toEqual(first)
    const rows = (await (await app.request('/api/ops/events?query=두 번')).json()) as unknown[]
    expect(rows).toHaveLength(1)
  })
})

describe('답이 계약의 모양을 지킨다', () => {
  const ajv = new Ajv({ strict: false })
  const cases: Array<[string, string]> = [
    ['event.list', '/api/ops/events'],
    ['event.listViewer', '/api/ops/events/viewer'],
    ['event.summary', '/api/ops/event/summary?eventId=E-01'],
    ['event.workspace', '/api/ops/event/workspace?eventId=E-01'],
    ['event.basics', '/api/ops/event/basics?eventId=E-01'],
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
