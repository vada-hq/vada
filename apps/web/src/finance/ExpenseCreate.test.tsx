// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { koreanDateOf } from '@vada/contracts'
import { asElement } from '@/test-support/elements'
import { expenseDetail, expenseSummary } from '@/test-support/expense-fixtures'
import {
  BASE,
  EXPENSES,
  ME,
  openExpensesTab,
  REQUESTS,
  serveFinance,
  showFinance,
} from '@/test-support/expense-harness'
import { deferredResponse, json } from '@/test-support/mock-api'
import { purchaseDetail, purchaseSummary } from '@/test-support/purchase-fixtures'
import { settle } from '@/test-support/settle'
import { eventSummary } from '@/test-support/event-fixtures'
import { EXPENSE_ERRORS } from '@/lib/messages'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

const SAEIN = '33333333-3333-4333-8333-333333333333'
const JAEJEONG = '22222222-2222-4222-8222-222222222222'
const ITEM_1 = '44444444-4444-4444-8444-444444444441'
const ITEM_2 = '44444444-4444-4444-8444-444444444442'
const BUDGET = '55555555-5555-4555-8555-555555555555'
const member = (id: string, name: string) => ({
  id,
  name,
  councilRank: null,
  departments: [],
  joinedAt: '2026-10-01T01:00:00.000Z',
})
const team = {
  members: [member(ME, '김회장'), member(JAEJEONG, '이재정'), member(SAEIN, '박새내')],
  departments: [],
}

const approvedItem = (id: string, name: string, amount: number) => ({
  ...purchaseDetail().items[0]!,
  id,
  name,
  amount,
  status: 'approved' as const,
})

function serve() {
  const api = serveFinance()
  api.on('GET', EXPENSES, () => json({ expenses: [expenseSummary('e1')], truncated: false }))
  api.on('GET', `${BASE}/members`, () => json(team))
  api.on('GET', `${REQUESTS}?view=all`, () =>
    json({
      requests: [
        purchaseSummary('r1', { title: '행사 포스터', status: 'approved' }),
        purchaseSummary('r2', { title: '아직 대기', status: 'pending' }),
        purchaseSummary('r3', { title: '취소한 요청', status: 'cancelled' }),
      ],
      truncated: false,
    }),
  )
  api.on('GET', `${REQUESTS}/r1`, () =>
    json({
      request: purchaseDetail('r1', {
        items: [
          approvedItem(ITEM_1, 'A2 포스터', 30000),
          approvedItem(ITEM_2, '테이프', 6000),
          { ...approvedItem('i3', '반려된 것', 1000), status: 'rejected' },
        ],
      }),
    }),
  )
  api.on('GET', `${BASE}/budget`, () =>
    json({
      period: { id: 'p1', name: '2026', startsOn: '2026-01-01', endsOn: '2026-12-31' },
      items: [{ id: BUDGET, purpose: '행사 홍보', amount: 500000, type: 'expense', event: null }],
      suggested: null,
    }),
  )
  return api
}

const openForm = async () => {
  openExpensesTab()
  fireEvent.click(await screen.findByRole('button', { name: '지출 적기' }))
  return screen.findByRole('form', { name: '지출 적기' })
}
const fill = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } })
const submit = () => asElement(screen.getByRole('button', { name: '적기' }), HTMLButtonElement)
const choose = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } })
const today = () => koreanDateOf(new Date())
const tomorrow = () => koreanDateOf(new Date(Date.now() + 24 * 60 * 60 * 1000))

async function fillRequestPayment() {
  await openForm()
  fill('사용처', '인쇄소')
  fill('내역', '포스터 인쇄')
  await screen.findByRole('option', { name: '행사 포스터' })
  choose('결제할 요청', 'r1')
  fireEvent.click(await screen.findByRole('checkbox', { name: /A2 포스터/ }))
}

