import { randomUUID } from 'node:crypto'
import { beforeAll, afterAll, beforeEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { createApp, type Deps } from '../app.ts'
import type { Db } from '../db/client.ts'
import { freshDb } from '../db/testing.ts'
import {
  attendanceCheckIns,
  attendanceQrs,
  events,
  members,
  organizations,
  students,
} from '../db/schema.ts'
import { inMemoryAttempts } from '../idempotency.ts'
import { inMemoryCounter } from '../public/rate-limit.ts'
import { hashToken } from '../public/tokens.ts'

// **고리를 닫는 자리다.** 참가자가 찍는 쪽은 이미 있었고 여기는 그 QR을 만드는 쪽이다.
// 그래서 이 파일은 두 쪽을 함께 잰다 — 운영진이 만든 것으로 참가자가 실제로 찍힌다.

let db: Db
let close: () => Promise<void>
let made = 1

const NOW = new Date('2026-08-20T10:00:00+09:00')

function harness(role: 'chair' | 'member' = 'chair') {
  const deps: Deps = {
    audit: { async write() {} },
    db,
    who: async () => ({
      userId: 'U-01',
      membership: {
        orgId: 'ORG-01',
        memberId: role === 'chair' ? 'M-01' : 'M-03',
        role,
        departmentId: 'D-01',
        inFinanceDepartment: false,
      },
    }),
    lookups: {
      // 행사 운영 조직 표가 아직 없다. **없다고 답한다** — 있다고 지어내면
      // 조건부 권한이 전부 열린다.
      isEventStaff: async () => false,
      isEventStaffManager: async () => false,
      isMeetingHost: async () => false,
      isMeetingCreator: async () => false,
    },
    // 검사는 밖으로 나가지 않는다. 열려 있다고만 답하고, 부르면 어디로 갈지 말해 준다.
    signIn: {
      open: () => ({ google: true, kakao: false }),
      start: async (provider: string) => ({ url: `https://example.test/${provider}` }),
    },
    attempts: inMemoryAttempts(),
    counter: inMemoryCounter(),
    invite: { linkBase: 'https://vada.app/join', now: () => NOW, newCode: () => 'CODE' },
    newId: () => 'QR-' + made++,
  }
  return createApp(deps)
}

const outside = () => {
  const deps: Deps = {
    // 검사는 밖으로 나가지 않는다. 열려 있다고만 답하고, 부르면 어디로 갈지 말해 준다.
    signIn: {
      open: () => ({ google: true, kakao: false }),
      start: async (provider: string) => ({ url: `https://example.test/${provider}` }),
    },
    audit: { async write() {} },
    db,
    who: async () => null,
    lookups: {
      isEventStaff: async () => false,
      isEventStaffManager: async () => false,
      isMeetingHost: async () => false,
      isMeetingCreator: async () => false,
    },
    attempts: inMemoryAttempts(),
    counter: inMemoryCounter(),
    invite: { linkBase: 'https://vada.app/join', now: () => NOW, newCode: () => 'CODE' },
    newId: () => 'CI-' + made++,
  }
  return createApp(deps)
}

beforeAll(async () => {
  const fresh = await freshDb()
  db = fresh.db as unknown as Db
  close = fresh.close
}, 60_000)

beforeEach(async () => {
  made = 1
  await db.delete(attendanceCheckIns)
  await db.delete(attendanceQrs)
  await db.delete(students)
  await db.delete(members)
  await db.delete(events)
  await db.delete(organizations)

  await db.insert(organizations).values({ id: 'ORG-01', name: '제12대 학생회' })
  await db.insert(members).values([
    { id: 'M-01', orgId: 'ORG-01', name: '김바다', role: 'chair' },
    { id: 'M-03', orgId: 'ORG-01', name: '박해랑', role: 'member' },
  ])
  await db.insert(events).values({
    id: 'E-01',
    orgId: 'ORG-01',
    title: '2026 체육대회',
    updatedAt: NOW,
  })
})

afterAll(async () => {
  await close()
})

const card = (app: ReturnType<typeof harness>) =>
  app.request('/api/ops/events/E-01/attendance-qr')

const regenerate = (app: ReturnType<typeof harness>, key = randomUUID()) =>
  app.request('/api/ops/events/E-01/attendance-qr/regenerate', {
    method: 'POST',
    headers: { 'Idempotency-Key': key },
  })

const deactivate = (app: ReturnType<typeof harness>) =>
  app.request('/api/ops/events/E-01/attendance-qr/deactivate', { method: 'POST' })

describe('QR 카드', () => {
  // 빈 카드를 그리면 화면은 '시간이 안 정해진 QR'과 '아예 없는 것'을 구분하지 못한다.
  it('아직 만들지 않았으면 없다고 한다', async () => {
    expect((await card(harness())).status).toBe(404)
  })

  it('만들면 활성 중이라고 한다', async () => {
    const app = harness()
    expect((await regenerate(app)).status).toBe(200)

    const body = (await (await card(app)).json()) as Record<string, unknown>
    expect(body).toMatchObject({ statusLabel: '활성 중', statusTone: 'green' })
    // 정해지지 않은 것은 **그 사실을 말로** 준다. 빈 글을 주면 화면이 무엇이든 그린다.
    expect(body.startAt).toBe('시작 시간 미정')
    expect(body.guideNote).toContain('휴대폰')
  })

  it('파일 이름은 서버가 정한다', async () => {
    const app = harness()
    await regenerate(app)
    const body = (await (await card(app)).json()) as { fileName: string }
    expect(body.fileName).toBe('2026-체육대회-참석확인-QR.png')
  })

  it('끄면 비활성화됐다고 한다', async () => {
    const app = harness()
    await regenerate(app)
    expect((await deactivate(app)).status).toBe(200)
    expect((await (await card(app)).json()) as { statusLabel: string }).toMatchObject({
      statusLabel: '비활성화됨',
    })
  })

  it('시간이 지났으면 마감됐다고 한다', async () => {
    const app = harness()
    await regenerate(app)
    await db
      .update(attendanceQrs)
      .set({ closesAt: new Date('2026-08-20T09:00:00+09:00') })
    expect((await (await card(app)).json()) as { statusLabel: string }).toMatchObject({
      statusLabel: '마감됨',
    })
  })

  it('없는 행사는 없다고 한다', async () => {
    expect((await harness().request('/api/ops/events/E-99/attendance-qr')).status).toBe(404)
  })
})

// **토큰은 여기서 나가지 않는다.** 운영 화면이 새더라도 QR 자체는 새지 않는다.
describe('열쇠를 내보내지 않는다', () => {
  it('카드에 토큰이 없다', async () => {
    const app = harness()
    await regenerate(app)
    const rows = await db.select().from(attendanceQrs)
    const text = await (await card(app)).text()
    // 표에는 해시만 있으므로 애초에 원문을 돌려줄 수도 없다. 해시조차 나가지 않는다.
    expect(text).not.toContain(rows[0]!.tokenHash)
    expect(text.toLowerCase()).not.toContain('token')
  })
})

describe('다시 만들면 옛 것이 죽는다', () => {
  // 되돌릴 수 없다 — 뿌린 포스터와 단톡방의 QR이 전부 못 쓰게 된다.
  it('열쇠가 바뀐다', async () => {
    const app = harness()
    await regenerate(app)
    const before = (await db.select().from(attendanceQrs))[0]!.tokenHash
    await regenerate(app)
    const after = (await db.select().from(attendanceQrs))[0]!.tokenHash
    expect(after).not.toBe(before)
  })

  // **줄을 새로 만들지 않는다.** 새 줄이면 이미 찍은 사람이 새 QR로 또 찍을 수 있다.
  it('이미 찍은 사람이 다시 찍히지 않는다', async () => {
    const app = harness()
    await regenerate(app)

    // 참가자가 찍는다. 열쇠는 표에 해시로만 있으므로 검사가 직접 심는다.
    const token = 'AAAAAAAAAAAAAAAAAAAAAA'
    await db.update(attendanceQrs).set({ tokenHash: hashToken(token) })
    const send = () =>
      outside().request(`/api/public/attendance/${token}/check-in`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'Idempotency-Key': randomUUID() },
        body: JSON.stringify({ name: '김바다', studentNumber: '2021000001' }),
      })
    expect((await send()).status).toBe(200)

    // 다시 만든 뒤에도 그 사람은 같은 줄에 매여 있다.
    await regenerate(app)
    const next = 'BBBBBBBBBBBBBBBBBBBBBB'
    await db.update(attendanceQrs).set({ tokenHash: hashToken(next) })
    const again = await outside().request(`/api/public/attendance/${next}/check-in`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'Idempotency-Key': randomUUID() },
      body: JSON.stringify({ name: '김바다', studentNumber: '2021000001' }),
    })
    expect(again.status).toBe(409)
    expect(await db.select().from(attendanceCheckIns)).toHaveLength(1)
  })

  it('옛 열쇠로는 더 이상 찍히지 않는다', async () => {
    const app = harness()
    await regenerate(app)
    const old = 'CCCCCCCCCCCCCCCCCCCCCC'
    await db.update(attendanceQrs).set({ tokenHash: hashToken(old) })
    await regenerate(app)

    const res = await outside().request(`/api/public/attendance/${old}/check-in`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'Idempotency-Key': randomUUID() },
      body: JSON.stringify({ name: '김바다', studentNumber: '2021000001' }),
    })
    expect(res.status).toBe(404)
  })

  it('끈 것을 다시 만들면 다시 켜진다', async () => {
    const app = harness()
    await regenerate(app)
    await deactivate(app)
    await regenerate(app)
    expect((await db.select().from(attendanceQrs))[0]!.active).toBe(true)
  })
})

