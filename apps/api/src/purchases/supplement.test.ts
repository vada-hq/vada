import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import type { Db } from '../db/client.ts'
import { freshDb } from '../db/testing.ts'
import { purchaseRequestItems, purchaseRequests } from '../db/schema.ts'
import { matchesContract } from '../events/testing.ts'
import { ask, MEMBER, OTHER, post, seedPurchases } from './testing.ts'

// 보완 요청 확인·재제출(FIN-SUP-01) — 읽기 넷과 쓰기 둘.
//
// 이 파일이 재는 것이 다섯이다.
//
// 1. **보완이 걸리지 않은 요청에는 보완 요청이 없다**(404). 있으면 누가 언제 걸었고 언제까지
//    다시 내야 하는지가 완성된 문구로 온다.
// 2. **보완 품목은 판정이 보완인 품목이다.** 분류는 코드가 아니라 명세의 말로 온다.
// 3. **다시 받을 칸과 파일 자리는 비어 있다.** 재정부가 무엇을 다시 묻는지 적는 자리가 FIN-REV-01에
//    없고(판정과 승인액뿐), 명세도 유형별 칸 목록을 들지 않는다 — 지어내지 않고 빈 목록이다.
// 4. **답변은 품목에 남고, 재제출하면 보완이 풀린다.** 걸린 때가 지워져 상태가 검토 대기로 돌아가고
//    보완이던 품목은 판정 없는 품목이 된다 — 재정부가 다시 본다.
// 5. **요청자만 쓴다.** 남의 요청에 답을 적을 수 없다.

let db: Db
let close: () => Promise<void>

const HEAD = '/api/ops/finance/purchase-requests/supplement'
const ITEMS = '/api/ops/finance/purchase-requests/supplement/items'
const FIELDS = '/api/ops/finance/purchase-requests/supplement/fields'
const ATTACHMENTS = '/api/ops/finance/purchase-requests/supplement/attachments'
const SAVE = '/api/ops/finance/purchase-requests/supplement/drafts'
const RESUBMIT = '/api/ops/finance/purchase-requests/supplement/resubmit'

type Row = Record<string, unknown>

let keys = 0
const withKey = () => ({ 'Idempotency-Key': `key-${(keys += 1)}` })

