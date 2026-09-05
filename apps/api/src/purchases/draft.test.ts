import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { and, eq } from 'drizzle-orm'
import type { Db } from '../db/client.ts'
import { freshDb } from '../db/testing.ts'
import { purchaseRequestItems, purchaseRequests } from '../db/schema.ts'
import { harness, matchesContract, NOW } from '../events/testing.ts'
import {
  ask,
  CHAIR,
  flatDraft,
  FULL_DRAFT,
  FULL_ITEM,
  MEMBER,
  OTHER,
  post,
  seedPurchases,
  STRANGER,
} from './testing.ts'

// 구매 요청 작성·수정(FIN-REQ-01)의 네 자리 — 초안 읽기 · 예산 항목 고르기 · 임시 저장 · 제출.
//
// 이 파일이 재는 것이 여섯이다.
//
// 1. **요청 id 없이 열면 아직 아무것도 적히지 않은 요청이 온다.** 그때도 서버가 이미 아는 것
//    (작성자의 소속 부서)은 채워져 온다. 품목 한 줄은 minItems가 정한다.
// 2. **임시 저장은 덮어쓰기다.** 처음 저장하면 줄이 생기고 그 이름표가 돌아온다 — 그것을 들고
//    다시 저장하면 같은 줄이 바뀐다. 다 채우지 않아도 보관한다.
// 3. **값은 코드다.** 카테고리·유형·우선순위·견적 상태는 명세의 고정 목록의 값이고, 목록에 없는
//    값은 422다 — 글('소모품')을 값으로 보내면 막힌다.
// 4. **제출은 필수 칸을 요구한다.** 비면 422이고 아무것도 생기지 않는다.
// 5. **요청 번호를 서버가 만든다.** `PR-연도-일련번호`이고 일련번호는 학생회 안에서 그 해에 낸
//    순서다 — 표에서 센다.
// 6. **울타리가 선다.** 남의 초안은 고치지도 제출하지도 못하고, 남의 행사·남의 예산 항목에는
//    걸 수 없다.

let db: Db
let close: () => Promise<void>

const DRAFT = '/api/ops/finance/purchase-request-draft'
const OPTIONS = '/api/ops/finance/budget-items'
const SAVE = '/api/ops/finance/purchase-request-drafts'
const SUBMIT = '/api/ops/finance/purchase-requests'

type Row = Record<string, unknown>

// **이름표는 검사 전체에서 하나씩 는다.** 앱을 부를 때마다 새로 세우므로(harness) 번호가
// 처음부터면 앞서 만든 줄과 같은 이름이 나온다.
let made = 0
const newId = () => `NEW-${(made += 1)}`

let keys = 0
const withKey = () => ({ 'Idempotency-Key': `key-${(keys += 1)}` })

async function readDraft(eventId: string, requestId?: string): Promise<Row> {
  const query = requestId === undefined ? `eventId=${eventId}` : `eventId=${eventId}&requestId=${requestId}`
  const res = await ask(db, `${DRAFT}?${query}`)
  expect(res.status, `${DRAFT}?${query}가 ${res.status}로 답했다`).toBe(200)
  const body = (await res.json()) as Row
  expect(matchesContract('finance.purchaseRequestDraft', body)).toBe(true)
  return body
}

async function requestRow(id: string) {
  const rows = await db.select().from(purchaseRequests).where(eq(purchaseRequests.id, id))
  return rows[0]
}

