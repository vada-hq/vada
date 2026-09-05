import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import type { Db } from '../db/client.ts'
import { freshDb } from '../db/testing.ts'
import { purchaseRequestItems, purchaseRequests } from '../db/schema.ts'
import { NOW } from '../events/testing.ts'
import { CHAIR, MEMBER, post, seedPurchases, STRANGER } from './testing.ts'

// 검토 결과 보내기(FIN-REV-01의 `finance.purchaseRequest.sendReview`).
//
// **보내는 일은 하나인데 결과가 둘이다** — 명세가 그렇게 적었다. 보완이 하나라도 있으면 나가는
// 것이 보완 요청이고(단계는 검토 그대로, 걸린 때가 찍힌다), 아니면 검토가 끝난 것이다(구매로).
//
// 이 파일이 재는 것이 다섯이다.
//
// 1. **판정의 단위가 품목이다.** 품목마다 판정과 승인액이 담기고, 안 보낸 승인액은 화면이 보여 주던
//    처음 값(요청액)으로 든다 — 승인액은 요청액에서 시작한다(`finance/review.ts`).
// 2. **하나라도 판정하지 않았으면 422다.** 반쯤 보낸 판정은 판정이 아니다.
// 3. **보완·반려된 품목에는 승인액이 없다.** 승인액을 더하는 자리(`totalApproved`)가 그것을 승인된
//    돈으로 세기 때문이다.
// 4. **이미 판정을 보낸 요청에는 또 보낼 수 없다**(409). 보완을 기다리는 요청도 같다.
// 5. **재정 권한이 있어야 한다.** 부원은 403이다.

let db: Db
let close: () => Promise<void>

const REVIEW = '/api/ops/finance/purchase-requests/review'

type Row = Record<string, unknown>

const send = (body: unknown, who = CHAIR) => post(db, REVIEW, body, who)

async function requestRow(id: string) {
  return (await db.select().from(purchaseRequests).where(eq(purchaseRequests.id, id)))[0]!
}
async function itemRow(id: string) {
  return (await db.select().from(purchaseRequestItems).where(eq(purchaseRequestItems.id, id)))[0]!
}

beforeAll(async () => {
  const fresh = await freshDb()
  db = fresh.db as unknown as Db
  close = fresh.close
  await seedPurchases(db)
}, 60_000)

afterAll(async () => {
  await close()
})

