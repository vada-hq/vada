import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { createApp } from '../../../api/src/app.ts'
import { freshDb } from '../../../api/src/db/testing.ts'
import { inMemoryCounter } from '../../../api/src/public/rate-limit.ts'
import { inMemoryAttempts } from '../../../api/src/idempotency.ts'
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
} from '../../../api/src/db/schema.ts'
import { ScreenRouter } from '../screens/ScreenRouter'
import { readListSource, readObjectSource } from './catalog'
import { loadSources, useServer } from './server'

// **재정 화면 넷을 끝까지 뚫는다**(FIN-REV-01 · FIN-PROC-01 · FIN-EVID-01 · MY-REQ-01).
//
// 화면 넷이 한 요청을 단계별로 본다 — 검토하고 → 사고 → 증빙을 붙이는 흐름이
// `purchase_requests`의 한 줄을 따라간다. 그래서 여기서 재는 것도 화면마다의 값이
// 아니라 **한 줄에서 나온 값이 화면마다 옳게 갈리는가**다.
//
// | 화면 | 읽기 |
// | --- | --- |
// | FIN-REV-01 | `finance.reviewSummary` · `finance.reviewItems` |
// | FIN-PROC-01 | `finance.purchaseOrderSummary` · `finance.purchaseOrders` |
// | FIN-EVID-01 | `finance.paymentEvidenceSummary` · `finance.paymentEvidences` |
// | MY-REQ-01 | `event.myPurchaseRequestSummary` · `event.myPurchaseRequests` |
//
// **읽기는 `<ScreenRouter>`를 그려서 잰다.** 그릇에 손으로 값을 먹이면 화면이 서버에
// 붙는 순간 터지는 것을 못 본다.
//
// **쓰기는 없다.** 이 회차는 읽는 자리만 붙였다.

const NOW = new Date('2026-03-10T10:00:00+09:00')
const at = (text: string) => new Date(`${text}T00:00:00+09:00`)

let restore: () => void
let close: () => Promise<void>

const draw = (screenId: string, screenParams: Record<string, string> = {}) =>
  render(
    <ScreenRouter
      screenId={screenId}
      screenParams={screenParams}
      scopes={{}}
      onChangeScope={() => {}}
      onNavigate={() => {}}
    />,
  )

const drawn = () => document.body.textContent ?? ''