test('요청한 품목을 고르면 결제 금액이 승인 금액으로 채워지고 합이 금액이 된다', async () => {
  const api = serve()
  api.on('POST', EXPENSES, () => json({ expense: expenseDetail('e1') }, 201))
  api.on('GET', `${EXPENSES}/e1`, () => json({ expense: expenseDetail('e1', { evidence: [] }) }))
  showFinance()
  await fillRequestPayment()
  // 승인된 요청만 고를 수 있고, 품목은 승인된 것만 보인다.
  // 대기 요청도 승인된 품목이 있을 수 있어 고를 수 있다(품목을 읽은 뒤 가린다).
  expect(screen.getByRole('option', { name: '아직 대기' })).toBeTruthy()
  expect(screen.queryByRole('option', { name: '취소한 요청' })).toBeNull()
  expect(screen.queryByRole('checkbox', { name: /반려된 것/ })).toBeNull()
  expect(asElement(screen.getByLabelText('A2 포스터 결제 금액'), HTMLInputElement).value).toBe(
    '30000',
  )
  expect(screen.getByText('합계 30,000원')).toBeTruthy()
  fireEvent.click(screen.getByRole('checkbox', { name: /테이프/ }))
  expect(screen.getByText('합계 36,000원')).toBeTruthy()
  fill('A2 포스터 결제 금액', '25000')
  expect(screen.getByText('합계 31,000원')).toBeTruthy()
  expect(submit().disabled).toBe(false)
  fireEvent.click(submit())
  // 적고 나면 상세가 열려 사진을 붙이게 한다.
  await screen.findByRole('button', { name: '사진 올리기' })
  expect(api.calls.find(call => call.method === 'POST')?.body).toEqual({
    vendor: '인쇄소',
    description: '포스터 인쇄',
    eventId: null,
    amount: 31000,
    paidOn: today(),
    method: 'card',
    paidBy: null,
    reason: null,
    budgetItemId: null,
    requestedBy: null,
    accountId: null,
    sourceMessageId: null,
    lines: [
      { lineItemId: ITEM_1, amount: 25000 },
      { lineItemId: ITEM_2, amount: 6000 },
    ],
  })
  expect(screen.queryByRole('form', { name: '지출 적기' })).toBeNull()
  // 적고 나면 지출 목록을 다시 읽는다.
  expect(
    api.calls.filter(call => call.method === 'GET' && call.path === EXPENSES).length,
  ).toBeGreaterThan(1)
})

test('요청을 바꾸면 고른 품목을 비우고 품목이 없으면 적기가 꺼진다', async () => {
  serve()
  showFinance()
  await fillRequestPayment()
  expect(submit().disabled).toBe(false)
  fireEvent.click(screen.getByRole('checkbox', { name: /A2 포스터/ }))
  expect(submit().disabled).toBe(true)
  fireEvent.click(screen.getByRole('checkbox', { name: /A2 포스터/ }))
  choose('결제할 요청', '')
  expect(screen.queryByRole('checkbox')).toBeNull()
  expect(submit().disabled).toBe(true)
})

test('요청 없이 적으면 먼저 낸 사람, 부탁한 사람, 예산 항목을 고르고 금액을 쓴다', async () => {
  const api = serve()
  api.on('POST', EXPENSES, () => json({ expense: expenseDetail('e1') }, 201))
  api.on('GET', `${EXPENSES}/e1`, () => json({ expense: expenseDetail('e1') }))
  showFinance()
  await openForm()
  fireEvent.click(screen.getByRole('button', { name: '요청 없이' }))
  expect(screen.queryByLabelText('결제할 요청')).toBeNull()
  fill('사용처', '편의점')
  fill('내역', '간식')
  fill('금액(원)', '12000')
  await screen.findByRole('option', { name: /행사 홍보/ })
  choose('예산 항목', BUDGET)
  choose('부탁한 사람', JAEJEONG)
  choose('먼저 낸 사람', SAEIN)
  choose('결제 수단', 'cash')
  fill('사유(선택)', '급해서 먼저 결제')
  const options = within(screen.getByLabelText('먼저 낸 사람')).getAllByRole('option')
  expect(options.map(option => option.textContent)).toEqual(['학생회 돈', '나', '이재정', '박새내'])
  fireEvent.click(submit())
  await screen.findByRole('button', { name: '사진 올리기' })
  expect(api.calls.find(call => call.method === 'POST')?.body).toEqual({
    vendor: '편의점',
    description: '간식',
    eventId: null,
    amount: 12000,
    paidOn: today(),
    method: 'cash',
    paidBy: SAEIN,
    reason: '급해서 먼저 결제',
    budgetItemId: BUDGET,
    requestedBy: JAEJEONG,
    accountId: null,
    sourceMessageId: null,
    lines: [],
  })
})