async function itemsOf(requestId: string) {
  return db
    .select()
    .from(purchaseRequestItems)
    .where(and(eq(purchaseRequestItems.orgId, 'ORG-01'), eq(purchaseRequestItems.requestId, requestId)))
    .orderBy(purchaseRequestItems.sortOrder)
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

describe('작성·수정 초안(finance.purchaseRequestDraft)', () => {
  it('요청 id 없이 열면 아직 아무것도 적히지 않은 요청이 오고, 작성자의 부서와 품목 한 줄만 있다', async () => {
    expect(await readDraft('E-01')).toEqual({
      title: '',
      department: '운영부',
      neededOn: '',
      priority: '',
      purpose: '',
      items: [{ itemName: '', itemCategory: '', budgetItem: '', purchaseType: '', unit: '', quoteStatus: 'none' }],
    })
  })

  it('임시 저장한 요청을 열면 적어 둔 것이 그대로 온다 — 아직 안 적은 수는 오지 않는다', async () => {
    const draft = await readDraft('E-01', 'PR-07')
    expect(draft).toEqual({
      title: '임시 저장한 요청',
      department: '운영부',
      neededOn: '2026-04-01',
      priority: 'urgent',
      purpose: '아직 쓰는 중',
      items: [
        {
          itemName: '안내 팻말',
          itemCategory: 'supplies',
          budgetItem: 'B-01',
          purchaseType: '',
          quantity: 3,
          unit: '개',
          quoteStatus: 'none',
        },
      ],
    })
    expect(Object.hasOwn((draft.items as Row[])[0]!, 'unitPrice')).toBe(false)
  })

  // **값은 코드 그대로다.** 'supplies'를 '소모품'으로 풀어 주는 것은 화면의 일이다.
  it('카테고리·유형은 명세의 코드로, 판매처와 상품 URL은 적은 대로 온다', async () => {
    const draft = await readDraft('E-01', 'PR-01')
    expect((draft.items as Row[])[0]).toEqual({
      itemName: '박스테이프',
      itemCategory: 'supplies',
      budgetItem: 'B-01',
      purchaseType: 'online',
      quantity: 5,
      unit: '개',
      unitPrice: 2000,
      vendor: '쿠팡',
      productUrl: 'https://example.test/tape',
      quoteStatus: 'none',
    })
    expect((draft.items as Row[])[1]).toMatchObject({ itemCategory: 'food', purchaseType: 'offline', quoteStatus: 'received' })
  })

  it('없는 행사·남의 행사는 없다고 답한다', async () => {
    expect((await ask(db, `${DRAFT}?eventId=E-없음`)).status).toBe(404)
    expect((await ask(db, `${DRAFT}?eventId=E-99`)).status).toBe(404)
    expect((await ask(db, DRAFT)).status).toBe(404)
  })

  it('없는 요청·남의 학생회 요청·다른 행사의 요청은 없다고 답한다', async () => {
    expect((await ask(db, `${DRAFT}?eventId=E-01&requestId=PR-없음`)).status).toBe(404)
    expect((await ask(db, `${DRAFT}?eventId=E-99&requestId=PR-99`, STRANGER)).status).toBe(200)
    expect((await ask(db, `${DRAFT}?eventId=E-01&requestId=PR-99`)).status).toBe(404)
    // PR-07은 E-01의 요청이다. E-02로 열면 그 행사의 것이 아니다.
    expect((await ask(db, `${DRAFT}?eventId=E-02&requestId=PR-07`)).status).toBe(404)
  })
})

describe('예산 항목 고르기(finance.budgetItems.options)', () => {
  it('그 행사의 항목만 편성한 차례대로 온다', async () => {
    const res = await ask(db, `${OPTIONS}?eventId=E-01`)
    expect(res.status).toBe(200)
    const body = (await res.json()) as Row[]
    expect(matchesContract('finance.budgetItems.options', body)).toBe(true)
    expect(body).toEqual([
      { value: 'B-01', label: '행사 운영비' },
      { value: 'B-02', label: '홍보비' },
    ])
    expect(await (await ask(db, `${OPTIONS}?eventId=E-02`)).json()).toEqual([{ value: 'B-03', label: '봄 축제 물품비' }])
  })

  it('없는 행사·남의 행사는 없다고 답한다', async () => {
    expect((await ask(db, `${OPTIONS}?eventId=E-99`)).status).toBe(404)
    expect((await ask(db, OPTIONS)).status).toBe(404)
  })
})

describe('임시 저장(finance.purchaseRequest.saveDraft)', () => {
  let savedId: string

  it('새 초안을 저장하면 줄이 생기고 그 이름표가 온다', async () => {
    const res = await post(db, SAVE, flatDraft({ ...FULL_DRAFT, title: '한마당 안내 팻말' }), MEMBER, {}, { newId })
    const answer = (await res.json()) as Row
    expect(res.status, JSON.stringify(answer)).toBe(200)
    expect(typeof answer.id).toBe('string')
    savedId = String(answer.id)

    const row = await requestRow(savedId)
    expect(row).toMatchObject({
      orgId: 'ORG-01',
      eventId: 'E-01',
      stage: 'draft',
      code: null,
      submittedAt: null,
      title: '한마당 안내 팻말',
      priority: 'normal',
      // 요청자와 부서는 서버가 안다 — 몸통의 '운영부'를 믿은 것이 아니다.
      requesterMemberId: 'M-01',
      departmentId: 'D-01',
    })

    const draft = await readDraft('E-01', savedId)
    expect(draft).toMatchObject({
      title: '한마당 안내 팻말',
      department: '운영부',
      neededOn: '2026-08-12',
      priority: 'normal',
      purpose: '행사 당일 운영 및 물품 관리',
    })
    expect(draft.items).toEqual([
      {
        itemName: '박스테이프',
        itemCategory: 'supplies',
        budgetItem: 'B-01',
        purchaseType: 'online',
        quantity: 5,
        unit: '개',
        unitPrice: 2000,
        vendor: '쿠팡',
        productUrl: 'https://example.test/tape',
        option: '투명',
        deliveryNote: '학생회실 앞',
        quoteStatus: 'none',
      },
      expect.objectContaining({ itemName: '유성 마커', quantity: 10, unitPrice: 1500, budgetItem: 'B-02' }),
    ])
  })

  it('이름표를 들고 다시 저장하면 같은 줄을 덮어쓴다 — 줄이 늘지 않는다', async () => {
    const before = await db.select({ id: purchaseRequests.id }).from(purchaseRequests)
    const res = await post(
      db,
      SAVE,
      flatDraft({ ...FULL_DRAFT, requestId: savedId, title: '한마당 안내 팻말(수정)', items: [{ ...FULL_ITEM, quantity: 7 }] }),
      MEMBER,
      {},
      { newId },
    )
    expect(res.status, await res.text()).toBe(200)

    const draft = await readDraft('E-01', savedId)
    expect(draft.title).toBe('한마당 안내 팻말(수정)')
    expect(draft.items).toHaveLength(1)
    expect((draft.items as Row[])[0]).toMatchObject({ quantity: 7 })
    expect(await db.select({ id: purchaseRequests.id }).from(purchaseRequests)).toHaveLength(before.length)
  })

  // 임시 저장은 아직 넘기지 않았다는 뜻이다. 빈 칸은 빈 채로 남는다.
  it('다 채우지 않아도 보관한다 — 빈 품목 한 줄도 그대로 남는다', async () => {
    const res = await post(db, SAVE, flatDraft({ eventId: 'E-01', items: [{}] }), MEMBER, {}, { newId })
    const answer = (await res.json()) as Row
    expect(res.status, JSON.stringify(answer)).toBe(200)
    const draft = await readDraft('E-01', String(answer.id))
    expect(draft).toEqual({
      title: '',
      department: '운영부',
      neededOn: '',
      priority: '',
      purpose: '',
      items: [{ itemName: '', itemCategory: '', budgetItem: '', purchaseType: '', unit: '', quoteStatus: 'none' }],
    })
  })

  it('목록에 없는 값은 422다 — 글을 값으로 보내도 막힌다', async () => {
    const item = (over: Record<string, unknown>) => flatDraft({ eventId: 'E-01', items: [{ ...FULL_ITEM, ...over }] })
    expect((await post(db, SAVE, item({ itemCategory: '소모품' }))).status).toBe(422)
    expect((await post(db, SAVE, item({ purchaseType: '온라인 구매' }))).status).toBe(422)
    expect((await post(db, SAVE, item({ quoteStatus: 'maybe' }))).status).toBe(422)
    expect((await post(db, SAVE, flatDraft({ eventId: 'E-01', priority: '급함' }))).status).toBe(422)
  })

  it('이 행사의 것이 아닌 예산 항목은 422다 — 남의 학생회 것도 다른 행사 것도', async () => {
    const item = (budgetItem: string) => flatDraft({ eventId: 'E-01', items: [{ ...FULL_ITEM, budgetItem }] })
    expect((await post(db, SAVE, item('B-03'))).status).toBe(422)
    expect((await post(db, SAVE, item('B-04'))).status).toBe(422)
    expect((await post(db, SAVE, item('B-99'))).status).toBe(422)
    expect((await post(db, SAVE, item('B-없음'))).status).toBe(422)
  })

  it('수량·단가가 수가 아니거나 음수이거나 날짜 꼴이 아니면 422다', async () => {
    const item = (over: Record<string, unknown>) => flatDraft({ eventId: 'E-01', items: [{ ...FULL_ITEM, ...over }] })
    expect((await post(db, SAVE, item({ quantity: '다섯' }))).status).toBe(422)
    expect((await post(db, SAVE, item({ quantity: -1 }))).status).toBe(422)
    expect((await post(db, SAVE, item({ unitPrice: 1.5 }))).status).toBe(422)
    expect((await post(db, SAVE, flatDraft({ eventId: 'E-01', neededOn: '2026. 08. 12' }))).status).toBe(422)
    expect((await post(db, SAVE, flatDraft({ eventId: 'E-01', neededOn: '2026-02-30' }))).status).toBe(422)
  })

  it('행사가 없거나 남의 것이면 422다', async () => {
    expect((await post(db, SAVE, flatDraft({ title: '행사 없음' }))).status).toBe(422)
    expect((await post(db, SAVE, flatDraft({ eventId: 'E-99', title: '남의 행사' }))).status).toBe(422)
  })

  it('남이 쓰던 초안은 고칠 수 없고, 이미 제출한 요청은 임시 저장할 수 없다', async () => {
    expect((await post(db, SAVE, flatDraft({ ...FULL_DRAFT, requestId: 'PR-08' }))).status).toBe(422)
    expect((await post(db, SAVE, flatDraft({ ...FULL_DRAFT, requestId: 'PR-01' }))).status).toBe(422)
    // 남의 학생회 요청은 없는 것이다.
    expect((await post(db, SAVE, flatDraft({ ...FULL_DRAFT, requestId: 'PR-99' }))).status).toBe(404)
    // 다른 행사의 초안을 이 행사로 저장할 수 없다.
    expect((await post(db, SAVE, flatDraft({ ...FULL_DRAFT, eventId: 'E-02', requestId: 'PR-07' }))).status).toBe(422)
    expect((await requestRow('PR-08'))?.title).toBe('남이 쓰던 초안')
  })

  it('몸통이 모양이 아니면 422다', async () => {
    expect((await post(db, SAVE, [])).status).toBe(422)
    expect((await post(db, SAVE, '{이건 json이 아니다')).status).toBe(422)
    expect((await post(db, SAVE, { ...flatDraft(FULL_DRAFT), items: 42 })).status).toBe(422)
  })

  it('구성원이 아니면 막는다', async () => {
    expect((await post(db, SAVE, flatDraft(FULL_DRAFT), null)).status).toBe(401)
  })
})

describe('제출(finance.purchaseRequest.submit)', () => {
  it('멱등 키 없이는 받지 않는다', async () => {
    expect((await post(db, SUBMIT, flatDraft(FULL_DRAFT))).status).toBe(422)
  })

  it('필수 칸이 비면 422이고 아무것도 생기지 않는다', async () => {
    const before = (await db.select({ id: purchaseRequests.id }).from(purchaseRequests)).length
    const submit = (draft: Record<string, unknown>) => post(db, SUBMIT, draft, MEMBER, withKey(), { newId })
    expect((await submit(flatDraft({ ...FULL_DRAFT, title: '' }))).status).toBe(422)
    expect((await submit(flatDraft({ ...FULL_DRAFT, neededOn: undefined }))).status).toBe(422)
    expect((await submit(flatDraft({ ...FULL_DRAFT, purpose: '  ' }))).status).toBe(422)
    expect((await submit(flatDraft({ ...FULL_DRAFT, items: [] }))).status).toBe(422)
    expect((await submit(flatDraft({ ...FULL_DRAFT, items: [{ ...FULL_ITEM, quantity: undefined }] }))).status).toBe(422)
    expect((await submit(flatDraft({ ...FULL_DRAFT, items: [{ ...FULL_ITEM, budgetItem: '' }] }))).status).toBe(422)
    expect((await submit(flatDraft({ ...FULL_DRAFT, items: [{ ...FULL_ITEM, unit: '' }] }))).status).toBe(422)
    // 우선순위는 필수가 아니다(명세 required: false). 비어도 낼 수 있는지는 아래에서 잰다.
    expect((await db.select({ id: purchaseRequests.id }).from(purchaseRequests)).length).toBe(before)
  })

  it('제출하면 검토로 넘어가고 번호가 붙는다 — 그 해의 일련번호를 표에서 센다', async () => {
    // 학생회에 이미 PR-2026-0007이 있다(다른 행사). 다음은 0008이다.
    const res = await post(db, SUBMIT, flatDraft({ ...FULL_DRAFT, priority: undefined }), MEMBER, withKey(), { newId })
    const answer = (await res.json()) as Row
    expect(res.status, JSON.stringify(answer)).toBe(200)
    const id = String(answer.id)

    const row = await requestRow(id)
    expect(row).toMatchObject({
      stage: 'review',
      code: 'PR-2026-0008',
      submittedAt: NOW,
      requesterMemberId: 'M-01',
      departmentId: 'D-01',
      priority: null,
      supplementRequestedAt: null,
      reviewedAt: null,
    })
    expect(row?.neededOn?.toISOString()).toBe(new Date('2026-08-12T00:00:00+09:00').toISOString())
    expect((await itemsOf(id)).map((item) => [item.name, item.quantity, item.unitPrice, item.category, item.reviewResult])).toEqual([
      ['박스테이프', 5, 2000, 'supplies', null],
      ['유성 마커', 10, 1500, 'supplies', null],
    ])

    // 하나 더 내면 아홉이다.
    const second = await post(db, SUBMIT, flatDraft(FULL_DRAFT), MEMBER, withKey(), { newId })
    expect((await requestRow(String(((await second.json()) as Row).id)))?.code).toBe('PR-2026-0009')
  })

  it('임시 저장해 둔 초안을 제출하면 그 줄이 넘어간다', async () => {
    const res = await post(
      db,
      SUBMIT,
      flatDraft({ ...FULL_DRAFT, requestId: 'PR-07', title: '임시 저장했던 요청' }),
      MEMBER,
      withKey(),
      { newId },
    )
    expect(res.status, await res.text()).toBe(200)
    expect(await requestRow('PR-07')).toMatchObject({ stage: 'review', code: 'PR-2026-0010', title: '임시 저장했던 요청' })
  })

  it('같은 키로 두 번 오면 한 번만 만든다', async () => {
    const before = (await db.select({ id: purchaseRequests.id }).from(purchaseRequests)).length
    // **같은 서버라야 같은 키를 기억한다.** 앱을 새로 세우면 시도의 칸도 새것이다.
    const app = harness(db, { who: MEMBER, newId })
    const send = () =>
      app.request(SUBMIT, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'Idempotency-Key': 'same-key' },
        body: JSON.stringify(flatDraft(FULL_DRAFT)),
      })
    const first = await send()
    const again = await send()
    expect(first.status).toBe(200)
    expect(again.status).toBe(200)
    expect(await again.json()).toEqual(await first.json())
    expect((await db.select({ id: purchaseRequests.id }).from(purchaseRequests)).length).toBe(before + 1)
  })

  it('이미 제출된 요청을 또 제출하거나 남의 초안을 제출하면 422다', async () => {
    expect((await post(db, SUBMIT, flatDraft({ ...FULL_DRAFT, requestId: 'PR-01' }), MEMBER, withKey())).status).toBe(422)
    expect((await post(db, SUBMIT, flatDraft({ ...FULL_DRAFT, requestId: 'PR-08' }), MEMBER, withKey())).status).toBe(422)
    // 그 초안의 주인은 낼 수 있다 — 검토 대기가 되고 번호가 붙는다.
    const res = await post(db, SUBMIT, flatDraft({ ...FULL_DRAFT, requestId: 'PR-08' }), OTHER, withKey(), { newId })
    expect(res.status, await res.text()).toBe(200)
    expect(await requestRow('PR-08')).toMatchObject({ stage: 'review', requesterMemberId: 'M-03' })
  })

  // 회장도 구성원이다. 제출 자리는 `member`라 누구나 낸다.
  it('회장이 내도 요청자는 회장이고 부서는 회장의 부서다', async () => {
    const res = await post(db, SUBMIT, flatDraft(FULL_DRAFT), CHAIR, withKey(), { newId })
    const answer = (await res.json()) as Row
    expect(res.status).toBe(200)
    expect(await requestRow(String(answer.id))).toMatchObject({ requesterMemberId: 'M-02', departmentId: 'D-02' })
  })
})
