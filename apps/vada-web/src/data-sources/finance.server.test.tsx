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
import type { Viewer } from '../../../api/src/permissions.ts'
import { fetchOptions } from '../option-sources/catalog'
import { ScreenRouter } from '../screens/ScreenRouter'
import { runMutation } from '../spec/mutations'
import { readListSource, readObjectSource } from './catalog'
import { forgetSources, loadSources, useServer } from './server'

// **재정 화면 여덟을 끝까지 뚫는다**(FIN-REV-01 · FIN-PROC-01 · FIN-EVID-01 · MY-REQ-01 ·
// FIN-PLAN-01 · FIN-00 · FIN-00B · FIN-LEDGER-01).
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
// | FIN-00 · 00B | `finance.orgOverview` · `finance.orgBreakdown` · `finance.proofSummary` · `finance.recentExpenses` |
// | FIN-LEDGER-01 | `finance.ledgerSummary` · `finance.ledger` · `finance.ledgerScope` · 고르기 셋 |
// | FIN-PLAN-01 | `finance.budgetPlanDraft` · `finance.budgetEvents` → 쓰기 `finance.budgetPlan.save` |
//
// **재정의 겉면은 편성 전과 후를 둘 다 본다.** 편성 화면이 저장하기 전에는 총예산이
// '편성 전'이고, 저장한 뒤에는 그 벌에서 총예산·미배정·사용 가능이 선다 — 같은 저장소를
// 같은 검사 안에서 앞뒤로 읽는다.
//
// **읽기는 `<ScreenRouter>`를 그려서 잰다.** 그릇에 손으로 값을 먹이면 화면이 서버에
// 붙는 순간 터지는 것을 못 본다.
//
// **쓰기는 `runMutation`으로 보낸다.** 서버를 직접 부르면 그 사이의 코드가 통째로
// 빠진다(`served-evidence.test.ts`). 예산 편성이 이 파일의 첫 쓰기다.

const NOW = new Date('2026-03-10T10:00:00+09:00')
const at = (text: string) => new Date(`${text}T00:00:00+09:00`)

/** 구매 요청 화면 넷을 보는 사람 — 운영부 부원. 재정을 맡지 않는다. */
const MEMBER: Viewer = {
  userId: 'U-01',
  membership: {
    orgId: 'ORG-01',
    memberId: 'M-01',
    role: 'member',
    departmentId: 'D-01',
    inFinanceDepartment: false,
  },
}

/** 예산을 편성하는 사람 — 회장단. `finance.manage`는 회장단이 늘 갖는다. */
const CHAIR: Viewer = {
  userId: 'U-02',
  membership: {
    orgId: 'ORG-01',
    memberId: 'M-02',
    role: 'chair',
    departmentId: 'D-02',
    inFinanceDepartment: true,
  },
}