test('방식을 바꾸면 그 방식에만 있던 값은 몰래 나가지 않는다', async () => {
  const api = serve()
  api.on('POST', EXPENSES, () => json({ expense: expenseDetail('e1') }, 201))
  api.on('GET', `${EXPENSES}/e1`, () => json({ expense: expenseDetail('e1') }))
  showFinance()
  await openForm()
  fireEvent.click(screen.getByRole('button', { name: '요청 없이' }))
  fill('사용처', '편의점')
  fill('내역', '간식')
  fill('금액(원)', '12000')
  await screen.findByRole('option', { name: /행사 홍보/ })
  choose('예산 항목', BUDGET)
  fireEvent.click(screen.getByRole('button', { name: '요청한 품목 결제' }))
  fireEvent.click(screen.getByRole('button', { name: '요청 없이' }))
  expect(asElement(screen.getByLabelText('금액(원)'), HTMLInputElement).value).toBe('')
  fill('금액(원)', '500')
  fireEvent.click(submit())
  await screen.findByRole('button', { name: '사진 올리기' })
  expect(api.calls.find(call => call.method === 'POST')?.body).toMatchObject({
    amount: 500,
    budgetItemId: null,
  })
})

test('결제일은 오늘까지만 받고 필수 칸이 비면 적기가 꺼진다', async () => {
  serve()
  showFinance()
  await openForm()
  fireEvent.click(screen.getByRole('button', { name: '요청 없이' }))
  expect(asElement(screen.getByLabelText('결제일'), HTMLInputElement).value).toBe(today())
  expect(submit().disabled).toBe(true)
  fill('사용처', '편의점')
  fill('내역', '   ')
  fill('금액(원)', '1000')
  expect(submit().disabled).toBe(true)
  fill('내역', '간식')
  expect(submit().disabled).toBe(false)
  fill('결제일', tomorrow())
  expect(submit().disabled).toBe(true)
  fill('결제일', today())
  expect(submit().disabled).toBe(false)
  fill('금액(원)', '0')
  expect(submit().disabled).toBe(true)
})

async function readyDirect() {
  await openForm()
  fireEvent.click(screen.getByRole('button', { name: '요청 없이' }))
  fill('사용처', '편의점')
  fill('내역', '간식')
  fill('금액(원)', '1000')
}

test('두 번 누르면 한 번만 나가고 보내는 동안 닫을 수 없다', async () => {
  const api = serve()
  const pending = deferredResponse()
  api.on('POST', EXPENSES, () => pending.promise)
  api.on('GET', `${EXPENSES}/e1`, () => json({ expense: expenseDetail('e1') }))
  showFinance()
  await readyDirect()
  fireEvent.click(submit())
  fireEvent.click(submit())
  await settle()
  expect(api.calls.filter(call => call.method === 'POST')).toHaveLength(1)
  expect(submit().disabled).toBe(true)
  const form = screen.getByRole('form', { name: '지출 적기' })
  const close = within(form).getByRole('button', { name: '닫기' })
  expect(asElement(close, HTMLButtonElement).disabled).toBe(true)
  pending.resolve(json({ expense: expenseDetail('e1') }, 201))
  await screen.findByRole('button', { name: '사진 올리기' })
})

