import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createApp, type Deps } from '../app.ts'
import type { Db } from '../db/client.ts'
import { freshDb } from '../db/testing.ts'
import {
  budgetItems,
  departments,
  events,
  members,
  organizations,
  paymentDocuments,
  payments,
  purchaseOrders,
  purchaseRequestItems,
  purchaseRequests,
  users,
} from '../db/schema.ts'
import { inMemoryAttempts } from '../idempotency.ts'
import type { Viewer } from '../permissions.ts'
import { inMemoryCounter } from '../public/rate-limit.ts'

// 재정의 읽는 자리(FIN-REV-01 · FIN-PROC-01 · FIN-EVID-01 · MY-REQ-01).
//
// **화면 넷이 한 요청을 단계별로 본다.** 검토하고 → 사고 → 증빙을 붙이는 흐름이
// `purchase_requests` 한 줄을 따라가고, 화면마다 다른 것은 그 줄의 어느 곁가지를
// 함께 읽느냐뿐이다(품목 · 발주 · 결제).
//
// 이 파일이 재는 것이 여섯이다.
//
// 1. **완성된 글과 색을 서버가 만든다.** '135,000원'·'구매 진행 중'·'blue'는
//    저장된 값이 아니라 읽을 때 만든 것이다.
// 2. **주문 상태와 배송 상태는 사실에서 나온다.** 표에 그 값이 없다 —
//    '주문 완료'는 발주에 실렸다는 뜻이고 '배송 중'은 올 날이 잡혔는데 아직
//    안 왔다는 뜻이다(`db/schema.ts`가 그렇게 못 박았다).
// 3. **승인액과 실결제액을 견준다.** 둘이 다를 수 있고 그 차이가 드러나는 것이
//    FIN-EVID-01의 일이다.
// 4. **끝낼 수 있는지도 서버가 안다.** 증빙 서류가 몇 건 비었는지는 화면이 셀 수
//    없다.
// 5. **없는 것은 없다고 말한다.** 없는 요청을 물으면 404다.
// 6. **울타리가 선다.** 남의 학생회 요청도, 남이 낸 요청도 섞이지 않는다.

let db: Db
let close: () => Promise<void>

const NOW = new Date('2026-03-10T10:00:00+09:00')

const at = (text: string) => new Date(`${text}T00:00:00+09:00`)

function viewer(orgId = 'ORG-01', memberId = 'M-01'): Viewer {
  return {
    userId: 'U-01',
    membership: {
      orgId,
      memberId,
      role: 'member',
      departmentId: 'D-01',
      inFinanceDepartment: false,
    },
  }
}

function harness(who: Viewer | null = viewer()) {
  const deps: Deps = {
    audit: { async write() {} },
    db,
    who: async () => who,
    lookups: {
      isEventStaff: async () => false,
      isEventStaffManager: async () => false,
      isMeetingHost: async () => false,
      isMeetingCreator: async () => false,
    },
    signIn: {
      open: () => ({ google: true, kakao: false }),
      start: async (provider: string) => ({ url: `https://example.test/${provider}` }),
    },
    attempts: inMemoryAttempts(),
    counter: inMemoryCounter(),
    invite: { linkBase: 'https://vada.app/join', now: () => NOW, newCode: () => 'CODE' },
    newId: () => 'X-01',
  }
  return createApp(deps)
}

type Row = Record<string, unknown>

const ask = (path: string, who?: Viewer) => harness(who ?? viewer()).request(path)

async function one(path: string, who?: Viewer): Promise<Row> {
  const res = await ask(path, who)
  expect(res.status, `${path}가 ${res.status}로 답했다`).toBe(200)
  return (await res.json()) as Row
}

async function many(path: string, who?: Viewer): Promise<Row[]> {
  const res = await ask(path, who)
  expect(res.status, `${path}가 ${res.status}로 답했다`).toBe(200)
  return (await res.json()) as Row[]
}