beforeAll(async () => {
  const fresh = await freshDb()
  close = fresh.close

  await fresh.db.insert(organizations).values({ id: 'ORG-01', name: '제12대 학생회' })
  await fresh.db.insert(departments).values([
    { id: 'D-01', orgId: 'ORG-01', name: '운영부', sortOrder: 0 },
    { id: 'D-02', orgId: 'ORG-01', name: '재정부', handlesFinance: true, sortOrder: 1 },
  ])
  await fresh.db.insert(users).values({ id: 'U-01', email: 'haerang@example.ac.kr' })
  await fresh.db.insert(members).values([
    { id: 'M-01', orgId: 'ORG-01', name: '박해랑', departmentId: 'D-01', userId: 'U-01' },
    { id: 'M-02', orgId: 'ORG-01', name: '김바다', departmentId: 'D-02', role: 'chair' },
  ])
  // **개발용 응답에 없는 이름으로 둔다** — 그래야 서버를 거친 증거가 된다.
  await fresh.db.insert(events).values({
    id: 'E-01',
    orgId: 'ORG-01',
    title: '2026 소프트웨어융합대학 가을 한마당',
    updatedAt: NOW,
  })
  await fresh.db
    .insert(budgetItems)
    .values({ id: 'B-01', orgId: 'ORG-01', eventId: 'E-01', name: '행사 운영비', amount: 1_000_000 })

  await fresh.db.insert(purchaseRequests).values([
    {
      id: 'PR-11',
      orgId: 'ORG-01',
      eventId: 'E-01',
      code: 'REQ-011',
      title: '한마당 운영 물품',
      purpose: '한마당 진행에 필요한 소모품을 삽니다.',
      departmentId: 'D-01',
      requesterMemberId: 'M-01',
      neededOn: at('2026-03-15'),
      stage: 'review',
      submittedAt: at('2026-03-01'),
    },
    {
      id: 'PR-12',
      orgId: 'ORG-01',
      eventId: 'E-01',
      code: 'REQ-012',
      title: '한마당 현수막 제작',
      departmentId: 'D-01',
      requesterMemberId: 'M-01',
      neededOn: at('2026-03-20'),
      stage: 'purchase',
      submittedAt: at('2026-03-04'),
    },
    {
      id: 'PR-13',
      orgId: 'ORG-01',
      eventId: 'E-01',
      code: 'REQ-013',
      title: '한마당 간식 구매',
      departmentId: 'D-01',
      requesterMemberId: 'M-01',
      stage: 'proof',
      submittedAt: at('2026-03-05'),
    },
  ])

  await fresh.db.insert(purchaseOrders).values({
    id: 'PO-11',
    orgId: 'ORG-01',
    requestId: 'PR-12',
    vendor: '한마당 인쇄소',
    orderedOn: at('2026-03-08'),
    ordererMemberId: 'M-02',
  })

  await fresh.db.insert(payments).values({
    id: 'PAY-11',
    orgId: 'ORG-01',
    requestId: 'PR-13',
    vendor: '한마당 마트',
    paidOn: at('2026-03-08'),
    payerMemberId: 'M-02',
    method: '법인카드',
    paidAmount: 24_500,
  })
  await fresh.db.insert(paymentDocuments).values([
    {
      id: 'PD-11',
      orgId: 'ORG-01',
      paymentId: 'PAY-11',
      label: '영수증',
      registeredAt: at('2026-03-08'),
    },
    { id: 'PD-12', orgId: 'ORG-01', paymentId: 'PAY-11', label: '거래명세서' },
  ])

  await fresh.db.insert(purchaseRequestItems).values([
    {
      id: 'PRI-11',
      orgId: 'ORG-01',
      requestId: 'PR-11',
      sortOrder: 0,
      name: '한마당 안내 팻말',
      category: '운영 물품',
      purchaseType: '일반 구매',
      budgetItemId: 'B-01',
      quantity: 5,
      unit: '개',
      unitPrice: 2_000,
    },
    {
      id: 'PRI-12',
      orgId: 'ORG-01',
      requestId: 'PR-12',
      sortOrder: 0,
      name: '한마당 현수막',
      quantity: 1,
      unit: '장',
      unitPrice: 30_000,
      approvedAmount: 25_000,
      orderId: 'PO-11',
      expectedDeliveryOn: at('2026-03-12'),
    },
    {
      id: 'PRI-13',
      orgId: 'ORG-01',
      requestId: 'PR-13',
      sortOrder: 0,
      name: '한마당 초콜릿',
      quantity: 10,
      unit: '개',
      unitPrice: 2_500,
      approvedAmount: 25_000,
      paymentId: 'PAY-11',
    },
  ])

  const app = createApp({
    audit: { async write() {} },
    db: fresh.db as never,
    who: async () => ({
      userId: 'U-01',
      membership: {
        orgId: 'ORG-01',
        memberId: 'M-01',
        role: 'member',
        departmentId: 'D-01',
        inFinanceDepartment: false,
      },
    }),
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
  })

  // **인자를 그대로 넘긴다.** 주소만 넘기면 인자가 통째로 빠진다.
  restore = useServer({
    baseUrl: 'http://server',
    fetch: async (input, init) => app.request(String(input), init),
  })
}, 60_000)

afterAll(async () => {
  restore()
  await close()
})

describe('구매 요청 검토가 저장소에서 온다(FIN-REV-01)', () => {
  it('머리와 품목을 서버가 준 글로 그린다', async () => {
    draw('FIN-REV-01', { requestId: 'PR-11' })
    await waitFor(() => expect(screen.getByText('한마당 안내 팻말')).toBeInTheDocument())
    const page = drawn()
    expect(page).toContain('REQ-011')
    expect(page).toContain('2026 소프트웨어융합대학 가을 한마당')
    expect(page).toContain('한마당 진행에 필요한 소모품을 삽니다.')
    // 개발용 응답의 요청이 아니라는 증거.
    expect(page).not.toContain('체육대회 운영 물품 4종')
    expect(page).not.toContain('박스테이프')
  })

  // **사용 가능액은 서버가 셈한다.** 배정에서 무엇을 빼는지가 조직의 재정 규칙이다.
  it('사용 가능액과 요청액이 완성된 글로 온다', async () => {
    const params = { requestId: 'PR-11' }
    await loadSources([{ key: 'finance.reviewSummary', params }])
    expect(readObjectSource('finance.reviewSummary', params)).toMatchObject({
      code: 'REQ-011',
      status: '검토 대기',
      statusTone: 'blue',
      amountNote: '10,000원',
      // 배정 1,000,000 − 실결제 24,500 − 아직 안 낸 승인액 25,000 = 950,500
      budgetAvailableNote: '950,500원',
      department: '운영부',
      requester: '박해랑',
    })
  })

  // **승인액은 요청액에서 시작한다.** 재정부가 깎으려면 깎을 것이 칸에 있어야 한다.
  it('아직 판정하지 않은 품목의 처음 값이 온다', async () => {
    const params = { requestId: 'PR-11' }
    await loadSources([{ key: 'finance.reviewItems', params }])
    expect(readListSource('finance.reviewItems', params)[0]).toMatchObject({
      id: 'PRI-11',
      categoryNote: '운영 물품 · 행사 운영비',
      quantityNote: '5개',
      amountNote: '10,000원',
      approvedAmount: '10000',
      result: '',
    })
  })
})