/** 지금 보고 있는 사람. 검사 묶음이 갈아 끼운다 — 앱은 한 번만 세운다. */
let sender: Viewer = MEMBER

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
  await fresh.db.insert(users).values([
    { id: 'U-01', email: 'haerang@example.ac.kr' },
    { id: 'U-02', email: 'bada@example.ac.kr' },
  ])
  await fresh.db.insert(members).values([
    { id: 'M-01', orgId: 'ORG-01', name: '박해랑', departmentId: 'D-01', userId: 'U-01' },
    // 회장. 예산 편성(FIN-PLAN-01)은 이 사람이 연다 — 셸이 로그인한 사람으로 찾으므로 계정을 잇는다.
    { id: 'M-02', orgId: 'ORG-01', name: '김바다', departmentId: 'D-02', role: 'chair', userId: 'U-02' },
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

  // **이름표는 부를 때마다 다르다.** 편성 저장이 줄마다 새 이름을 받는다 — 같은
  // 이름을 두 번 주면 둘째 줄이 첫째 줄과 부딪힌다.
  let made = 0
  const app = createApp({
    audit: { async write() {} },
    db: fresh.db as never,
    who: async () => sender,
    lookups: {
      isEventStaff: async () => false,
      isEventStaffManager: async () => false,
      isMeetingHost: async () => false,
      isMeetingCreator: async () => false,
      isMeetingParticipant: async () => false,
    },
    signIn: {
      open: () => ({ google: true, kakao: false }),
      start: async (provider: string) => ({ url: `https://example.test/${provider}` }),
    },
    attempts: inMemoryAttempts(),
    counter: inMemoryCounter(),
    invite: { linkBase: 'https://vada.app/join', now: () => NOW, newCode: () => 'CODE' },
    newId: () => `X-${(made += 1)}`,
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

describe('전체 재정 현황이 저장소에서 온다 — 편성 전(FIN-00 · FIN-00B)', () => {
  // **편성 전이면 화면이 편성 전임을 참으로 그린다.** 0원을 지어내지 않는다. 쓴 돈은
  // 예산과 무관한 사실이라 그대로 센다 — 결제 하나(24,500원)와 아직 안 낸 승인 하나(25,000원).
  it('총예산은 편성 전이고 쓴 돈과 쓸 돈은 센다', async () => {
    draw('FIN-00')
    await waitFor(() => expect(screen.getByText('결제가 완료된 1건')).toBeInTheDocument())
    const page = drawn()
    expect(page).toContain('편성 전')
    expect(page).toContain('24,500원')
    expect(page).toContain('결제 예정 1건')
    // 최근 지출은 장부와 같은 결제다.
    expect(page).toContain('한마당 초콜릿')
    expect(page).toContain('누락')
    // 화면 어디도 준비 중이 아니다.
    expect(page).not.toContain('아직 준비 중입니다')
    // 개발용 응답의 값이 아니라는 증거.
    expect(page).not.toContain('2026년 1학기')
    expect(page).not.toContain('14,500,000원')
    expect(page).not.toContain('현수막 제작')
  })

  it('나눠 본 표의 행사 줄이 배정 없이 쓴 돈만 든다', async () => {
    await loadSources([
      { key: 'finance.orgOverview', params: {} },
      { key: 'finance.orgBreakdown', params: { scope: 'event' } },
      { key: 'finance.proofSummary', params: {} },
    ])
    expect(readObjectSource('finance.orgOverview')).toMatchObject({
      termNote: '편성 전',
      totalBudget: '편성 전',
      spent: '24,500원',
      planned: '25,000원',
      available: '편성 전',
      spentPercent: 0,
      plannedPercent: 0,
    })
    expect(readListSource('finance.orgBreakdown', { scope: 'event' })).toEqual([
      {
        id: 'E-01',
        name: '2026 소프트웨어융합대학 가을 한마당',
        budget: '편성 전',
        spent: '24,500원',
        planned: '25,000원',
        available: '편성 전',
        executionPercent: 0,
      },
    ])
    // 결제 하나에 서류 하나가 안 붙었다.
    expect(readObjectSource('finance.proofSummary')).toEqual({
      completed: '0건',
      supplement: '0건',
      unregistered: '1건',
      totalNote: '1건',
    })
  })

  // 예산을 편성할 수 있는 사람이 보는 그림. 총예산 카드가 '편성'으로 눌러 들어가는
  // 카드가 되고 값은 같은 서버에서 온다.
  it('편성할 수 있는 사람의 그림도 같은 값으로 선다', async () => {
    draw('FIN-00B')
    await waitFor(() => expect(screen.getByText('결제가 완료된 1건')).toBeInTheDocument())
    expect(screen.getByRole('button', { name: /총예산/ })).toHaveTextContent('편성 전')
    expect(screen.getByRole('button', { name: /총예산/ })).toHaveTextContent('편성')
  })
})

describe('사용 내역이 저장소에서 온다(FIN-LEDGER-01)', () => {
  it('예정 한 줄과 결제 한 줄을 표로 그리고 범위 줄이 센다', async () => {
    draw('FIN-LEDGER-01')
    await waitFor(() => expect(screen.getByText('한마당 초콜릿')).toBeInTheDocument())
    const page = drawn()
    // 아직 안 낸 승인 — 쓴 날이 없고 결제 전이다.
    expect(page).toContain('한마당 현수막')
    expect(page).toContain('결제 전')
    // 결제 — 쓴 날과 증빙 상태.
    expect(page).toContain('03.08')
    expect(page).toContain('누락')
    // 몇 건 중 몇 건인지는 범위 줄이 말한다. 역할 이름도 서버가 넣는다.
    expect(page).toContain('전체 기간 · 총 2건')
    expect(page).toContain('재정부만')
    // 개발용 응답의 장부가 아니라는 증거.
    expect(page).not.toContain('케이블 커버')
    expect(page).not.toContain('2026년 7월 · 총 42건')
  })

  // **고르지 않았으면 이번 달이다.** 검사가 못 박은 지금은 2026년 3월이다.
  it('머리 넷이 이번 달로 온다', async () => {
    await loadSources([{ key: 'finance.ledgerSummary', params: {} }])
    expect(readObjectSource('finance.ledgerSummary')).toEqual({
      termTotal: '24,500원',
      monthLabel: '3월 지출',
      monthTotal: '24,500원',
      proofDone: '1건 중 0건',
      proofMissing: '1건',
    })
  })

  // 전체 재정의 '지출 예정' 카드가 이 값을 싣고 온다 — 같은 장부를 다르게 자른다.
  it('주소가 실어 온 결제 단계로 잘라 본다', async () => {
    draw('FIN-LEDGER-01', { stage: 'planned' })
    await waitFor(() => expect(screen.getByText('한마당 현수막')).toBeInTheDocument())
    const page = drawn()
    expect(page).not.toContain('한마당 초콜릿')
    expect(page).toContain('전체 기간 · 결제 예정 · 총 1건')
  })

  // 고르는 목록도 같은 서버에서 온다 — 표는 진짜인데 고를 것이 가짜면 없는 달을 고른다.
  it('달과 예산 항목 고르기가 저장소에서 온다', async () => {
    expect(await fetchOptions('finance.ledgerMonths', {})).toEqual([{ value: '2026-03', label: '2026년 3월' }])
    expect(await fetchOptions('finance.ledgerEvents', {})).toEqual([
      { value: 'E-01', label: '2026 소프트웨어융합대학 가을 한마당' },
    ])
    // 아직 편성 전이라 씨앗의 행사 항목 하나뿐이다. 어느 행사의 것인지가 곁에 붙는다.
    expect(await fetchOptions('finance.orgBudgetItems', {})).toEqual([
      { value: 'B-01', label: '행사 운영비', description: '2026 소프트웨어융합대학 가을 한마당' },
    ])
  })
})

describe('예산 편성이 저장소로 가고 저장소에서 온다(FIN-PLAN-01)', () => {
  // 편성은 회장단(또는 재정부)만 연다. 앞의 화면 넷을 본 부원은 이 자리를 못 연다.
  beforeAll(() => {
    sender = CHAIR
    forgetSources()
  })
  afterAll(() => {
    sender = MEMBER
    forgetSources()
  })

  /**
   * 화면이 초안에 쓰는 그 모양이다 — 목록 칸에는 줄 이름이 줄바꿈으로, 줄의 칸은
   * `목록.줄.칸`에(`spec/compute.ts`). 저장은 이 초안을 그대로 보낸다(payloadScope).
   * 씨앗의 예산 항목 B-01(행사 운영비)은 id를 들고 가 **고쳐지고**, 나머지는 새 줄이다.
   */
  const PLAN: Record<string, string> = {
    periodStart: '2026-03-01',
    periodEnd: '2026-08-31',
    sources: 'r0\nr1',
    'sources.r0.sourceName': '한마당 학생회비',
    'sources.r0.sourceAmount': '24000000',
    'sources.r1.sourceName': '학교 지원금',
    'sources.r1.sourceAmount': '6000000',
    items: 'r0',
    'items.r0.itemName': '한마당 운영비',
    'items.r0.itemAmount': '3000000',
    'items.r0.itemDepartment': 'D-01',
    eventItems: 'r0\nr1',
    'eventItems.r0.id': 'B-01',
    'eventItems.r0.eventItemEvent': 'E-01',
    'eventItems.r0.eventItemName': '행사 운영비',
    'eventItems.r0.eventItemAmount': '1500000',
    'eventItems.r1.eventItemEvent': 'E-01',
    'eventItems.r1.eventItemName': '한마당 홍보비',
    'eventItems.r1.eventItemAmount': '800000',
    // 화면의 '행사' 고르기. 무엇을 보고 있었는지일 뿐 값이 아니다 — 서버는 지나친다.
    event: 'E-01',
  }

  it('저장된 것에서 초안이 시작한다 — 아직 기간도 수입원도 없고 행사 항목 하나뿐이다', async () => {
    draw('FIN-PLAN-01')
    // 씨앗의 예산 항목이 행사 줄로 보인다. 그 행사가 골라져 있다.
    await waitFor(() => expect(screen.getByDisplayValue('행사 운영비')).toBeInTheDocument())
    expect(screen.getByLabelText('시작일*')).toHaveValue('')
    expect(screen.getByLabelText('끝일*')).toHaveValue('')
    // 개발용 응답의 편성이 아니라는 증거.
    expect(screen.queryByDisplayValue('학생회비')).not.toBeInTheDocument()
    expect(screen.queryByDisplayValue('운영비')).not.toBeInTheDocument()
    const page = drawn()
    expect(page).toContain('수입 합계 0원')
    expect(page).toContain('상시 배정 합계 0원')
    expect(page).toContain('행사 배정 합계 1,000,000원')
    // 행사 제목은 선택지 출처에서 온다 — 초안에는 id만 실려 있다.
    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: '행사' })).toHaveTextContent(
        '2026 소프트웨어융합대학 가을 한마당',
      ),
    )
  })

  it('저장하면 다시 읽었을 때 같은 벌이 보인다', async () => {
    await runMutation('finance.budgetPlan.save', PLAN)

    draw('FIN-PLAN-01')
    await waitFor(() => expect(screen.getByDisplayValue('한마당 학생회비')).toBeInTheDocument())
    expect(screen.getByLabelText('시작일*')).toHaveValue('2026-03-01')
    expect(screen.getByLabelText('끝일*')).toHaveValue('2026-08-31')
    expect(screen.getByDisplayValue('24000000')).toBeInTheDocument()
    expect(screen.getByDisplayValue('학교 지원금')).toBeInTheDocument()
    expect(screen.getByDisplayValue('한마당 운영비')).toBeInTheDocument()
    // 행사 줄 둘 — 고쳐진 것과 새로 만든 것.
    expect(screen.getByDisplayValue('1500000')).toBeInTheDocument()
    expect(screen.getByDisplayValue('한마당 홍보비')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: '지우기' })).toHaveLength(5)
    // 합계 셋은 화면이 셈한다.
    const page = drawn()
    expect(page).toContain('수입 합계 30,000,000원')
    expect(page).toContain('상시 배정 합계 3,000,000원')
    expect(page).toContain('행사 배정 합계 2,300,000원')
    // 부서 이름도 선택지 출처에서 온다.
    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: '담당 부서(선택)' })).toHaveTextContent('운영부'),
    )

    // 줄마다 이름표가 붙어 돌아온다 — B-01은 그대로 고쳐졌고 나머지는 새 이름이다.
    await loadSources([{ key: 'finance.budgetPlanDraft', params: {} }])
    const stored = readObjectSource('finance.budgetPlanDraft')
    expect(stored.periodStart).toBe('2026-03-01')
    expect(stored.sources).toEqual([
      { id: expect.any(String), sourceName: '한마당 학생회비', sourceAmount: 24_000_000 },
      { id: expect.any(String), sourceName: '학교 지원금', sourceAmount: 6_000_000 },
    ])
    expect(stored.items).toEqual([
      { id: expect.any(String), itemName: '한마당 운영비', itemAmount: 3_000_000, itemDepartment: 'D-01' },
    ])
    expect(stored.eventItems).toEqual([
      { id: 'B-01', eventItemEvent: 'E-01', eventItemName: '행사 운영비', eventItemAmount: 1_500_000 },
      { id: expect.any(String), eventItemEvent: 'E-01', eventItemName: '한마당 홍보비', eventItemAmount: 800_000 },
    ])
  })

  it('배정의 합이 수입의 합을 넘으면 서버가 막는다(422)', async () => {
    // 수입 2,000원에 배정 5,300,000원.
    await expect(
      runMutation('finance.budgetPlan.save', {
        ...PLAN,
        'sources.r0.sourceAmount': '1000',
        'sources.r1.sourceAmount': '1000',
      }),
    ).rejects.toThrow('422')
    // 막힌 저장은 아무것도 바꾸지 않는다.
    await loadSources([{ key: 'finance.budgetPlanDraft', params: {} }])
    expect((readObjectSource('finance.budgetPlanDraft').sources as Array<Record<string, unknown>>)[0]).toMatchObject({
      sourceAmount: 24_000_000,
    })
  })
})