describe('아무나 만들지 못한다', () => {
  // 정책이 '회장은 늘, 부서장·부원은 행사 조직만'이라 했고, 행사 조직 표가 아직
  // 없으므로 부원은 막힌다. **없다고 답하는 쪽으로 기운다.**
  it('부원은 다시 만들 수 없다', async () => {
    expect((await regenerate(harness('member'))).status).toBe(403)
  })

  it('부원도 보는 것은 된다', async () => {
    await regenerate(harness())
    expect((await card(harness('member'))).status).toBe(200)
  })

  it('로그인하지 않은 사람은 아예 막힌다', async () => {
    expect((await card(outside())).status).toBe(401)
  })

  it('남의 학생회 행사는 없다고 한다', async () => {
    await db.insert(organizations).values({ id: 'ORG-02', name: '남의 학생회' })
    await db.insert(events).values({
      id: 'E-99',
      orgId: 'ORG-02',
      title: '남의 행사',
      updatedAt: NOW,
    })
    expect((await regenerate(harness())).status).toBe(200)
    const res = await harness().request('/api/ops/events/E-99/attendance-qr')
    expect(res.status).toBe(404)
    expect(await db.select().from(attendanceQrs).where(eq(attendanceQrs.eventId, 'E-99'))).toHaveLength(0)
  })
})