beforeAll(async () => {
  const fresh = await freshDb()
  db = fresh.db as unknown as Db
  close = fresh.close

  await db.insert(organizations).values([
    { id: 'ORG-01', name: '제12대 학생회' },
    { id: 'ORG-02', name: '옆 학생회' },
  ])
  await db.insert(departments).values([
    { id: 'D-01', orgId: 'ORG-01', name: '운영부', sortOrder: 0 },
    { id: 'D-02', orgId: 'ORG-01', name: '재정부', handlesFinance: true, sortOrder: 1 },
    { id: 'D-99', orgId: 'ORG-02', name: '남의 부서' },
  ])
  await db.insert(users).values({ id: 'U-01', email: 'haerang@example.ac.kr' })
  await db.insert(members).values([
    { id: 'M-01', orgId: 'ORG-01', name: '박해랑', departmentId: 'D-01', userId: 'U-01' },
    { id: 'M-02', orgId: 'ORG-01', name: '김바다', departmentId: 'D-02', role: 'chair' },
    { id: 'M-99', orgId: 'ORG-02', name: '남의 사람', departmentId: 'D-99' },
  ])
  await db.insert(events).values([
    { id: 'E-01', orgId: 'ORG-01', title: '2026 소프트웨어융합대학 체육대회', updatedAt: NOW },
    { id: 'E-99', orgId: 'ORG-02', title: '남의 행사', updatedAt: NOW },
  ])
  // 예산이 있어야 '사용 가능액'을 셀 바탕이 있다. 넣는 화면은 아직 없지만 표는 있다.
  await db.insert(budgetItems).values([
    { id: 'B-01', orgId: 'ORG-01', eventId: 'E-01', name: '행사 운영비', amount: 1_000_000 },
  ])

  await db.insert(purchaseRequests).values([
    // 검토를 기다리는 요청(FIN-REV-01이 여는 것).
    {
      id: 'PR-01',
      orgId: 'ORG-01',
      eventId: 'E-01',
      code: 'REQ-001',
      title: '체육대회 운영 물품 2종',
      purpose: '체육대회 진행에 필요한 소모품을 삽니다.',
      departmentId: 'D-01',
      requesterMemberId: 'M-01',
      neededOn: at('2026-03-15'),
      stage: 'review',
      submittedAt: at('2026-03-01'),
    },
    // 보완이 걸린 요청. **단계는 여전히 검토다.**
    {
      id: 'PR-02',
      orgId: 'ORG-01',
      eventId: 'E-01',
      code: 'REQ-002',
      title: '이름표 용지',
      departmentId: 'D-01',
      requesterMemberId: 'M-01',
      stage: 'review',
      submittedAt: at('2026-03-02'),
      supplementRequestedAt: at('2026-03-03'),
      supplementDueOn: at('2026-03-07'),
    },
    // 구매·발주 단계(FIN-PROC-01).
    {
      id: 'PR-03',
      orgId: 'ORG-01',
      eventId: 'E-01',
      code: 'REQ-003',
      title: '현수막 제작',
      departmentId: 'D-01',
      requesterMemberId: 'M-01',
      neededOn: at('2026-03-20'),
      stage: 'purchase',
      submittedAt: at('2026-03-04'),
    },
    // 결제·증빙 단계(FIN-EVID-01).
    {
      id: 'PR-04',
      orgId: 'ORG-01',
      eventId: 'E-01',
      code: 'REQ-004',
      title: '간식 구매',
      departmentId: 'D-01',
      requesterMemberId: 'M-01',
      stage: 'proof',
      submittedAt: at('2026-03-05'),
    },
    // 처리가 끝난 요청.
    {
      id: 'PR-05',
      orgId: 'ORG-01',
      eventId: 'E-01',
      code: 'REQ-005',
      title: '상장 인쇄',
      departmentId: 'D-01',
      requesterMemberId: 'M-01',
      stage: 'settled',
      submittedAt: at('2026-03-06'),
      evidenceCompletedAt: at('2026-03-09'),
    },
    // 아직 안 낸 요청. **'내가 제출한 구매 요청'에 오지 않는다.**
    {
      id: 'PR-06',
      orgId: 'ORG-01',
      eventId: 'E-01',
      title: '임시 저장한 요청',
      departmentId: 'D-01',
      requesterMemberId: 'M-01',
      stage: 'draft',
    },
    // 남이 낸 요청. 같은 행사이지만 내 목록에 오지 않는다.
    {
      id: 'PR-07',
      orgId: 'ORG-01',
      eventId: 'E-01',
      code: 'REQ-007',
      title: '남이 낸 요청',
      departmentId: 'D-02',
      requesterMemberId: 'M-02',
      stage: 'review',
      submittedAt: at('2026-03-01'),
    },
    // 남의 학생회 요청.
    {
      id: 'PR-99',
      orgId: 'ORG-02',
      eventId: 'E-99',
      code: 'REQ-999',
      title: '남의 학생회 요청',
      departmentId: 'D-99',
      requesterMemberId: 'M-99',
      stage: 'review',
      submittedAt: at('2026-03-01'),
    },
  ])

  await db.insert(purchaseOrders).values([
    // 주문한 발주.
    {
      id: 'PO-01',
      orgId: 'ORG-01',
      requestId: 'PR-03',
      vendor: '다이소 온라인몰',
      orderedOn: at('2026-03-08'),
      ordererMemberId: 'M-02',
    },
    // **아직 주문하지 않은 업체도 온다.** 없는 것과 아직 안 한 것은 다르다.
    { id: 'PO-02', orgId: 'ORG-01', requestId: 'PR-03', vendor: '인쇄업체 A' },
  ])

  await db.insert(payments).values([
    {
      id: 'PAY-01',
      orgId: 'ORG-01',
      requestId: 'PR-04',
      vendor: '다이소 온라인몰',
      paidOn: at('2026-03-08'),
      payerMemberId: 'M-02',
      method: '법인카드',
      paidAmount: 24_500,
    },
  ])

  await db.insert(paymentDocuments).values([
    {
      id: 'PD-01',
      orgId: 'ORG-01',
      paymentId: 'PAY-01',
      label: '영수증',
      registeredAt: at('2026-03-08'),
    },
    { id: 'PD-02', orgId: 'ORG-01', paymentId: 'PAY-01', label: '거래명세서' },
  ])

  await db.insert(purchaseRequestItems).values([
    // PR-01의 품목 둘. 하나는 이미 보완 판정이 있다.
    {
      id: 'PRI-01',
      orgId: 'ORG-01',
      requestId: 'PR-01',
      sortOrder: 0,
      name: '박스테이프',
      category: '운영 물품',
      purchaseType: '일반 구매',
      budgetItemId: 'B-01',
      quantity: 5,
      unit: '개',
      unitPrice: 2_000,
    },
    {
      id: 'PRI-02',
      orgId: 'ORG-01',
      requestId: 'PR-01',
      sortOrder: 1,
      name: '생수 500ml',
      quantity: 2,
      unit: '박스',
      unitPrice: 12_500,
      reviewResult: 'supplement',
      approvedAmount: 20_000,
    },
    // PR-03의 품목 둘. 하나는 주문했고 하나는 아직이다.
    {
      id: 'PRI-03',
      orgId: 'ORG-01',
      requestId: 'PR-03',
      sortOrder: 0,
      name: '현수막',
      quantity: 1,
      unit: '장',
      unitPrice: 30_000,
      approvedAmount: 25_000,
      orderId: 'PO-01',
      expectedDeliveryOn: at('2026-03-12'),
    },
    {
      id: 'PRI-04',
      orgId: 'ORG-01',
      requestId: 'PR-03',
      sortOrder: 1,
      name: '이름표 용지',
      quantity: 200,
      unit: '장',
      unitPrice: 300,
      approvedAmount: 60_000,
      orderId: 'PO-02',
    },
    // PR-04의 품목. 결제에 딸려 있다.
    {
      id: 'PRI-05',
      orgId: 'ORG-01',
      requestId: 'PR-04',
      sortOrder: 0,
      name: '초콜릿',
      quantity: 10,
      unit: '개',
      unitPrice: 2_500,
      approvedAmount: 25_000,
      paymentId: 'PAY-01',
    },
  ])
}, 60_000)