describe('검토 결과 보내기(finance.purchaseRequest.sendReview)', () => {
  it('재정 권한이 없으면 막는다', async () => {
    expect((await send({ requestId: 'PR-01', 'reviews.PRI-01.result': 'approved' }, MEMBER)).status).toBe(403)
  })

  it('하나라도 판정하지 않은 품목이 있으면 422이고 아무것도 바뀌지 않는다', async () => {
    const res = await send({ requestId: 'PR-01', 'reviews.PRI-01.result': 'approved', 'reviews.PRI-01.approvedAmount': '9000' })
    expect(res.status).toBe(422)
    expect(((await res.json()) as Row).message).toContain('판정')
    expect((await requestRow('PR-01')).stage).toBe('review')
    expect((await itemRow('PRI-01')).reviewResult).toBeNull()
  })

  it('모르는 판정 값과 수가 아닌 승인액은 422다', async () => {
    const both = { requestId: 'PR-01', 'reviews.PRI-02.result': 'approved' }
    expect((await send({ ...both, 'reviews.PRI-01.result': '승인' })).status).toBe(422)
    expect((await send({ ...both, 'reviews.PRI-01.result': 'approved', 'reviews.PRI-01.approvedAmount': '구천' })).status).toBe(422)
    expect((await send({ ...both, 'reviews.PRI-01.result': 'approved', 'reviews.PRI-01.approvedAmount': '-1' })).status).toBe(422)
  })

  it('전부 승인이면 검토가 끝나 구매로 넘어간다 — 안 보낸 승인액은 요청액이다', async () => {
    const res = await send({
      requestId: 'PR-01',
      'reviews.PRI-01.result': 'approved',
      'reviews.PRI-01.approvedAmount': '9000',
      // PRI-02는 판정만 보낸다. 화면이 보여 주던 처음 값(요청액 25,000)이 승인액이다.
      'reviews.PRI-02.result': 'approved',
    })
    expect(res.status, await res.text()).toBe(200)
    expect(await requestRow('PR-01')).toMatchObject({
      stage: 'purchase',
      reviewedAt: NOW,
      reviewedByMemberId: 'M-02',
      supplementRequestedAt: null,
    })
    expect(await itemRow('PRI-01')).toMatchObject({ reviewResult: 'approved', approvedAmount: 9_000 })
    expect(await itemRow('PRI-02')).toMatchObject({ reviewResult: 'approved', approvedAmount: 25_000 })
  })

  it('보완이 하나라도 있으면 보완 요청이다 — 단계는 검토 그대로이고 걸린 때가 찍힌다', async () => {
    const res = await send({ requestId: 'PR-09', 'reviews.PRI-10.result': 'supplement', 'reviews.PRI-10.approvedAmount': '40000' })
    expect(res.status, await res.text()).toBe(200)
    expect(await requestRow('PR-09')).toMatchObject({
      stage: 'review',
      supplementRequestedAt: NOW,
      reviewedByMemberId: 'M-02',
      // 검토가 끝난 것이 아니다.
      reviewedAt: null,
      // 언제까지 다시 내라는지는 이 화면에 적는 자리가 없다. 지어내지 않는다.
      supplementDueOn: null,
    })
    // 보완이 걸린 품목의 승인액은 없다 — 아직 승인된 돈이 아니다.
    expect(await itemRow('PRI-10')).toMatchObject({ reviewResult: 'supplement', approvedAmount: null })
  })

  it('계약이 적은 모양(줄 배열)으로 보내도 같고, 반려된 품목에는 승인액이 없다', async () => {
    const res = await send({
      requestId: 'PR-10',
      reviews: [
        { id: 'PRI-11', result: 'approved', approvedAmount: 8000 },
        { id: 'PRI-12', result: 'rejected', approvedAmount: 30000 },
      ],
    })
    expect(res.status, await res.text()).toBe(200)
    // 보완이 없으니 검토가 끝났다 — 반려가 섞여도 승인된 것을 사러 간다.
    expect(await requestRow('PR-10')).toMatchObject({ stage: 'purchase', reviewedAt: NOW })
    expect(await itemRow('PRI-11')).toMatchObject({ reviewResult: 'approved', approvedAmount: 8_000 })
    expect(await itemRow('PRI-12')).toMatchObject({ reviewResult: 'rejected', approvedAmount: null })
  })

  it('이미 판정을 보낸 요청에는 또 보낼 수 없다(409) — 보완을 기다리는 요청도 같다', async () => {
    expect((await send({ requestId: 'PR-01', 'reviews.PRI-01.result': 'approved', 'reviews.PRI-02.result': 'approved' })).status).toBe(409)
    expect((await send({ requestId: 'PR-03', 'reviews.PRI-05.result': 'approved' })).status).toBe(409)
    expect((await send({ requestId: 'PR-02', 'reviews.PRI-03.result': 'approved', 'reviews.PRI-04.result': 'approved' })).status).toBe(409)
  })

  it('아직 제출되지 않은 초안에는 판정을 보낼 수 없다(422)', async () => {
    expect((await send({ requestId: 'PR-07', 'reviews.PRI-09.result': 'approved' })).status).toBe(422)
  })

  it('없는 요청·남의 학생회 요청은 없다고 답한다', async () => {
    expect((await send({ requestId: 'PR-없음' })).status).toBe(404)
    expect((await send({ requestId: 'PR-99' })).status).toBe(404)
    expect((await send({})).status).toBe(404)
    expect((await send({ requestId: 'PR-99', 'reviews.x.result': 'approved' }, STRANGER)).status).toBe(422)
  })
})
