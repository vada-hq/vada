import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import type { Db } from '../db/client.ts'
import { freshDb } from '../db/testing.ts'
import { purchaseRequests } from '../db/schema.ts'
import { NOW } from '../events/testing.ts'
import { CHAIR, MEMBER, post, seedPurchases } from './testing.ts'

// 결제·증빙 정리 끝내기(FIN-EVID-01의 `finance.purchaseRequest.completeEvidence`).
//
// **끝낼 수 있는지는 서버가 정한다** — 읽는 자리(`finance.paymentEvidenceSummary`)가 같은 셈으로
// 막는 이유를 글로 주고, 여기서는 같은 셈으로 막는다. 붙지 않은 서류가 있으면 422, 이미 끝났으면
// 409(계약의 repeat: conflict), 아직 결제·증빙 단계가 아니면 422다.

let db: Db
let close: () => Promise<void>

const COMPLETE = '/api/ops/finance/purchase-requests/evidence/complete'

type Row = Record<string, unknown>

const complete = (requestId: string, who = CHAIR) => post(db, COMPLETE, { requestId }, who)

beforeAll(async () => {
  const fresh = await freshDb()
  db = fresh.db as unknown as Db
  close = fresh.close
  await seedPurchases(db)
}, 60_000)

afterAll(async () => {
  await close()
})

describe('처리 완료(finance.purchaseRequest.completeEvidence)', () => {
  it('재정 권한이 없으면 막는다', async () => {
    expect((await complete('PR-05', MEMBER)).status).toBe(403)
  })

  it('붙지 않은 서류가 있으면 끝낼 수 없다 — 읽는 자리와 같은 말로 막는다', async () => {
    const res = await complete('PR-04')
    expect(res.status).toBe(422)
    expect(((await res.json()) as Row).message).toBe('증빙 서류 1건이 아직 등록되지 않았습니다.')
    expect((await db.select().from(purchaseRequests).where(eq(purchaseRequests.id, 'PR-04')))[0]!.stage).toBe('proof')
  })

  it('서류가 다 붙었으면 처리 완료로 옮긴다', async () => {
    const res = await complete('PR-05')
    const answer = await res.text()
    expect(res.status, answer).toBe(200)
    expect(JSON.parse(answer)).toEqual({})
    expect((await db.select().from(purchaseRequests).where(eq(purchaseRequests.id, 'PR-05')))[0]).toMatchObject({
      stage: 'settled',
      evidenceCompletedAt: NOW,
    })
  })

  it('이미 처리 완료된 요청을 또 완료할 수 없다(409)', async () => {
    expect((await complete('PR-05')).status).toBe(409)
    expect((await complete('PR-06')).status).toBe(409)
  })

  it('아직 결제·증빙 단계가 아닌 요청은 끝낼 수 없다(422)', async () => {
    expect((await complete('PR-01')).status).toBe(422)
    expect((await complete('PR-03')).status).toBe(422)
    expect((await complete('PR-07')).status).toBe(422)
  })

  it('없는 요청·남의 학생회 요청은 없다고 답한다', async () => {
    expect((await complete('PR-없음')).status).toBe(404)
    expect((await complete('PR-99')).status).toBe(404)
    expect((await complete('')).status).toBe(404)
  })
})