afterAll(async () => {
  await close()
})

describe('검토할 요청의 머리가 저장소에서 온다(FIN-REV-01)', () => {
  it('완성된 글과 색을 서버가 만든다', async () => {
    const row = await one('/api/ops/finance/purchase-requests/review?requestId=PR-01')
    expect(row).toMatchObject({
      code: 'REQ-001',
      status: '검토 대기',
      statusTone: 'blue',
      amountNote: '35,000원',
      eventName: '2026 소프트웨어융합대학 체육대회',
      department: '운영부',
      requester: '박해랑',
      neededOn: '2026-03-15',
      requestedAt: '2026-03-01',
      purpose: '체육대회 진행에 필요한 소모품을 삽니다.',
    })
  })

  // **보완은 단계가 아니다.** 걸린 요청도 검토 중이고, 걸렸다는 사실만 다르다.
  it('보완이 걸린 요청은 단계가 아니라 상태가 다르다', async () => {
    const row = await one('/api/ops/finance/purchase-requests/review?requestId=PR-02')
    expect(row.status).toBe('보완 요청')
    expect(row.statusTone).toBe('yellow')
  })

  // 사용 가능액은 **배정에서 실제 지출과 지출 예정을 뺀 것**이다. 명세의 두 자리가
  // 같은 셈을 예로 들어 두었다(event.financeSummary · finance.orgOverview).
  it('사용 가능액을 서버가 셈한다', async () => {
    const row = await one('/api/ops/finance/purchase-requests/review?requestId=PR-01')
    // 배정 1,000,000 − 실결제 24,500 − 아직 안 낸 승인액(20,000+25,000+60,000) = 870,500
    expect(row.budgetAvailableNote).toBe('870,500원')
  })

  it('없는 요청은 없다고 답한다', async () => {
    expect((await ask('/api/ops/finance/purchase-requests/review?requestId=없다')).status).toBe(404)
  })

  // 남의 학생회 요청도 같은 답이다 — 갈려 보이면 주소로 남의 요청이 있는지 물어볼 수 있다.
  it('남의 학생회 요청도 없다고 답한다', async () => {
    expect((await ask('/api/ops/finance/purchase-requests/review?requestId=PR-99')).status).toBe(404)
  })
})