test.each([
  ['LINE_ITEM_NOT_PAYABLE', 409, '결제할 수 없는 품목이 있어요'],
  ['MEMBER_INVALID', 409, '지금 운영진이 아니에요'],
  ['TOO_MANY_REQUESTS', 429, '너무 빨리 보내고 있어요'],
  ['SOMETHING_ELSE', 500, '보내지 못했어요'],
])('적기가 %s로 거절되면 양식 안에 문구가 보이고 값은 남는다', async (code, status, text) => {
  const api = serve()
  api.on('POST', EXPENSES, () => json({ error: code }, status))
  showFinance()
  await readyDirect()
  fireEvent.click(submit())
  const form = screen.getByRole('form', { name: '지출 적기' })
  expect((await within(form).findByRole('alert')).textContent).toContain(text)
  expect(asElement(screen.getByLabelText('사용처'), HTMLInputElement).value).toBe('편의점')
  await waitFor(() => expect(submit().disabled).toBe(false))
})

test('적는 중에 권한을 잃으면(403) 닫고 학생회를 다시 읽게 한다', async () => {
  const api = serve()
  api.on('POST', EXPENSES, () => json({ error: 'FORBIDDEN' }, 403))
  const handlers = showFinance()
  await readyDirect()
  fireEvent.click(submit())
  await waitFor(() => expect(screen.queryByRole('form', { name: '지출 적기' })).toBeNull())
  expect(handlers.onForbidden).toHaveBeenCalled()
  expect(screen.getByText(/권한이 바뀌었어요/)).toBeTruthy()
})

test('품목 하나만 승인되고 다른 품목이 대기인 요청도 고를 수 있고, 승인된 품목이 없으면 안내한다', async () => {
  const api = serve()
  api.on('GET', `${REQUESTS}?view=all`, () =>
    json({
      requests: [
        purchaseSummary('r1', { title: '일부만 결재', status: 'pending' }),
        purchaseSummary('r4', { title: '반려됨', status: 'rejected' }),
      ],
      truncated: false,
    }),
  )
  api.on('GET', `${REQUESTS}/r1`, () =>
    json({
      request: purchaseDetail('r1', {
        items: [approvedItem(ITEM_1, 'A2 포스터', 30000), purchaseDetail().items[0]!],
      }),
    }),
  )
  showFinance()
  await openForm()
  await screen.findByRole('option', { name: '일부만 결재' })
  expect(screen.queryByRole('option', { name: '반려됨' })).toBeNull()
  choose('결제할 요청', 'r1')
  expect(await screen.findAllByRole('checkbox')).toHaveLength(1)
  api.on('GET', `${REQUESTS}/r1`, () =>
    json({ request: purchaseDetail('r1', { items: [purchaseDetail().items[0]!] }) }),
  )
  choose('결제할 요청', '')
  choose('결제할 요청', 'r1')
  await screen.findByText('결제할 수 있는 승인된 품목이 없어요.')
})

test('고른 예산 항목이 다시 읽은 목록에서 사라지면 값을 비운다', async () => {
  const api = serve()
  api.on('POST', EXPENSES, () => json({ expense: expenseDetail('e1') }, 201))
  api.on('GET', `${EXPENSES}/e1`, () => json({ expense: expenseDetail('e1') }))
  showFinance()
  await readyDirect()
  await screen.findByRole('option', { name: /행사 홍보/ })
  choose('예산 항목', BUDGET)
  api.on('GET', `${BASE}/budget`, () => json({ period: null, items: [], suggested: null }))
  document.dispatchEvent(new Event('visibilitychange'))
  await waitFor(() => expect(screen.queryByRole('option', { name: /행사 홍보/ })).toBeNull())
  await settle()
  fireEvent.click(submit())
  await screen.findByRole('button', { name: '사진 올리기' })
  expect(api.calls.find(call => call.method === 'POST')?.body).toMatchObject({
    budgetItemId: null,
  })
})

const SPRING = '00000000-0000-4000-8000-0000000000e1'

function serveWithEvent() {
  const api = serve()
  api.on('GET', `${REQUESTS}?view=all`, () =>
    json({
      requests: [
        purchaseSummary('r1', {
          title: '행사 포스터',
          status: 'approved',
          event: { id: SPRING, name: '봄 축제' },
        }),
      ],
      truncated: false,
    }),
  )
  api.on('GET', `${BASE}/events`, () =>
    json({
      events: [
        eventSummary({ id: SPRING, name: '봄 축제' }),
        eventSummary({ id: '00000000-0000-4000-8000-0000000000e2', name: '가을 축제' }),
      ],
      truncated: false,
    }),
  )
  return api
}

