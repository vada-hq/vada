import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import type { EventsResponse, PublicRegistrationForm } from '@vada/contracts'
import { appModulesOf } from './app-modules.js'
import { createApp } from './app.js'
import { createTestDb, type TestDb } from './db/test-db.js'
import type { RateLimiter } from './http/rate-limit.js'
import { createRecord } from './records/records.js'
import { seedCouncil } from './test-support/council.js'
import { caller, ORIGIN, testSession } from './test-support/http.js'

// 한국 시각 2026-10-25 12:00. 기본 기수는 2026-01-01부터 12-31까지다.
const NOON = new Date('2026-10-25T03:00:00Z')
const DAY = 24 * 60 * 60 * 1000
const CODE = 'AAAAAAA2'

let testDb: TestDb
let council: Awaited<ReturnType<typeof seedCouncil>>
let now = NOON
let takes: string[] = []
const limiter: RateLimiter = {
  take(key) {
    takes.push(key)
    return true
  },
}
let api: ReturnType<typeof caller>

before(async () => {
  testDb = await createTestDb()
  council = await seedCouncil(testDb.db, testDb.pg)
  const modules = appModulesOf(testDb.db, testSession, {
    clock: () => now,
    writeLimiter: limiter,
    receiptKey: 'test-receipt-key',
  })
  api = caller(
    createApp({ auth: { handler: async () => new Response() }, trustedOrigin: ORIGIN, ...modules }),
  )
  const actor = council.people.president.memberId
  const eventId = await testDb.db.transaction(tx =>
    createRecord(tx, {
      kind: 'event',
      councilId: council.councilId,
      actor,
      values: {
        name: '가을 축제',
        startsAt: new Date('2026-10-25T00:00:00Z'),
        endsAt: new Date('2026-10-25T08:00:00Z'),
      },
    }),
  )
  await testDb.db.transaction(tx =>
    createRecord(tx, {
      kind: 'registration_form',
      councilId: council.councilId,
      actor,
      values: {
        eventId,
        name: '신청',
        closesAt: new Date(NOON.getTime() + DAY / 2),
        publicCode: CODE,
      },
    }),
  )
})
after(() => testDb.close())

const org = () => `/api/organizations/${council.councilId}`
const president = () => council.people.president.userId
const finance = () => council.people.financeMember.userId

async function statuses() {
  const events = (await (await api.get(`${org()}/events`, president())).json()) as EventsResponse
  const form = (await (
    await api.get(`/api/public/registration-forms/${CODE}`)
  ).json()) as PublicRegistrationForm
  const expense = await api.post(
    `${org()}/expenses`,
    { vendor: '문구점', description: '마커', amount: 1000, paidOn: '2026-10-26' },
    finance(),
  )
  return { event: events.events[0]?.status, form: form.status, expense: expense.status }
}

test('시계를 하루 미루면 행사 상태, 신청 받는 중, 결제일 검사가 함께 그 시각을 쓴다', async () => {
  now = NOON
  assert.deepEqual(await statuses(), { event: 'ongoing', form: 'open', expense: 400 })
  now = new Date(NOON.getTime() + DAY)
  const shifted = await statuses()
  assert.equal(shifted.event, 'ended')
  assert.equal(shifted.form, 'closed')
  // 내일이던 결제일이 오늘이 되어 날짜 검사는 지나간다.
  assert.notEqual(shifted.expense, 400)
})

test('요청 내기와 지출 적기가 쓰기 한도 하나를 같이 쓴다', async () => {
  now = NOON
  takes = []
  await api.post(
    `${org()}/purchase-requests`,
    { title: '마커', items: [{ name: '마커', quantity: 1 }] },
    finance(),
  )
  assert.equal(takes.length, 1)
  await api.post(
    `${org()}/expenses`,
    { vendor: '문구점', description: '마커', amount: 1000, paidOn: '2026-10-25' },
    finance(),
  )
  assert.equal(takes.length, 2)
  assert.equal(takes[0], takes[1])
})