describe('검토할 품목이 저장소에서 온다(FIN-REV-01)', () => {
  it('품목마다 완성된 글과 앞서 내린 판정이 온다', async () => {
    const rows = await many('/api/ops/finance/purchase-requests/review/items?requestId=PR-01')
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({
      id: 'PRI-01',
      name: '박스테이프',
      categoryNote: '운영 물품 · 행사 운영비',
      purchaseType: '일반 구매',
      quantityNote: '5개',
      amountNote: '10,000원',
      // 아직 판정하지 않았으면 승인액은 요청액에서 시작하고 판정은 빈 값이다.
      approvedAmount: '10000',
      result: '',
    })
    expect(rows[1]).toMatchObject({
      id: 'PRI-02',
      quantityNote: '2박스',
      amountNote: '25,000원',
      approvedAmount: '20000',
      result: 'supplement',
    })
  })

  it('남의 학생회 요청의 품목은 오지 않는다', async () => {
    expect(
      (await ask('/api/ops/finance/purchase-requests/review/items?requestId=PR-99')).status,
    ).toBe(404)
  })
})

describe('구매·발주가 저장소에서 온다(FIN-PROC-01)', () => {
  it('머리가 승인된 금액을 준다', async () => {
    const row = await one('/api/ops/finance/purchase-requests/orders/summary?requestId=PR-03')
    expect(row).toMatchObject({
      eventName: '2026 소프트웨어융합대학 체육대회',
      code: 'REQ-003',
      status: '구매 진행 중',
      statusTone: 'blue',
      title: '현수막 제작',
      requesterNote: '운영부 · 박해랑 · 필요한 날짜 2026-03-20',
      approvedAmountNote: '85,000원',
    })
  })

  // **묶음 하나가 업체 하나다.** 아직 주문하지 않은 업체도 온다.
  it('업체마다 묶여 오고 주문 상태가 사실에서 나온다', async () => {
    const rows = await many('/api/ops/finance/purchase-requests/orders?requestId=PR-03')
    expect(rows.map((row) => row.vendor)).toEqual(['다이소 온라인몰', '인쇄업체 A'])

    expect(rows[0]).toMatchObject({
      id: 'PO-01',
      orderNote: '주문일 2026-03-08 · 담당 김바다',
      amountNote: '25,000원',
    })
    expect((rows[0]!.items as Row[])[0]).toMatchObject({
      id: 'PRI-03',
      name: '현수막',
      quantityNote: '1장',
      amountNote: '25,000원',
      orderStatus: '주문 완료',
      orderStatusTone: 'green',
      deliveryOn: '2026-03-12',
      deliveryStatus: '배송 중',
      deliveryStatusTone: 'blue',
    })

    // 주문하지 않은 업체는 자리를 비운 채로 온다.
    expect(rows[1]).toMatchObject({ orderNote: '주문일 — · 담당 —' })
    expect((rows[1]!.items as Row[])[0]).toMatchObject({
      orderStatus: '주문 대기',
      orderStatusTone: 'gray',
      deliveryOn: '—',
      deliveryStatus: '—',
    })
  })

  it('발주가 없으면 빈 목록이다 — 그것은 참이다', async () => {
    expect(await many('/api/ops/finance/purchase-requests/orders?requestId=PR-01')).toEqual([])
  })
})

