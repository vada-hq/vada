import assert from 'node:assert/strict'
import type { PurchaseRequestDetail } from '@vada/contracts'
import { createApp } from '../app.js'
import { createBudgetRoutes } from '../budget/routes.js'
import { createChatRoutes } from '../chat/routes.js'
import { createExpenseRoutes } from '../expenses/routes.js'
import { createTestDb } from '../db/test-db.js'
import type { RateLimiter } from '../http/rate-limit.js'
import { createPurchasePush } from '../purchases/notify.js'
import { createPurchaseRoutes } from '../purchases/routes.js'
import { createPurchaseWriteLimiter } from '../purchases/write-limit.js'
import type { PushSender } from '../push/sender.js'
import { clockNow, createRecord } from '../records/records.js'
import { seedCouncil } from './council.js'
import { caller, ORIGIN, testSession } from './http.js'
import { createTaskRoutes } from '../tasks/routes.js'
import { fakeStorage } from './storage.js'

// 한국 시각 2026-10-25 12:00
const noon = new Date('2026-10-25T03:00:00Z')
export const MISSING = '019e0000-0000-7000-8000-000000000000'
export const endpointOf = (user: string) => `https://fcm.googleapis.com/fcm/send/${user}`
export const ITEM = { name: '화이트보드 마커', quantity: 3 }

export const errorOf = async (response: Response) =>
  ((await response.json()) as { error: string }).error
export const detailOf = async (response: Response) =>
  ((await response.json()) as { request: PurchaseRequestDetail }).request

// 구매 요청 시험의 바탕: 학생회 둘(내 것 's', 다른 것 'o'), 모든 사람의 기기 하나씩, 알림 보내기를 기록하는 가짜 보내기.
export async function startPurchases(
  options: {
    withPush?: boolean
    limiter?: RateLimiter
    uploadLimiter?: RateLimiter
    noStorage?: boolean
  } = {},
) {
  const { pg, db, close } = await createTestDb()
  const council = await seedCouncil(db, pg)
  const other = await seedCouncil(db, pg, 'o')
  // 시험이 시계를 옮길 수 있다(한국 날짜 경계).
  let now = noon
  const clock = () => now
  const calls: Parameters<PushSender>[] = []
  let gate: Promise<void> = Promise.resolve()
  const send: PushSender = async (...args) => {
    calls.push(args)
    await gate
    return { result: 'sent' }
  }
  const pending: Promise<void>[] = []
  const purchasePush = createPurchasePush(db, send)
  const push = {
    notify: (notice: Parameters<typeof purchasePush.notify>[0]) => {
      const done = purchasePush.notify(notice)
      pending.push(done)
      return done
    },
  }
  for (const person of [...Object.values(council.people), ...Object.values(other.people)])
    await pg.query(
      'INSERT INTO push_device (user_id, endpoint, p256dh, auth) VALUES ($1,$2,$3,$4)',
      [person.userId, endpointOf(person.userId), 'p', 'a'],
    )
  // 서버처럼 요청 내기와 지출 적기가 한도 하나를 같이 쓴다.
  const writeLimiter = options.limiter ?? createPurchaseWriteLimiter()
  const store = fakeStorage()
  const api = caller(
    createApp({
      auth: { handler: async () => new Response() },
      trustedOrigin: ORIGIN,
      purchases: createPurchaseRoutes(db, testSession, {
        clock,
        ...(options.withPush === false ? {} : { push }),
        writeLimiter,
      }),
      budget: createBudgetRoutes(db, testSession, { clock }),
      tasks: createTaskRoutes(db, testSession, { clock }),
      chat: createChatRoutes(db, testSession, { clock, storage: store.storage }),
      expenses: createExpenseRoutes(db, testSession, {
        receiptKey: 'test-receipt-key',
        clock,
        writeLimiter,
        ...(options.noStorage ? {} : { storage: store.storage }),
        ...(options.uploadLimiter ? { uploadLimiter: options.uploadLimiter } : {}),
      }),
    }),
  )
  const base = `/api/organizations/${council.councilId}/purchase-requests`
  const count = async (sql: string, params: unknown[] = []) =>
    Number(((await pg.query(sql, params)).rows[0] as { n: string }).n)
  const create = async (body: unknown, user = 's-planningMember') => {
    const response = await api.post(base, body, user)
    await Promise.all(pending)
    return response
  }
  const made = async (
    body: unknown = { title: '마커', items: [ITEM] },
    user = 's-planningMember',
  ) => {
    const response = await create(body, user)
    assert.equal(response.status, 201)
    return detailOf(response)
  }
  // 결재 결과(승인, 반려, 승인 뒤 취소)를 시험이 결재 기록으로 직접 남긴다.
  const decide = (
    itemId: string,
    outcome: 'approved' | 'rejected' | 'cancelled',
    by = 'financeMember',
  ) =>
    db.transaction(tx =>
      createRecord(tx, {
        kind: 'approval',
        councilId: council.councilId,
        actor: council.people[by as 'financeMember'].memberId,
        values: {
          targetId: itemId,
          targetKind: 'line_item',
          outcome,
          actorId: council.people[by as 'financeMember'].memberId,
          actorKind: 'member',
          actedAt: clockNow,
          reason: outcome === 'approved' ? null : outcome === 'rejected' ? '비싸요' : '사지 않아요',
        },
      }),
    )
  return {
    pg,
    db,
    council,
    other,
    api,
    base,
    store,
    calls,
    setNow: (value: Date) => {
      now = value
    },
    count,
    create,
    made,
    decide,
    // 보내기를 끝나지 않게 묶고, 푸는 함수를 돌려준다.
    hold: () => {
      let release = () => {}
      gate = new Promise<void>(resolve => (release = resolve))
      return release
    },
    settled: () => Promise.all(pending),
    notices: () => count('SELECT count(*) AS n FROM notification'),
    versions: (id: string) =>
      count('SELECT count(*) AS n FROM record_version WHERE record_id = $1', [id]),
    close,
  }
}
export type PurchaseKit = Awaited<ReturnType<typeof startPurchases>>

export const runPurchases = (body: (s: PurchaseKit) => Promise<void>) => async () => {
  const s = await startPurchases()
  try {
    await body(s)
  } finally {
    await s.close()
  }
}