test('행사가 있는 요청을 고르면 지출의 행사가 그 행사로 채워지고 잠기며, 그 행사를 보낸다', async () => {
  const api = serveWithEvent()
  api.on('POST', EXPENSES, () => json({ expense: expenseDetail('e1') }, 201))
  api.on('GET', `${EXPENSES}/e1`, () => json({ expense: expenseDetail('e1') }))
  showFinance()
  await openForm()
  const select = () => asElement(screen.getByLabelText('행사'), HTMLSelectElement)
  await waitFor(() => expect(select().disabled).toBe(false))
  expect(select().value).toBe('')
  fill('사용처', '인쇄소')
  fill('내역', '포스터 인쇄')
  await screen.findByRole('option', { name: '행사 포스터' })
  choose('결제할 요청', 'r1')
  await waitFor(() => expect(select().value).toBe(SPRING))
  expect(select().disabled).toBe(true)
  fireEvent.click(await screen.findByRole('checkbox', { name: /A2 포스터/ }))
  fireEvent.click(submit())
  await screen.findByRole('button', { name: '사진 올리기' })
  expect(api.calls.find(call => call.method === 'POST')?.body).toMatchObject({ eventId: SPRING })
})

test('요청을 비우면 지출의 행사 잠금이 풀린다', async () => {
  serveWithEvent()
  showFinance()
  await openForm()
  const select = () => asElement(screen.getByLabelText('행사'), HTMLSelectElement)
  await waitFor(() => expect(select().disabled).toBe(false))
  await screen.findByRole('option', { name: '행사 포스터' })
  choose('결제할 요청', 'r1')
  await waitFor(() => expect(select().disabled).toBe(true))
  choose('결제할 요청', '')
  await waitFor(() => expect(select().disabled).toBe(false))
  // 요청에서 채운 행사는 요청을 비우면 함께 지운다.
  expect(select().value).toBe('')
})

test('요청에서 채운 행사는 직접 적기로 바꿔도 지운다', async () => {
  serveWithEvent()
  showFinance()
  await openForm()
  const select = () => asElement(screen.getByLabelText('행사'), HTMLSelectElement)
  await waitFor(() => expect(select().disabled).toBe(false))
  await screen.findByRole('option', { name: '행사 포스터' })
  choose('결제할 요청', 'r1')
  await waitFor(() => expect(select().value).toBe(SPRING))
  fireEvent.click(screen.getByRole('button', { name: '요청 없이' }))
  await waitFor(() => expect(select().value).toBe(''))
  expect(select().disabled).toBe(false)
})

test('요청 없이 적을 때 예산 항목 고르기에는 지출 항목만 보인다', async () => {
  const api = serve()
  api.on('GET', `${BASE}/budget`, () =>
    json({
      period: { id: 'p1', name: '2026', startsOn: '2026-01-01', endsOn: '2026-12-31' },
      items: [
        { id: BUDGET, purpose: '행사 홍보', amount: 500000, type: 'expense', event: null },
        { id: 'in1', purpose: '참가비 수입', amount: 1, type: 'income', event: null },
      ],
      suggested: null,
    }),
  )
  showFinance()
  await openForm()
  fireEvent.click(screen.getByRole('button', { name: '요청 없이' }))
  await screen.findByRole('option', { name: /행사 홍보/ })
  expect(screen.queryByRole('option', { name: /참가비 수입/ })).toBeNull()
})

test('지출 적기가 409 EVENT_MISMATCH면 그 창 안에 문구가 보인다', async () => {
  const api = serve()
  api.on('POST', EXPENSES, () => json({ error: 'EVENT_MISMATCH' }, 409))
  showFinance()
  await fillRequestPayment()
  fireEvent.click(submit())
  expect(await screen.findByText(EXPENSE_ERRORS.EVENT_MISMATCH!)).toBeTruthy()
  expect(screen.getByRole('form', { name: '지출 적기' })).toBeTruthy()
})
