import { randomUUID } from 'node:crypto'
import { beforeAll, afterAll, beforeEach, describe, expect, it } from 'vitest'
import { createApp, type Deps } from '../app.ts'
import type { Db } from '../db/client.ts'
import { freshDb } from '../db/testing.ts'
import {
  attendanceCheckIns,
  attendanceQrs,
  events,
  organizations,
  students,
} from '../db/schema.ts'
import { inMemoryAttempts } from '../idempotency.ts'
import { inMemoryCounter } from './rate-limit.ts'
import { hashToken } from './tokens.ts'
import type { AuditEntry } from '../audit.ts'

// **로그인이 없는 자리다.** 주소가 실어 온 토큰이 유일한 벽이므로 여기서 재는 것은
// 다른 곳과 다르다 — 공격자의 눈으로 본다.

let db: Db
let close: () => Promise<void>
let made = 1

const NOW = new Date('2026-08-20T10:00:00+09:00')
const QR = 'AAAAAAAAAAAAAAAAAAAAAA'

function harness() {
  const written: AuditEntry[] = []
  const deps: Deps = {
    audit: {
      async write(entry) {
        written.push(entry)
      },
    },
    db,
    // 밖에서 온 사람이다 — 로그인이 없다.
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
  return { app: createApp(deps), written }
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
  await db.delete(events)
  await db.delete(organizations)

  await db.insert(organizations).values({ id: 'ORG-01', name: '제12대 학생회' })
  await db.insert(events).values({
    id: 'E-01',
    orgId: 'ORG-01',
    title: '2026 체육대회',
    updatedAt: NOW,
  })
  await db.insert(students).values({
    id: 'S-01',
    orgId: 'ORG-01',
    name: '김바다',
    studentNumber: '2021000001',
  })
  await db.insert(attendanceQrs).values({
    id: 'QR-01',
    orgId: 'ORG-01',
    eventId: 'E-01',
    tokenHash: hashToken(QR),
    active: true,
    opensAt: new Date('2026-08-20T09:30:00+09:00'),
    closesAt: new Date('2026-08-20T11:00:00+09:00'),
  })
})

afterAll(async () => {
  await close()
})

// **계약이 이 자리에 Idempotency-Key를 요구한다.** 한동안 아무도 확인하지 않아서
// 키 없이도 지나갔다 — 밖에서 오는 자리는 구성원이 아니라 미들웨어가 건너뛰었다.
const send = (
  app: ReturnType<typeof harness>['app'],
  body: unknown,
  token = QR,
  key = randomUUID(),
) =>
  app.request(`/api/public/attendance/${token}/check-in`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'Idempotency-Key': key },
    body: JSON.stringify(body),
  })

describe('QR을 찍으면', () => {
  it('로그인 없이 열린다', async () => {
    const res = await harness().app.request(
      `/api/public/attendance/check-in-form?checkInToken=${QR}`,
    )
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({
      eventName: '2026 체육대회',
      statusLabel: '체크인 가능',
      checkInWindow: '09:30 ~ 11:00',
    })
  })

  // **막혔을 때 이름·학번 칸을 그리지 않는다** — 그 판정을 화면이 `blockedNote`로 안다.
  it('꺼진 QR은 막은 까닭을 말한다', async () => {
    await db.update(attendanceQrs).set({ active: false })
    const body = (await (
      await harness().app.request(`/api/public/attendance/check-in-form?checkInToken=${QR}`)
    ).json()) as { blockedNote?: string }
    expect(body.blockedNote).toBeDefined()
  })

  // 모양이 아닌 것은 표를 찾아보기도 전에 막는다.
  it('토큰 모양이 아니면 없다고 한다', async () => {
    const res = await harness().app.request(
      '/api/public/attendance/check-in-form?checkInToken=짧다',
    )
    expect(res.status).toBe(404)
  })
})

describe('참석을 낸다', () => {
  it('명단에 있으면 참석 완료다', async () => {
    const made = (await (
      await send(harness().app, { name: '김바다', studentNumber: '2021000001' })
    ).json()) as { receiptToken: string }
    expect(made.receiptToken).toMatch(/^[A-Za-z0-9_-]{22}$/)

    const result = await (
      await harness().app.request(
        `/api/public/attendance/check-in-result?receiptToken=${made.receiptToken}`,
      )
    ).json()
    expect(result).toMatchObject({ label: '참석 완료', canRetry: false })
  })

  // 명단에 없다고 막지 않는다 — 다시 낼 수 있게 하고 그 사실을 결과가 말한다.
  it('명단에 없으면 다시 낼 수 있다고 말한다', async () => {
    const made = (await (
      await send(harness().app, { name: '남의사람', studentNumber: '9999999999' })
    ).json()) as { receiptToken: string }
    const result = (await (
      await harness().app.request(
        `/api/public/attendance/check-in-result?receiptToken=${made.receiptToken}`,
      )
    ).json()) as { canRetry: boolean }
    expect(result.canRetry).toBe(true)
  })

  it('이름이나 학번이 비면 막는다', async () => {
    expect((await send(harness().app, { name: '  ', studentNumber: '2021000001' })).status).toBe(422)
  })

  it('시간이 지났으면 막는다', async () => {
    await db.update(attendanceQrs).set({ closesAt: new Date('2026-08-20T09:40:00+09:00') })
    expect((await send(harness().app, { name: '김바다', studentNumber: '2021000001' })).status).toBe(
      422,
    )
  })
})