describe('편성하고 나면 총예산 카드가 선다(FIN-00)', () => {
  // 앞 묶음이 저장한 그 벌 위에서 읽는다 — 수입 30,000,000 · 배정 5,300,000. 보는 사람은
  // 다시 부원이다(편성 전을 본 그 사람).
  it('총예산·미배정·사용 가능이 저장한 편성에서 나온다', async () => {
    draw('FIN-00')
    await waitFor(() => expect(screen.getByText('2026. 03. 01 – 2026. 08. 31')).toBeInTheDocument())
    const page = drawn()
    expect(page).toContain('30,000,000원')
    expect(page).toContain('한마당 학생회비 외 1건 · 미배정 24,700,000원')
    // 30,000,000 − 24,500 − 25,000.
    expect(page).toContain('29,950,500원')
    expect(page).toContain('전체 예산 집행률 0.1%')
    expect(page).toContain('지출 예정 포함 0.2%')
    expect(page).not.toContain('편성 전')
  })

  // **검토 화면이 드는 셈과 같은 셈이다.** 행사 줄의 사용 가능액은 배정 − 실결제 − 아직 안 낸 승인액.
  it('행사별과 부서별 줄이 같은 돈을 다른 축으로 나눈다', async () => {
    await loadSources([
      { key: 'finance.orgBreakdown', params: { scope: 'event' } },
      { key: 'finance.orgBreakdown', params: { scope: 'department' } },
    ])
    expect(readListSource('finance.orgBreakdown', { scope: 'event' })).toEqual([
      // 행사 운영비 1,500,000 + 한마당 홍보비 800,000. (24,500 + 25,000) / 2,300,000 ≈ 2%.
      { id: 'E-01', name: '2026 소프트웨어융합대학 가을 한마당', budget: '2,300,000원', spent: '24,500원', planned: '25,000원', available: '2,250,500원', executionPercent: 2 },
      { id: 'ongoing', name: '운영 (상시)', budget: '3,000,000원', spent: '0원', planned: '0원', available: '3,000,000원', executionPercent: 0 },
    ])
    expect(readListSource('finance.orgBreakdown', { scope: 'department' })).toEqual([
      { id: 'D-01', name: '운영부', budget: '3,000,000원', spent: '0원', planned: '0원', available: '3,000,000원', executionPercent: 0 },
      // 행사 항목은 담당 부서가 없고, 씨앗의 품목은 예산 항목을 가리키지 않는다 — 전부 여기 모인다.
      { id: 'unassigned', name: '부서 미지정', budget: '2,300,000원', spent: '24,500원', planned: '25,000원', available: '2,250,500원', executionPercent: 2 },
    ])
  })

  it('예산 항목 고르기가 편성한 세 항목이 된다', async () => {
    const options = await fetchOptions('finance.orgBudgetItems', {})
    expect(options.map((option) => option.label)).toEqual(['한마당 운영비', '행사 운영비', '한마당 홍보비'])
    expect(options[1]).toMatchObject({ value: 'B-01', description: '2026 소프트웨어융합대학 가을 한마당' })
  })
})
