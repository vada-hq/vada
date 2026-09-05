import { randomUUID } from 'node:crypto'
import { beforeAll, afterAll, beforeEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { createApp, type Deps } from '../app.ts'
import type { Db } from '../db/client.ts'
import { freshDb } from '../db/testing.ts'
import { events, organizations, students, surveyApplications, surveys } from '../db/schema.ts'
import { inMemoryAttempts } from '../idempotency.ts'
import { inMemoryCounter } from './rate-limit.ts'
import type { AuditEntry } from '../audit.ts'

// **로그인이 없는 자리다.** 링크가 실어 온 토큰이 유일한 벽이고, 같은 링크를 모두가
// 연다 — 그래서 참석과 같은 눈으로 잰다.

let db: Db
let close: () => Promise<void>
let made = 1

const NOW = new Date('2026-08-15T10:00:00+09:00')
const LINK = 'SSSSSSSSSSSSSSSSSSSSSS'
const NEXT_LINK = 'TTTTTTTTTTTTTTTTTTTTTT'

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
      isMeetingParticipant: async () => false,
    },
    // 검사는 밖으로 나가지 않는다. 열려 있다고만 답하고, 부르면 어디로 갈지 말해 준다.
    signIn: {
      open: () => ({ google: true, kakao: false }),
      start: async (provider: string) => ({ url: `https://example.test/${provider}` }),
    },
    attempts: inMemoryAttempts(),
    counter: inMemoryCounter(),
    invite: { linkBase: 'https://vada.app/join', now: () => NOW, newCode: () => 'CODE' },
    newId: () => 'AP-' + made++,
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
  await db.delete(surveyApplications)
  await db.delete(surveys)
  await db.delete(students)
  await db.delete(events)
  await db.delete(organizations)

  await db.insert(organizations).values({ id: 'ORG-01', name: '제12대 학생회' })
  await db.insert(events).values({
    id: 'E-01',
    orgId: 'ORG-01',
    title: '2026 체육대회',
    startAt: new Date('2026-08-20T10:00:00+09:00'),
    place: 'ERICA 체육관',
    audience: '소프트웨어융합대학 전체',
    fee: '납부자 무료 / 미납자 5000원',
    contact: '학생회 카카오톡 채널',
    updatedAt: NOW,
  })
  await db.insert(students).values([
    {
      id: 'S-01',
      orgId: 'ORG-01',
      name: '김바다',
      studentNumber: '2021000001',
      college: '소프트웨어융합대학',
      department: '소프트웨어학부',
      duesStatus: 'paid',
    },
    {
      id: 'S-02',
      orgId: 'ORG-01',
      name: '이하늘',
      studentNumber: '2021000002',
      college: '소프트웨어융합대학',
      department: '인공지능학과',
      duesStatus: 'unpaid',
    },
    {
      id: 'S-03',
      orgId: 'ORG-01',
      name: '박산',
      studentNumber: '2021000003',
      college: '공학대학',
      department: '기계공학과',
      duesStatus: 'paid',
    },
  ])
  await db.insert(surveys).values({
    id: 'SV-01',
    orgId: 'ORG-01',
    eventId: 'E-01',
    linkToken: LINK,
    active: true,
    opensAt: new Date('2026-08-10T00:00:00+09:00'),
    closesAt: new Date('2026-08-19T23:59:00+09:00'),
    completionTitle: '참가 신청이 접수되었습니다',
  })
})

afterAll(async () => {
  await close()
})

const DRAFT = {
  name: '김바다',
  studentNumber: '2021000001',
  college: '소프트웨어융합대학',
  department: '소프트웨어학부',
  currentGrade: '3학년',
  privacyConsent: true,
}

