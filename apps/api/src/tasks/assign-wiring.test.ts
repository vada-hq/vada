import assert from 'node:assert/strict'
import { test } from 'node:test'
import { appModulesOf } from '../app-modules.js'
import { createApp } from '../app.js'
import { createTestDb } from '../db/test-db.js'
import { createPurchaseWriteLimiter } from '../purchases/write-limit.js'
import { seedCouncil } from '../test-support/council.js'
import { caller, ORIGIN, testSession } from '../test-support/http.js'
import { ASSIGNMENT_NOTICE_DELAY_MS, type AfterTimer } from './notify.js'

// serve.ts가 넘기는 타이머가 앱 모듈을 거쳐 배정 알림 모으기까지 닿는지 본다(이은 곳).
test('앱 모듈에 넣은 타이머가 배정 알림을 10초 모으는 데 쓰인다', async () => {
  const { pg, db, close } = await createTestDb()
  try {
    const council = await seedCouncil(db, pg)
    const delays: number[] = []
    const after: AfterTimer = ms => {
      delays.push(ms)
      return () => {}
    }
    const modules = appModulesOf(db, testSession, {
      trustedOrigin: ORIGIN,
      clock: () => new Date('2026-10-25T03:00:00Z'),
      writeLimiter: createPurchaseWriteLimiter(),
      receiptKey: 'test-receipt-key',
      push: { publicKey: 'PUBLIC', send: async () => ({ result: 'sent' }), after },
    })
    const api = caller(
      createApp({
        auth: { handler: async () => new Response() },
        trustedOrigin: ORIGIN,
        ...modules,
      }),
    )
    const response = await api.post(
      `/api/organizations/${council.councilId}/tasks`,
      { title: 'a', assigneeId: council.people.planningMember.memberId },
      's-president',
    )
    assert.equal(response.status, 201)
    assert.deepEqual(delays, [ASSIGNMENT_NOTICE_DELAY_MS])
  } finally {
    await close()
  }
})