describe('구매·발주가 저장소에서 온다(FIN-PROC-01)', () => {
  it('업체 묶음과 그 안의 품목을 그린다', async () => {
    draw('FIN-PROC-01', { requestId: 'PR-12' })
    await waitFor(() => expect(screen.getByText('한마당 인쇄소')).toBeInTheDocument())
    const page = drawn()
    expect(page).toContain('한마당 현수막')
    expect(page).toContain('주문일 2026-03-08 · 담당 김바다')
    // 개발용 응답의 업체가 아니라는 증거.
    expect(page).not.toContain('다이소 온라인몰')
  })

  // **주문 상태와 배송 상태는 표에 없다.** 발주에 실렸는가와 올 날이 잡혔는가에서 나온다.
  it('주문·배송 상태가 사실에서 나온다', async () => {
    const params = { requestId: 'PR-12' }
    await loadSources([
      { key: 'finance.purchaseOrderSummary', params },
      { key: 'finance.purchaseOrders', params },
    ])
    expect(readObjectSource('finance.purchaseOrderSummary', params)).toMatchObject({
      status: '구매 진행 중',
      requesterNote: '운영부 · 박해랑 · 필요한 날짜 2026-03-20',
      approvedAmountNote: '25,000원',
    })
    const group = readListSource('finance.purchaseOrders', params)[0]!
    expect(group.amountNote).toBe('25,000원')
    expect((group.items as Array<Record<string, unknown>>)[0]).toMatchObject({
      orderStatus: '주문 완료',
      orderStatusTone: 'green',
      deliveryOn: '2026-03-12',
      deliveryStatus: '배송 중',
    })
  })
})

describe('결제·증빙이 저장소에서 온다(FIN-EVID-01)', () => {
  it('승인액과 실결제액을 잇는 문구를 서버가 만든다', async () => {
    draw('FIN-EVID-01', { requestId: 'PR-13' })
    await waitFor(() => expect(screen.getByText('한마당 마트')).toBeInTheDocument())
    const page = drawn()
    expect(page).toContain('승인 25,000원 → 실결제 24,500원')
    expect(page).toContain('실결제액이 승인액보다 500원 적음')
  })

  // **끝낼 수 있는지도 서버가 안다.** 무엇이 '증빙이 다 모인 것'인지는 조직의 재정
  // 규칙이라 화면이 셀 수 없다 — 이 글은 처리 완료를 누를 때 그려진다.
  it('붙지 않은 서류가 있으면 끝낼 수 없다고 말한다', async () => {
    const params = { requestId: 'PR-13' }
    await loadSources([{ key: 'finance.paymentEvidenceSummary', params }])
    expect(readObjectSource('finance.paymentEvidenceSummary', params)).toMatchObject({
      status: '증빙 정리 중',
      approvedAmountNote: '25,000원',
      paidAmountNote: '24,500원',
      completeBlockedNote: '증빙 서류 1건이 아직 등록되지 않았습니다.',
    })
  })

  it('결제마다 품목과 증빙이 함께 온다', async () => {
    const params = { requestId: 'PR-13' }
    await loadSources([{ key: 'finance.paymentEvidences', params }])
    const row = readListSource('finance.paymentEvidences', params)[0]!
    expect(row.items).toEqual([{ id: 'PRI-13', name: '한마당 초콜릿' }])
    expect(row.documents).toEqual([
      { id: 'PD-11', label: '영수증', status: '등록 완료', statusTone: 'green' },
      { id: 'PD-12', label: '거래명세서', status: '누락', statusTone: 'red' },
    ])
  })
})

describe('내 구매 요청이 저장소에서 온다(MY-REQ-01)', () => {
  it('내가 낸 요청을 표로 그린다', async () => {
    draw('MY-REQ-01', { eventId: 'E-01' })
    await waitFor(() => expect(screen.getByText('한마당 운영 물품')).toBeInTheDocument())
    const page = drawn()
    expect(page).toContain('REQ-011')
    // 누가 보고 있는지를 서버가 문장으로 잇는다.
    expect(page).toContain('이 행사에서 내가 제출한 구매 요청 · 박해랑 · 운영부 · 부원')
    // 개발용 응답의 요청이 아니라는 증거.
    expect(page).not.toContain('체육대회 운영 물품 4종')
  })

  // **세는 것도 서버가 한다.** 무엇을 어느 칸에 넣는지가 곧 조직의 절차다.
  it('상태별 건수가 저장소에서 온다', async () => {
    const params = { eventId: 'E-01' }
    await loadSources([
      { key: 'event.myPurchaseRequestSummary', params },
      { key: 'event.myPurchaseRequests', params },
    ])
    expect(readObjectSource('event.myPurchaseRequestSummary', params)).toMatchObject({
      reviewCount: '1',
      supplementCount: '0',
      approvedCount: '1',
      purchasingCount: '1',
      doneCount: '0',
    })
    expect(readListSource('event.myPurchaseRequests', params).map((row) => row.code)).toEqual([
      'REQ-011',
      'REQ-012',
      'REQ-013',
    ])
  })
})