/** FIN-SUP-01이 값을 담는 꼴 — `품목.묶음.칸`. */
const ANSWERS = {
  requestId: 'PR-02',
  'PRI-04.corrections.size': 'A4 (210×297mm)',
  'PRI-04.corrections.color': '단색(검정)',
  'PRI-04.attachments.quote': '견적서',
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

describe('보완 요청의 머리(finance.supplementRequest)', () => {
  it('누가 언제 걸었고 언제까지 다시 내야 하는지가 완성된 문구로 온다', async () => {
    const res = await ask(db, `${HEAD}?requestId=PR-02`)
    expect(res.status).toBe(200)
    const body = (await res.json()) as Row
    expect(matchesContract('finance.supplementRequest', body)).toBe(true)
    expect(body).toEqual({
      reviewerNote: '요청 담당자 김바다',
      requestedAtNote: '보완 요청일 2026-03-03',
      dueNote: '재제출 권장 기한 2026-03-07',
    })
  })

  it('보완이 걸리지 않은 요청에는 보완 요청이 없다', async () => {
    const res = await ask(db, `${HEAD}?requestId=PR-01`)
    expect(res.status).toBe(404)
    expect(((await res.json()) as Row).message).toContain('보완')
    expect((await ask(db, `${HEAD}?requestId=PR-없음`)).status).toBe(404)
    expect((await ask(db, `${HEAD}?requestId=PR-99`)).status).toBe(404)
  })
})

describe('보완 품목(finance.supplementItems)', () => {
  it('판정이 보완인 품목만 완성된 글로 온다 — 분류는 명세의 말이다', async () => {
    const res = await ask(db, `${ITEMS}?requestId=PR-02`)
    expect(res.status).toBe(200)
    const body = (await res.json()) as Row[]
    expect(matchesContract('finance.supplementItems', body)).toBe(true)
    expect(body).toEqual([
      {
        id: 'PRI-04',
        title: '보완 품목 — 이름표 용지',
        categoryNote: '인쇄물 · 홍보비',
        reason: '규격과 인쇄 사양을 적어 주세요',
        name: '이름표 용지',
        quantityNote: '200장',
        unitPriceNote: '300원',
        amountNote: '60,000원',
        budgetItem: '홍보비',
      },
    ])
  })

  it('보완이 걸린 품목이 없으면 빈 목록이다 — 그것은 참이다', async () => {
    expect(await (await ask(db, `${ITEMS}?requestId=PR-01`)).json()).toEqual([])
    expect((await ask(db, `${ITEMS}?requestId=PR-99`)).status).toBe(404)
  })
})

describe('다시 받을 칸과 파일 자리(finance.supplementInputFields · supplementAttachments)', () => {
  // 재정부가 무엇을 다시 묻는지 적는 자리가 FIN-REV-01에 없다. 지어내지 않는다.
  it('아직 정해진 칸이 없어 빈 목록이다', async () => {
    const fields = await ask(db, `${FIELDS}?itemId=PRI-04`)
    expect(fields.status).toBe(200)
    const body = (await fields.json()) as Row[]
    expect(matchesContract('finance.supplementInputFields', body)).toBe(true)
    expect(body).toEqual([])
    expect(await (await ask(db, `${ATTACHMENTS}?itemId=PRI-04`)).json()).toEqual([])
  })

  it('없는 품목은 없다고 답한다', async () => {
    expect((await ask(db, `${FIELDS}?itemId=PRI-없음`)).status).toBe(404)
    expect((await ask(db, FIELDS)).status).toBe(404)
    expect((await ask(db, `${ATTACHMENTS}?itemId=PRI-없음`)).status).toBe(404)
  })
})

describe('보완 답변 임시 저장(finance.purchaseRequest.saveSupplement)', () => {
  it('답변이 그 품목에 남고 요청은 그대로다', async () => {
    const res = await post(db, SAVE, ANSWERS)
    const answer = await res.text()
    expect(res.status, answer).toBe(200)
    expect(JSON.parse(answer)).toEqual({})
    const [item] = await db.select().from(purchaseRequestItems).where(eq(purchaseRequestItems.id, 'PRI-04'))
    expect(item!.supplementAnswers).toEqual({
      corrections: { size: 'A4 (210×297mm)', color: '단색(검정)' },
      attachments: { quote: '견적서' },
    })
    expect(item!.reviewResult).toBe('supplement')
    const [request] = await db.select().from(purchaseRequests).where(eq(purchaseRequests.id, 'PR-02'))
    expect(request!.supplementRequestedAt).not.toBeNull()
  })

  it('덮어쓰기다 — 다시 저장하면 앞의 답이 사라진다', async () => {
    const res = await post(db, SAVE, { requestId: 'PR-02', 'PRI-04.corrections.size': 'A3' })
    expect(res.status).toBe(200)
    const [item] = await db.select().from(purchaseRequestItems).where(eq(purchaseRequestItems.id, 'PRI-04'))
    expect(item!.supplementAnswers).toEqual({ corrections: { size: 'A3' }, attachments: {} })
  })

  it('보완이 걸리지 않은 요청·남의 요청·없는 요청에는 적을 수 없다', async () => {
    expect((await post(db, SAVE, { requestId: 'PR-01' })).status).toBe(422)
    expect((await post(db, SAVE, ANSWERS, OTHER)).status).toBe(422)
    expect((await post(db, SAVE, { requestId: 'PR-없음' })).status).toBe(404)
    expect((await post(db, SAVE, {})).status).toBe(404)
    expect((await post(db, SAVE, { requestId: 'PR-02', 'PRI-04.corrections.size': 42 })).status).toBe(422)
  })
})

describe('재제출(finance.purchaseRequest.resubmitSupplement)', () => {
  it('멱등 키 없이는 받지 않는다', async () => {
    expect((await post(db, RESUBMIT, ANSWERS)).status).toBe(422)
  })

  it('남의 요청은 재제출할 수 없다', async () => {
    expect((await post(db, RESUBMIT, ANSWERS, OTHER, withKey())).status).toBe(422)
  })

  it('재제출하면 보완이 풀리고 보완이던 품목은 다시 판정을 기다린다', async () => {
    const res = await post(db, RESUBMIT, ANSWERS, MEMBER, withKey())
    expect(res.status, await res.text()).toBe(200)

    const [request] = await db.select().from(purchaseRequests).where(eq(purchaseRequests.id, 'PR-02'))
    expect(request).toMatchObject({ stage: 'review', supplementRequestedAt: null, supplementDueOn: null })
    const [asked] = await db.select().from(purchaseRequestItems).where(eq(purchaseRequestItems.id, 'PRI-04'))
    expect(asked).toMatchObject({
      reviewResult: null,
      approvedAmount: null,
      supplementAnswers: { corrections: { size: 'A4 (210×297mm)', color: '단색(검정)' }, attachments: { quote: '견적서' } },
    })
    // 승인됐던 품목은 그대로다.
    const [approved] = await db.select().from(purchaseRequestItems).where(eq(purchaseRequestItems.id, 'PRI-03'))
    expect(approved).toMatchObject({ reviewResult: 'approved', approvedAmount: 50_000 })

    // 이제 보완 요청이 없다.
    expect((await ask(db, `${HEAD}?requestId=PR-02`)).status).toBe(404)
    expect(await (await ask(db, `${ITEMS}?requestId=PR-02`)).json()).toEqual([])
  })

  it('보완이 걸리지 않은 요청은 재제출할 것이 없다(422)', async () => {
    expect((await post(db, RESUBMIT, ANSWERS, MEMBER, withKey())).status).toBe(422)
  })
})