describe('결제·증빙이 저장소에서 온다(FIN-EVID-01)', () => {
  it('승인 금액과 실결제 합계가 따로 온다', async () => {
    const row = await one('/api/ops/finance/purchase-requests/evidence/summary?requestId=PR-04')
    expect(row).toMatchObject({
      eventName: '2026 소프트웨어융합대학 체육대회',
      code: 'REQ-004',
      status: '증빙 정리 중',
      statusTone: 'blue',
      title: '간식 구매',
      requesterNote: '운영부 · 박해랑',
      approvedAmountNote: '25,000원',
      paidAmountNote: '24,500원',
      // **끝낼 수 있는지는 서버가 안다.** 붙지 않은 서류가 하나 있다.
      completeBlockedNote: '증빙 서류 1건이 아직 등록되지 않았습니다.',
    })
  })

  it('이미 끝난 요청은 다시 끝낼 수 없다고 말한다', async () => {
    const row = await one('/api/ops/finance/purchase-requests/evidence/summary?requestId=PR-05')
    expect(row.status).toBe('처리 완료')
    expect(row.statusTone).toBe('green')
    expect(row.completeBlockedNote).toBe('이미 처리가 완료된 요청입니다.')
  })

  // **묶음 하나가 결제 하나다.** 딸린 품목과 증빙이 함께 온다.
  it('결제마다 품목과 증빙이 함께 온다', async () => {
    const rows = await many('/api/ops/finance/purchase-requests/evidence?requestId=PR-04')
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      id: 'PAY-01',
      vendor: '다이소 온라인몰',
      paidNote: '결제일 2026-03-08 · 결제자 김바다 · 법인카드',
      // 화면이 두 수를 잇지 않는다 — 무엇을 무엇에 견주는지가 곧 재정의 표기다.
      amountNote: '승인 25,000원 → 실결제 24,500원',
      gapNote: '실결제액이 승인액보다 500원 적음',
    })
    expect(rows[0]!.items).toEqual([{ id: 'PRI-05', name: '초콜릿' }])
    expect(rows[0]!.documents).toEqual([
      { id: 'PD-01', label: '영수증', status: '등록 완료', statusTone: 'green' },
      { id: 'PD-02', label: '거래명세서', status: '누락', statusTone: 'red' },
    ])
  })

  it('결제가 없으면 빈 목록이다', async () => {
    expect(await many('/api/ops/finance/purchase-requests/evidence?requestId=PR-01')).toEqual([])
  })
})

describe('내 구매 요청이 저장소에서 온다(MY-REQ-01)', () => {
  it('내가 낸 것만 오고 임시 저장한 것은 오지 않는다', async () => {
    const rows = await many('/api/ops/event/finance/my-requests?eventId=E-01')
    expect(rows.map((row) => row.code)).toEqual([
      'REQ-001',
      'REQ-002',
      'REQ-003',
      'REQ-004',
      'REQ-005',
    ])
  })

  it('한 줄이 완성된 글로 온다', async () => {
    const rows = await many('/api/ops/event/finance/my-requests?eventId=E-01')
    expect(rows[0]).toMatchObject({
      id: 'PR-01',
      code: 'REQ-001',
      title: '체육대회 운영 물품 2종',
      amountNote: '35,000원',
      itemCountNote: '2종',
      requestedAt: '2026-03-01',
      neededOn: '2026-03-15',
      status: '검토 대기',
      statusTone: 'blue',
    })
  })

  // **세는 것도 서버가 한다.** 화면이 세면 절차가 화면에 적히게 된다.
  it('상태별 건수와 보는 범위를 서버가 만든다', async () => {
    const row = await one('/api/ops/event/finance/my-requests/summary?eventId=E-01')
    expect(row).toEqual({
      scopeNote: '이 행사에서 내가 제출한 구매 요청 · 박해랑 · 운영부 · 부원',
      reviewCount: '1',
      supplementCount: '1',
      approvedCount: '1',
      purchasingCount: '1',
      doneCount: '1',
    })
  })

  it('남의 학생회 행사를 물으면 없다고 답한다', async () => {
    expect((await ask('/api/ops/event/finance/my-requests?eventId=E-99')).status).toBe(404)
  })
})