function send(
  app: ReturnType<typeof harness>['app'],
  body: unknown = DRAFT,
  { token = LINK, key = randomUUID() as string | null } = {},
) {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (key !== null) headers['Idempotency-Key'] = key
  return app.request(`/api/public/surveys/${token}/applications`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
}

const form = (app: ReturnType<typeof harness>['app'], token = LINK) =>
  app.request(`/api/public/surveys/apply-form?surveyToken=${token}`)
const state = (app: ReturnType<typeof harness>['app'], token = LINK) =>
  app.request(`/api/public/surveys/link-state?surveyToken=${token}`)
const result = (app: ReturnType<typeof harness>['app'], receipt: string) =>
  app.request(`/api/public/surveys/apply-result?receiptToken=${receipt}`)

async function receiptOf(app: ReturnType<typeof harness>['app'], body: unknown = DRAFT) {
  const res = await send(app, body)
  const made = (await res.json()) as { receiptToken: string }
  return made.receiptToken
}

describe('링크를 열면', () => {
  it('로그인 없이 신청 폼이 열린다', async () => {
    const res = await form(harness().app)
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({
      title: '2026 체육대회',
      startAt: '2026-08-20 10:00',
      place: 'ERICA 체육관',
      audience: '소프트웨어융합대학 전체',
      fee: '납부자 무료 / 미납자 5000원',
    })
  })

  // **판정이 한 곳에 있다는 것을 여기서 잰다.** 둘 다 답하거나 둘 다 답하지 않으면
  // 화면은 어느 쪽을 그려야 할지 모른다.
  it('열린 링크에는 막힌 까닭이 없다', async () => {
    expect((await state(harness().app)).status).toBe(404)
  })

  it('막힌 링크에는 신청 폼이 없다', async () => {
    await db.update(surveys).set({ active: false })
    const { app } = harness()
    expect((await form(app)).status).toBe(404)
    expect((await state(app)).status).toBe(200)
  })

  it('모집 전은 무채색이고 정원 마감은 주황이다', async () => {
    await db.update(surveys).set({ opensAt: new Date('2026-08-20T00:00:00+09:00') })
    const before = (await (await state(harness().app)).json()) as { label: string; tone: string }
    expect(before).toMatchObject({ label: '모집 전', tone: 'gray' })

    await db.update(surveys).set({ opensAt: null, capacity: 1 })
    await receiptOf(harness().app)
    const full = (await (await state(harness().app)).json()) as { label: string; tone: string }
    expect(full).toMatchObject({ label: '정원 마감', tone: 'orange' })
  })

  // **다섯 중 이것만 갈 곳이 있다.**
  it('교체된 설문만 새 링크를 알려 준다', async () => {
    await db.insert(surveys).values({
      id: 'SV-02',
      orgId: 'ORG-01',
      eventId: 'E-01',
      linkToken: NEXT_LINK,
      active: true,
    })
    await db.update(surveys).set({ replacedById: 'SV-02' }).where(eq(surveys.id, 'SV-01'))

    const body = (await (await state(harness().app)).json()) as {
      actionLabel?: string
      replacementToken?: string
    }
    // 옛 토큰과 새 토큰을 잇는 것은 서버뿐이다 — 화면이 이 값을 지어낼 수 없다.
    expect(body.replacementToken).toBe(NEXT_LINK)
    expect(body.actionLabel).toBeDefined()

    const closed = (await (await state(harness().app)).json()) as { note: string }
    expect(closed.note).toBeDefined()
  })

  it('갈 곳이 없는 상태에는 단추를 주지 않는다', async () => {
    await db.update(surveys).set({ active: false })
    const body = (await (await state(harness().app)).json()) as Record<string, unknown>
    expect(body.actionLabel).toBeUndefined()
    expect(body.replacementToken).toBeUndefined()
  })

  it('토큰 모양이 아니면 없다고 한다', async () => {
    expect((await form(harness().app, '짧다')).status).toBe(404)
  })
})

describe('신청을 낸다', () => {
  it('내면 영수증으로 결과가 열린다', async () => {
    const { app } = harness()
    const receipt = await receiptOf(app)
    expect(receipt).toMatch(/^[A-Za-z0-9_-]{22}$/)

    const body = (await (await result(harness().app, receipt)).json()) as Record<string, unknown>
    expect(body).toMatchObject({
      title: '참가 신청이 접수되었습니다',
      eventTitle: '2026 체육대회',
      // **라벨까지 품은 완성된 한 줄이다** — 화면이 이어 붙이지 않는다.
      applicantNote: '신청자: 김바다',
    })
    // 문의처를 적은 행사는 두 줄이다.
    expect(body.notices).toHaveLength(2)
  })

  // **동의를 받았다는 것이 필수의 뜻이다.** 칸이 있다는 뜻이 아니다.
  it('동의하지 않으면 받지 않는다', async () => {
    const res = await send(harness().app, { ...DRAFT, privacyConsent: false })
    expect(res.status).toBe(422)
    expect(await db.select().from(surveyApplications)).toHaveLength(0)
  })

  it('동의한 시각을 남긴다', async () => {
    await receiptOf(harness().app)
    const rows = await db.select().from(surveyApplications)
    expect(rows[0]!.privacyConsentAt).toEqual(NOW)
  })

  it('필수 항목이 비면 막는다', async () => {
    expect((await send(harness().app, { ...DRAFT, department: '  ' })).status).toBe(422)
  })

  it('막힌 링크에는 낼 수 없다', async () => {
    await db.update(surveys).set({ active: false })
    expect((await send(harness().app)).status).toBe(422)
  })

  // **금액일 수도 상태일 수도 있다.** 대조하는 행사인데 명단에 없으면 아직 모른다.
  it('학생회비를 대조하는 행사는 명단에 없으면 확인 중이라고 한다', async () => {
    await db.update(surveys).set({ duesCheck: true })
    const { app } = harness()
    const receipt = await receiptOf(app, { ...DRAFT, name: '남의사람', studentNumber: '9999999999' })
    const body = (await (await result(harness().app, receipt)).json()) as {
      feeStatus: string
      feeNote?: string
    }
    expect(body.feeStatus).toBe('관리자 확인 중')
    expect(body.feeNote).toBeDefined()
  })

  it('금액이 정해진 행사에는 보조문이 오지 않는다', async () => {
    const receipt = await receiptOf(harness().app)
    const body = (await (await result(harness().app, receipt)).json()) as {
      feeStatus: string
      feeNote?: string
    }
    expect(body.feeStatus).toBe('납부자 무료 / 미납자 5000원')
    expect(body.feeNote).toBeUndefined()
  })
})

// **참석에서 잰 것과 같은 공격이다.** 표가 다르다고 규칙이 달라지지 않는다.
describe('남의 것을 열 수 없다', () => {
  it('설문 토큰으로는 결과를 열 수 없다', async () => {
    await receiptOf(harness().app)
    expect((await result(harness().app, LINK)).status).toBe(404)
  })

  it('남의 학번으로 다시 내도 영수증을 주지 않는다', async () => {
    const victim = await receiptOf(harness().app)

    const attacker = await send(harness().app, { ...DRAFT, name: '아무개' })
    expect(attacker.status).toBe(409)
    const body = (await attacker.json()) as Record<string, unknown>
    expect(body.receiptToken).toBeUndefined()
    expect(JSON.stringify(body)).not.toContain(victim)
  })

  it('영수증을 감사 기록에 남기지 않는다', async () => {
    const { app, written } = harness()
    const receipt = await receiptOf(app)
    expect(JSON.stringify(written)).not.toContain(receipt)
  })

  it('주소의 토큰을 기록에서 지운다', async () => {
    const { app, written } = harness()
    await receiptOf(app)
    expect(written[0]!.action).not.toContain(LINK)
    expect(written[0]!.action).toContain('*')
  })

  it('열쇠를 담은 답은 쌓이지 않게 한다', async () => {
    const res = await send(harness().app)
    expect(res.headers.get('Cache-Control')).toBe('no-store')
  })

  it('만료된 영수증으로는 열리지 않는다', async () => {
    const receipt = await receiptOf(harness().app)
    await db
      .update(surveyApplications)
      .set({ receiptExpiresAt: new Date('2026-08-14T00:00:00+09:00') })
    expect((await result(harness().app, receipt)).status).toBe(404)
  })

  // 영수증은 그 사람만 가지는 값이므로 해시로 둔다.
  it('영수증을 그대로 저장하지 않는다', async () => {
    const receipt = await receiptOf(harness().app)
    const rows = await db.select().from(surveyApplications)
    expect(rows[0]!.receiptHash).not.toBe(receipt)
  })
})

// **밖에서는 멱등 키가 곧 열쇠다.** 담아 둔 답에 영수증이 들어 있다.
describe('두 번 눌린 것을 가린다', () => {
  it('같은 키로 두 번 누르면 같은 영수증이 오고 한 줄만 남는다', async () => {
    const { app } = harness()
    const key = randomUUID()
    const first = (await (await send(app, DRAFT, { key })).json()) as { receiptToken: string }
    const again = await send(app, DRAFT, { key })
    expect(again.status).toBe(200)
    expect((await again.json()) as { receiptToken: string }).toEqual(first)
    expect(await db.select().from(surveyApplications)).toHaveLength(1)
  })

  it('다시 보인 답도 쌓이지 않게 한다', async () => {
    const { app } = harness()
    const key = randomUUID()
    await send(app, DRAFT, { key })
    expect((await send(app, DRAFT, { key })).headers.get('Cache-Control')).toBe('no-store')
  })

  it('다른 키로 같은 학번이 오면 영수증 없는 409다', async () => {
    const { app } = harness()
    const first = (await (await send(app)).json()) as { receiptToken: string }
    const second = await send(app)
    expect(second.status).toBe(409)
    expect(JSON.stringify(await second.json())).not.toContain(first.receiptToken)
  })

  // **계약이 요구하는 것을 지킨다.** 오랫동안 밖에서 오는 자리는 그냥 지나갔다.
  it('키가 없으면 받지 않는다', async () => {
    expect((await send(harness().app, DRAFT, { key: null })).status).toBe(422)
    expect(await db.select().from(surveyApplications)).toHaveLength(0)
  })

  // 주소와 학번에서 만들어 낸 키는 **남도 만들 수 있는 값**이고, 그러면 그 키가
  // 남의 영수증을 여는 열쇠가 된다.
  it('유추할 수 있는 키는 받지 않는다', async () => {
    const res = await send(harness().app, DRAFT, { key: `${LINK}-2021000001` })
    expect(res.status).toBe(422)
  })

  it('한 링크의 키가 다른 링크의 답을 열지 않는다', async () => {
    await db.insert(surveys).values({
      id: 'SV-02',
      orgId: 'ORG-01',
      eventId: 'E-01',
      linkToken: NEXT_LINK,
      active: true,
    })
    const { app } = harness()
    const key = randomUUID()
    const mine = (await (await send(app, DRAFT, { key })).json()) as { receiptToken: string }
    const other = (await (
      await send(app, DRAFT, { token: NEXT_LINK, key })
    ).json()) as { receiptToken: string }
    expect(other.receiptToken).not.toBe(mine.receiptToken)
  })
})

describe('고르는 목록', () => {
  const colleges = (app: ReturnType<typeof harness>['app'], token = LINK) =>
    app.request(`/api/public/surveys/colleges?surveyToken=${token}`)

  it('명단에 있는 단과대학만 고를 수 있다', async () => {
    const body = (await (await colleges(harness().app)).json()) as Array<{ value: string }>
    expect(body.map((row) => row.value)).toEqual(['공학대학', '소프트웨어융합대학'])
  })

  it('고른 단과대학의 학부만 온다', async () => {
    const res = await harness().app.request(
      `/api/public/surveys/departments?surveyToken=${LINK}&collegeId=${encodeURIComponent('소프트웨어융합대학')}`,
    )
    const body = (await res.json()) as Array<{ value: string }>
    expect(body.map((row) => row.value)).toEqual(['소프트웨어학부', '인공지능학과'])
  })

  // 계약이 이 자리에 404를 두지 않았다 — 답을 가려 주면 그것이 토큰이 있는지
  // 없는지를 알려 주는 자리가 된다.
  it('없는 토큰에도 빈 목록으로 답한다', async () => {
    const res = await colleges(harness().app, 'ZZZZZZZZZZZZZZZZZZZZZZ')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([])
  })
})