// **여기가 첫 교차검토가 찾은 구멍이고, 두 번째가 다시 짚은 자리다.**
describe('남의 것을 열 수 없다', () => {
  // 같은 QR을 모두가 찍는다. 그 토큰으로 결과를 열면 뒤에 찍은 사람이 앞사람의
  // 이름과 납부 상태를 본다.
  it('QR 토큰으로는 결과를 열 수 없다', async () => {
    await send(harness().app, { name: '김바다', studentNumber: '2021000001' })
    const res = await harness().app.request(
      `/api/public/attendance/check-in-result?receiptToken=${QR}`,
    )
    expect(res.status).toBe(404)
  })

  // **공격자가 공유 QR과 남의 학번으로 보내면?** 계약이 '첫 영수증을 다시 준다'였을
  // 때는 그 사람의 영수증이 돌아왔다. 이제 영수증 없는 409다.
  it('남의 학번으로 다시 내도 영수증을 주지 않는다', async () => {
    const victim = (await (
      await send(harness().app, { name: '김바다', studentNumber: '2021000001' })
    ).json()) as { receiptToken: string }

    const attacker = await send(harness().app, { name: '아무개', studentNumber: '2021000001' })
    expect(attacker.status).toBe(409)
    const body = (await attacker.json()) as Record<string, unknown>
    expect(body.receiptToken).toBeUndefined()
    expect(JSON.stringify(body)).not.toContain(victim.receiptToken)
  })

  // 영수증이 감사 기록에 남으면 그 기록이 새는 순간 결과가 열린다.
  it('영수증을 감사 기록에 남기지 않는다', async () => {
    const { app, written } = harness()
    const made = (await (
      await send(app, { name: '김바다', studentNumber: '2021000001' })
    ).json()) as { receiptToken: string }
    expect(JSON.stringify(written)).not.toContain(made.receiptToken)
  })

  // 주소에 실린 QR 토큰도 기록에 남으면 안 된다.
  it('주소의 토큰을 기록에서 지운다', async () => {
    const { app, written } = harness()
    await send(app, { name: '김바다', studentNumber: '2021000001' })
    expect(written[0]!.action).not.toContain(QR)
    expect(written[0]!.action).toContain('*')
  })

  // 열쇠를 담은 답은 어디에도 쌓이면 안 된다.
  it('열쇠를 담은 답은 쌓이지 않게 한다', async () => {
    const res = await send(harness().app, { name: '김바다', studentNumber: '2021000001' })
    expect(res.headers.get('Cache-Control')).toBe('no-store')
  })

  // 오래 사는 열쇠는 오래 새는 열쇠다.
  it('만료된 영수증으로는 열리지 않는다', async () => {
    const made = (await (
      await send(harness().app, { name: '김바다', studentNumber: '2021000001' })
    ).json()) as { receiptToken: string }
    await db
      .update(attendanceCheckIns)
      .set({ receiptExpiresAt: new Date('2026-08-19T00:00:00+09:00') })
    const res = await harness().app.request(
      `/api/public/attendance/check-in-result?receiptToken=${made.receiptToken}`,
    )
    expect(res.status).toBe(404)
  })

  // **표에 그대로 두면 표가 새는 순간 열쇠도 샌다.**
  it('토큰을 그대로 저장하지 않는다', async () => {
    const made = (await (
      await send(harness().app, { name: '김바다', studentNumber: '2021000001' })
    ).json()) as { receiptToken: string }
    const rows = await db.select().from(attendanceCheckIns)
    expect(rows[0]!.receiptHash).not.toBe(made.receiptToken)
    const qrs = await db.select().from(attendanceQrs)
    expect(qrs[0]!.tokenHash).not.toBe(QR)
  })
})

describe('마구 넣어 보는 것을 막는다', () => {
  // 22자 난수라도 초당 수천 번 넣어 보면 언젠가 열린다.
  it('틀린 열쇠를 거듭 넣으면 막는다', async () => {
    const { app } = harness()
    let blocked = false
    for (let at = 0; at < 60; at += 1) {
      const res = await app.request(
        `/api/public/attendance/check-in-form?checkInToken=${'B'.repeat(22)}`,
        { headers: { 'x-forwarded-for': '1.2.3.4' } },
      )
      if (res.status === 429) {
        blocked = true
        // 말하지 않으면 상대는 계속 두드린다.
        expect(res.headers.get('Retry-After')).not.toBeNull()
        break
      }
    }
    expect(blocked).toBe(true)
  })

  // **주소만 막으면 정상 참가자가 다 막힌다.** 캠퍼스는 NAT 뒤라 행사장 전체가
  // 주소 하나로 보인다 — 맞는 요청은 훨씬 가볍게 세어야 한다.
  it('맞는 요청은 같은 주소에서 많이 와도 막지 않는다', async () => {
    const { app } = harness()
    for (let at = 0; at < 100; at += 1) {
      const res = await app.request(
        `/api/public/attendance/check-in-form?checkInToken=${QR}`,
        { headers: { 'x-forwarded-for': '1.2.3.4' } },
      )
      expect(res.status).toBe(200)
    }
  })

  // 안쪽 자리는 세션이 벽이므로 여기서 세지 않는다.
  it('안쪽 자리는 세지 않는다', async () => {
    const { app } = harness()
    for (let at = 0; at < 80; at += 1) {
      const res = await app.request('/api/org/role-counts')
      // 로그인이 없으므로 401이지 429가 아니다.
      expect(res.status).toBe(401)
    }
  })
})
