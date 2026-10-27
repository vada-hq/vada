// @vitest-environment jsdom
import { resetAddress } from '@/test-support/address-reset'
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
import { EXPENSE_CREATE_ERRORS, EXPENSE_ERRORS } from '@/lib/messages'
import { hasUnsavedInput } from '@/lib/leave-guard'

afterEach(async () => {
  cleanup()
  await resetAddress()
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
  payable: true,
})

function serve() {
  const api = serveFinance()
  api.on('GET', EXPENSES, () =>
    json({ expenses: [expenseSummary('0199d1a0-0000-7000-8000-00000000b101')], truncated: false }),
  )
  api.on('GET', `${BASE}/members`, () => json(team))
  api.on('GET', `${REQUESTS}?view=all`, () =>
    json({
      requests: [
        purchaseSummary('0199d1a0-0000-7000-8000-00000000a001', {
          title: '행사 포스터',
          status: 'approved',
          payable: true,
        }),
        purchaseSummary('0199d1a0-0000-7000-8000-00000000a002', {
          title: '아직 대기',
          status: 'pending',
          payable: true,
        }),
        purchaseSummary('0199d1a0-0000-7000-8000-00000000a003', {
          title: '취소한 요청',
          status: 'cancelled',
        }),
        purchaseSummary('0199d1a0-0000-7000-8000-00000000a004', {
          title: '완료한 행사 요청',
          status: 'approved',
        }),
      ],
      truncated: false,
    }),
  )
  api.on('GET', `${REQUESTS}/0199d1a0-0000-7000-8000-00000000a001`, () =>
    json({
      request: purchaseDetail('0199d1a0-0000-7000-8000-00000000a001', {
        items: [
          approvedItem(ITEM_1, 'A2 포스터', 30000),
          approvedItem(ITEM_2, '테이프', 6000),
          { ...approvedItem('i3', '반려된 것', 1000), status: 'rejected', payable: false },
        ],
      }),
    }),
  )
  api.on('GET', `${BASE}/budget`, () =>
    json({
      period: { id: 'p1', name: '2026', startsOn: '2026-01-01', endsOn: '2026-12-31' },
      items: [
        {
          id: BUDGET,
          purpose: '행사 홍보',
          amount: 500000,
          type: 'expense',
          event: null,
          selectable: true,
        },
      ],
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
// 보낼 때마다 새로 만드는 명령 번호는 모양만 본다.
const anyCommandId = expect.stringMatching(/^[0-9a-f-]{36}$/) as string
const choose = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } })
const today = () => koreanDateOf(new Date())
const tomorrow = () => koreanDateOf(new Date(Date.now() + 24 * 60 * 60 * 1000))

async function fillRequestPayment(method = 'card') {
  await openForm()
  fill('사용처', '인쇄소')
  fill('내역', '포스터 인쇄')
  await screen.findByRole('option', { name: '행사 포스터' })
  choose('결제할 요청', '0199d1a0-0000-7000-8000-00000000a001')
  fireEvent.click(await screen.findByRole('checkbox', { name: /A2 포스터/ }))
  fill('사용처', '인쇄소')
  fill('내역', '포스터 인쇄')
  if (method) choose('결제 수단', method)
}

test('요청한 품목을 고르면 결제 금액이 승인 금액으로 채워지고 합이 금액이 된다', async () => {
  const api = serve()
  api.on('POST', EXPENSES, () =>
    json({ expense: expenseDetail('0199d1a0-0000-7000-8000-00000000b101') }, 201),
  )
  api.on('GET', `${EXPENSES}/0199d1a0-0000-7000-8000-00000000b101`, () =>
    json({ expense: expenseDetail('0199d1a0-0000-7000-8000-00000000b101', { evidence: [] }) }),
  )
  showFinance()
  await fillRequestPayment()
  // 서버가 결제할 수 있다고 한(payable) 요청과 품목만 보인다.
  // 대기 요청도 결제할 수 있는 품목이 있으면 고를 수 있다. 상태가 승인이어도 payable이 아니면(완료한 행사) 없다.
  expect(screen.getByRole('option', { name: '아직 대기' })).toBeTruthy()
  expect(screen.queryByRole('option', { name: '취소한 요청' })).toBeNull()
  expect(screen.queryByRole('option', { name: '완료한 행사 요청' })).toBeNull()
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
    commandId: anyCommandId,
    vendor: '인쇄소',
    description: '포스터 인쇄',
    eventId: null,
    amount: 31000,
    paidOn: today(),
    method: 'card',
    paidBy: null,
    reason: purchaseDetail().body,
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

test('요청을 고르면 상세 본문 전체를 사유로 채운다', async () => {
  const api = serve()
  api.on('GET', `${REQUESTS}?view=all`, () =>
    json({
      requests: [
        purchaseSummary('0199d1a0-0000-7000-8000-00000000a001', {
          title: '행사 포스터',
          payable: true,
          bodyPreview: '짧은 미리보기',
        }),
      ],
      truncated: false,
    }),
  )
  showFinance()
  await fillRequestPayment()
  expect(asElement(screen.getByLabelText('사유'), HTMLTextAreaElement).value).toBe(
    purchaseDetail().body,
  )
})

test.each(['선택 전', '선택 후'])(
  '사람이 %s 직접 쓴 사유는 요청을 바꾸거나 풀어도 보존한다',
  async when => {
    const api = serve()
    api.on('GET', `${REQUESTS}/0199d1a0-0000-7000-8000-00000000a002`, () =>
      json({
        request: purchaseDetail('0199d1a0-0000-7000-8000-00000000a002', { body: '다른 요청 내용' }),
      }),
    )
    showFinance()
    await openForm()
    if (when === '선택 전') fill('사유', '직접 쓴 사유')
    await screen.findByRole('option', { name: '행사 포스터' })
    choose('결제할 요청', '0199d1a0-0000-7000-8000-00000000a001')
    await screen.findByRole('checkbox', { name: /A2 포스터/ })
    if (when === '선택 후') fill('사유', '직접 쓴 사유')
    choose('결제할 요청', '0199d1a0-0000-7000-8000-00000000a002')
    await screen.findByText('결제할 수 있는 승인된 품목이 없어요.')
    expect(asElement(screen.getByLabelText('사유'), HTMLTextAreaElement).value).toBe('직접 쓴 사유')
    choose('결제할 요청', '')
    expect(asElement(screen.getByLabelText('사유'), HTMLTextAreaElement).value).toBe('직접 쓴 사유')
    fireEvent.click(screen.getByRole('button', { name: '요청 없이' }))
    expect(asElement(screen.getByLabelText('사유'), HTMLTextAreaElement).value).toBe('직접 쓴 사유')
  },
)

test('자동으로 채운 사유는 다른 요청을 고르면 새 본문으로 바뀐다', async () => {
  const api = serve()
  api.on('GET', `${REQUESTS}/0199d1a0-0000-7000-8000-00000000a002`, () =>
    json({
      request: purchaseDetail('0199d1a0-0000-7000-8000-00000000a002', { body: '다른 요청 내용' }),
    }),
  )
  showFinance()
  await fillRequestPayment()
  expect(asElement(screen.getByLabelText('사유'), HTMLTextAreaElement).value).toBe(
    purchaseDetail().body,
  )
  choose('결제할 요청', '0199d1a0-0000-7000-8000-00000000a002')
  await waitFor(() =>
    expect(asElement(screen.getByLabelText('사유'), HTMLTextAreaElement).value).toBe(
      '다른 요청 내용',
    ),
  )
})

test.each(['선택 해제', '요청 없이'])('%s로 바꾸면 자동으로 채운 사유만 비운다', async action => {
  serve()
  showFinance()
  await fillRequestPayment()
  expect(asElement(screen.getByLabelText('사유'), HTMLTextAreaElement).value).toBe(
    purchaseDetail().body,
  )
  if (action === '선택 해제') choose('결제할 요청', '')
  else fireEvent.click(screen.getByRole('button', { name: '요청 없이' }))
  expect(asElement(screen.getByLabelText('사유'), HTMLTextAreaElement).value).toBe('')
})

test.each([null, ''])(
  '본문이 %s인 요청은 제목을 사유로 쓰지 않고 이전 자동값을 비운다',
  async body => {
    const api = serve()
    api.on('GET', `${REQUESTS}/0199d1a0-0000-7000-8000-00000000a002`, () =>
      json({ request: purchaseDetail('0199d1a0-0000-7000-8000-00000000a002', { body }) }),
    )
    showFinance()
    await fillRequestPayment()
    expect(asElement(screen.getByLabelText('사유'), HTMLTextAreaElement).value).toBe(
      purchaseDetail().body,
    )
    choose('결제할 요청', '0199d1a0-0000-7000-8000-00000000a002')
    await screen.findByText('결제할 수 있는 승인된 품목이 없어요.')
    expect(asElement(screen.getByLabelText('사유'), HTMLTextAreaElement).value).toBe('')
  },
)

test('상세를 기다리는 동안 직접 쓴 사유는 늦은 본문이 덮어쓰지 않는다', async () => {
  const api = serve()
  const pending = deferredResponse()
  const path = `${REQUESTS}/0199d1a0-0000-7000-8000-00000000a001`
  api.on('GET', path, () => pending.promise)
  showFinance()
  await openForm()
  await screen.findByRole('option', { name: '행사 포스터' })
  choose('결제할 요청', '0199d1a0-0000-7000-8000-00000000a001')
  await waitFor(() => expect(api.calls.some(call => call.path === path)).toBe(true))
  fill('사유', '기다리며 직접 쓴 사유')
  pending.resolve(json({ request: purchaseDetail('0199d1a0-0000-7000-8000-00000000a001') }))
  await screen.findByText('결제할 수 있는 승인된 품목이 없어요.')
  expect(asElement(screen.getByLabelText('사유'), HTMLTextAreaElement).value).toBe(
    '기다리며 직접 쓴 사유',
  )
})

test('요청을 바꾸면 고른 품목을 비우고, 품목이나 요청이 없으면 적기를 눌러도 보내지 않고 알린다', async () => {
  const api = serve()
  showFinance()
  await fillRequestPayment()
  expect(submit().disabled).toBe(false)
  fireEvent.click(screen.getByRole('checkbox', { name: /A2 포스터/ }))
  fireEvent.click(submit())
  expect(screen.getByText('결제한 품목을 골라 주세요')).toBeTruthy()
  fireEvent.click(screen.getByRole('checkbox', { name: /A2 포스터/ }))
  expect(screen.queryByText('결제한 품목을 골라 주세요')).toBeNull()
  choose('결제할 요청', '')
  expect(screen.queryByRole('checkbox')).toBeNull()
  fireEvent.click(submit())
  expect(screen.getByText('결제할 요청을 골라 주세요')).toBeTruthy()
  expect(screen.getByLabelText('결제할 요청').getAttribute('aria-invalid')).toBe('true')
  expect(api.calls.some(call => call.method === 'POST')).toBe(false)
})

test('요청 없이 적으면 먼저 낸 사람, 부탁한 사람, 예산 항목을 고르고 금액을 쓴다', async () => {
  const api = serve()
  api.on('POST', EXPENSES, () =>
    json({ expense: expenseDetail('0199d1a0-0000-7000-8000-00000000b101') }, 201),
  )
  api.on('GET', `${EXPENSES}/0199d1a0-0000-7000-8000-00000000b101`, () =>
    json({ expense: expenseDetail('0199d1a0-0000-7000-8000-00000000b101') }),
  )
  showFinance()
  await openForm()
  fireEvent.click(screen.getByRole('button', { name: '요청 없이' }))
  expect(screen.queryByLabelText('결제할 요청')).toBeNull()
  fill('사용처', '편의점')
  fill('내역', '간식')
  fill('금액(원)', '12000')
  choose('결제 수단', 'card')
  await screen.findByRole('option', { name: /행사 홍보/ })
  choose('예산 항목', BUDGET)
  choose('부탁한 사람', JAEJEONG)
  choose('먼저 낸 사람', SAEIN)
  choose('결제 수단', 'cash')
  fill('사유', '급해서 먼저 결제')
  const options = within(screen.getByLabelText('먼저 낸 사람')).getAllByRole('option')
  expect(options.map(option => option.textContent)).toEqual(['학생회 돈', '나', '이재정', '박새내'])
  fireEvent.click(submit())
  await screen.findByRole('button', { name: '사진 올리기' })
  expect(api.calls.find(call => call.method === 'POST')?.body).toEqual({
    commandId: anyCommandId,
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
  api.on('POST', EXPENSES, () =>
    json({ expense: expenseDetail('0199d1a0-0000-7000-8000-00000000b101') }, 201),
  )
  api.on('GET', `${EXPENSES}/0199d1a0-0000-7000-8000-00000000b101`, () =>
    json({ expense: expenseDetail('0199d1a0-0000-7000-8000-00000000b101') }),
  )
  showFinance()
  await openForm()
  fireEvent.click(screen.getByRole('button', { name: '요청 없이' }))
  fill('사용처', '편의점')
  fill('내역', '간식')
  fill('금액(원)', '12000')
  choose('결제 수단', 'card')
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

test('결제일은 오늘까지만 받고, 필수 칸이 비거나 값이 맞지 않으면 적기를 눌러도 보내지 않고 그 칸 아래에 알린다', async () => {
  const api = serve()
  showFinance()
  await openForm()
  fireEvent.click(screen.getByRole('button', { name: '요청 없이' }))
  expect(asElement(screen.getByLabelText('결제일'), HTMLInputElement).value).toBe(today())
  expect(submit().disabled).toBe(false)
  fireEvent.click(submit())
  expect(screen.getByText('사용처를 입력해 주세요')).toBeTruthy()
  expect(screen.getByText('내역을 입력해 주세요')).toBeTruthy()
  expect(screen.getByText('금액을 입력해 주세요')).toBeTruthy()
  await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText('사용처')))
  fill('사용처', '편의점')
  fill('내역', '   ')
  fill('금액(원)', '1000')
  choose('결제 수단', 'card')
  fireEvent.click(submit())
  expect(screen.getByText('내역을 입력해 주세요')).toBeTruthy()
  fill('내역', '간식')
  fill('결제일', tomorrow())
  fireEvent.click(submit())
  expect(screen.getByText('오늘이나 그 전 날짜를 입력해 주세요')).toBeTruthy()
  fill('결제일', today())
  fill('금액(원)', '0')
  fireEvent.click(submit())
  expect(screen.getByText('1 이상의 숫자를 입력해 주세요')).toBeTruthy()
  expect(screen.getByLabelText('금액(원)').getAttribute('aria-invalid')).toBe('true')
  expect(api.calls.some(call => call.method === 'POST')).toBe(false)
})

async function readyDirect() {
  await openForm()
  fireEvent.click(screen.getByRole('button', { name: '요청 없이' }))
  fill('사용처', '편의점')
  fill('내역', '간식')
  fill('금액(원)', '1000')
  choose('결제 수단', 'card')
}

test('두 번 누르면 한 번만 나가고 보내는 동안 닫을 수 없다', async () => {
  const api = serve()
  const pending = deferredResponse()
  api.on('POST', EXPENSES, () => pending.promise)
  api.on('GET', `${EXPENSES}/0199d1a0-0000-7000-8000-00000000b101`, () =>
    json({ expense: expenseDetail('0199d1a0-0000-7000-8000-00000000b101') }),
  )
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
  pending.resolve(json({ expense: expenseDetail('0199d1a0-0000-7000-8000-00000000b101') }, 201))
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
        purchaseSummary('0199d1a0-0000-7000-8000-00000000a001', {
          title: '일부만 결재',
          status: 'pending',
          payable: true,
        }),
        purchaseSummary('0199d1a0-0000-7000-8000-00000000a004', {
          title: '반려됨',
          status: 'rejected',
        }),
      ],
      truncated: false,
    }),
  )
  api.on('GET', `${REQUESTS}/0199d1a0-0000-7000-8000-00000000a001`, () =>
    json({
      request: purchaseDetail('0199d1a0-0000-7000-8000-00000000a001', {
        items: [approvedItem(ITEM_1, 'A2 포스터', 30000), purchaseDetail().items[0]!],
      }),
    }),
  )
  showFinance()
  await openForm()
  await screen.findByRole('option', { name: '일부만 결재' })
  expect(screen.queryByRole('option', { name: '반려됨' })).toBeNull()
  choose('결제할 요청', '0199d1a0-0000-7000-8000-00000000a001')
  expect(await screen.findAllByRole('checkbox')).toHaveLength(1)
  api.on('GET', `${REQUESTS}/0199d1a0-0000-7000-8000-00000000a001`, () =>
    json({
      request: purchaseDetail('0199d1a0-0000-7000-8000-00000000a001', {
        items: [purchaseDetail().items[0]!],
      }),
    }),
  )
  choose('결제할 요청', '')
  choose('결제할 요청', '0199d1a0-0000-7000-8000-00000000a001')
  await screen.findByText('결제할 수 있는 승인된 품목이 없어요.')
})

test('고른 예산 항목이 다시 읽은 목록에서 사라지면 값을 비운다', async () => {
  const api = serve()
  api.on('POST', EXPENSES, () =>
    json({ expense: expenseDetail('0199d1a0-0000-7000-8000-00000000b101') }, 201),
  )
  api.on('GET', `${EXPENSES}/0199d1a0-0000-7000-8000-00000000b101`, () =>
    json({ expense: expenseDetail('0199d1a0-0000-7000-8000-00000000b101') }),
  )
  showFinance()
  await readyDirect()
  await screen.findByRole('option', { name: /행사 홍보/ })
  choose('예산 항목', BUDGET)
  api.on('GET', `${BASE}/budget`, () => json({ period: null, items: [] }))
  document.dispatchEvent(new Event('visibilitychange'))
  await waitFor(() => expect(screen.queryByRole('option', { name: /행사 홍보/ })).toBeNull())
  await settle()
  fireEvent.click(submit())
  await screen.findByRole('button', { name: '사진 올리기' })
  expect(api.calls.find(call => call.method === 'POST')?.body).toMatchObject({
    budgetItemId: null,
  })
})

test('고른 요청이 다시 읽은 목록에서 결제할 수 없게 되면 요청과 품목을 비워 숨은 줄이 나가지 않는다', async () => {
  const api = serve()
  api.on('POST', EXPENSES, () =>
    json({ expense: expenseDetail('0199d1a0-0000-7000-8000-00000000b101') }, 201),
  )
  showFinance()
  await fillRequestPayment()
  api.on('GET', `${REQUESTS}?view=all`, () =>
    json({
      requests: [
        purchaseSummary('0199d1a0-0000-7000-8000-00000000a001', {
          title: '행사 포스터',
          status: 'approved',
        }),
      ],
      truncated: false,
    }),
  )
  document.dispatchEvent(new Event('visibilitychange'))
  await waitFor(() => expect(screen.queryByRole('checkbox', { name: /A2 포스터/ })).toBeNull())
  expect(asElement(screen.getByLabelText('결제할 요청'), HTMLSelectElement).value).toBe('')
  fireEvent.click(submit())
  await screen.findByText('결제할 요청을 골라 주세요')
  expect(api.calls.some(call => call.method === 'POST')).toBe(false)
})

test('고른 품목이 다시 읽은 상세에서 결제할 수 없게 되면 그 줄을 비워 보내지 않는다', async () => {
  const api = serve()
  api.on('POST', EXPENSES, () =>
    json({ expense: expenseDetail('0199d1a0-0000-7000-8000-00000000b101') }, 201),
  )
  api.on('GET', `${EXPENSES}/0199d1a0-0000-7000-8000-00000000b101`, () =>
    json({ expense: expenseDetail('0199d1a0-0000-7000-8000-00000000b101') }),
  )
  showFinance()
  await fillRequestPayment()
  fireEvent.click(await screen.findByRole('checkbox', { name: /테이프/ }))
  api.on('GET', `${REQUESTS}/0199d1a0-0000-7000-8000-00000000a001`, () =>
    json({
      request: purchaseDetail('0199d1a0-0000-7000-8000-00000000a001', {
        items: [
          { ...approvedItem(ITEM_1, 'A2 포스터', 30000), payable: false },
          approvedItem(ITEM_2, '테이프', 6000),
        ],
      }),
    }),
  )
  document.dispatchEvent(new Event('visibilitychange'))
  await waitFor(() => expect(screen.queryByRole('checkbox', { name: /A2 포스터/ })).toBeNull())
  await settle()
  fireEvent.click(submit())
  await screen.findByRole('button', { name: '사진 올리기' })
  expect(api.calls.find(call => call.method === 'POST')?.body).toMatchObject({
    lines: [{ lineItemId: ITEM_2, amount: 6000 }],
    amount: 6000,
  })
})

const SPRING = '00000000-0000-4000-8000-0000000000e1'

function serveWithEvent() {
  const api = serve()
  api.on('GET', `${REQUESTS}?view=all`, () =>
    json({
      requests: [
        purchaseSummary('0199d1a0-0000-7000-8000-00000000a001', {
          title: '행사 포스터',
          status: 'approved',
          payable: true,
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
  api.on('POST', EXPENSES, () =>
    json({ expense: expenseDetail('0199d1a0-0000-7000-8000-00000000b101') }, 201),
  )
  api.on('GET', `${EXPENSES}/0199d1a0-0000-7000-8000-00000000b101`, () =>
    json({ expense: expenseDetail('0199d1a0-0000-7000-8000-00000000b101') }),
  )
  showFinance()
  await openForm()
  const select = () => asElement(screen.getByLabelText('행사'), HTMLSelectElement)
  await waitFor(() => expect(select().disabled).toBe(false))
  expect(select().value).toBe('')
  fill('사용처', '인쇄소')
  fill('내역', '포스터 인쇄')
  await screen.findByRole('option', { name: '행사 포스터' })
  choose('결제할 요청', '0199d1a0-0000-7000-8000-00000000a001')
  await waitFor(() => expect(select().value).toBe(SPRING))
  expect(select().disabled).toBe(true)
  choose('결제 수단', 'card')
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
  choose('결제할 요청', '0199d1a0-0000-7000-8000-00000000a001')
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
  choose('결제할 요청', '0199d1a0-0000-7000-8000-00000000a001')
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
        {
          id: BUDGET,
          purpose: '행사 홍보',
          amount: 500000,
          type: 'expense',
          event: null,
          selectable: true,
        },
        {
          id: 'in1',
          purpose: '참가비 수입',
          amount: 1,
          type: 'income',
          event: null,
          selectable: true,
        },
      ],
    }),
  )
  showFinance()
  await openForm()
  fireEvent.click(screen.getByRole('button', { name: '요청 없이' }))
  await screen.findByRole('option', { name: /행사 홍보/ })
  expect(screen.queryByRole('option', { name: /참가비 수입/ })).toBeNull()
})

test('요청 없이 적을 때 예산 항목은 고를 수 있는 것만 보이고 고른 행사와 맞는 것으로 좁혀진다', async () => {
  const api = serveWithEvent()
  const item = (id: string, purpose: string, eventId: string | null, selectable = true) => ({
    id,
    purpose,
    amount: 1,
    type: 'expense',
    event: eventId ? { id: eventId, name: '행사' } : null,
    selectable,
  })
  api.on('GET', `${BASE}/budget`, () =>
    json({
      period: { id: 'p1', name: '2026', startsOn: '2026-01-01', endsOn: '2026-12-31' },
      items: [
        item(BUDGET, '상시 비품', null),
        item('a1', '봄 항목', SPRING),
        item('a2', '다른 행사 항목', 'other-event'),
        item('a3', '끝난 항목', null, false),
      ],
    }),
  )
  showFinance()
  await openForm()
  fireEvent.click(screen.getByRole('button', { name: '요청 없이' }))
  const names = () =>
    Array.from(
      asElement(screen.getByLabelText('예산 항목'), HTMLSelectElement).options,
      option => option.textContent,
    )
  await screen.findByRole('option', { name: /상시 비품/ })
  expect(names().some(name => name?.includes('끝난 항목'))).toBe(false)
  expect(names().filter(name => name?.includes('항목')).length).toBe(2)
  choose('행사', SPRING)
  await waitFor(() => expect(names().some(name => name?.includes('다른 행사 항목'))).toBe(false))
  expect(names().some(name => name?.includes('봄 항목'))).toBe(true)
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

// 명령 번호(017-3): 실패 뒤 다시 누르면 같은 번호, 칸을 바꾸면 새 번호, 닫으면 버린다.
const postedIds = (api: ReturnType<typeof serve>) =>
  api.calls
    .filter(call => call.method === 'POST')
    .map(call => (call.body as { commandId: string }).commandId)

async function fillDirect() {
  await openForm()
  fireEvent.click(screen.getByRole('button', { name: '요청 없이' }))
  fill('사용처', '편의점')
  fill('내역', '간식')
  fill('금액(원)', '12000')
  choose('결제 수단', 'card')
}
const press = async () => {
  fireEvent.click(submit())
  await settle()
}

test('실패 뒤 다시 누르면 같은 번호, 칸을 바꾸면 새 번호를 보낸다', async () => {
  const api = serve()
  api.on('POST', EXPENSES, () => json({ error: 'FAILED' }, 500))
  showFinance()
  await fillDirect()
  await press()
  await press()
  fill('금액(원)', '13000')
  await press()
  const [first, again, edited] = postedIds(api)
  expect(again).toBe(first)
  expect(edited).not.toBe(first)
  expect(screen.getByRole('form', { name: '지출 적기' })).toBeTruthy()
})

test('닫았다 다시 열면 같은 값을 넣어도 새 번호다', async () => {
  const api = serve()
  api.on('POST', EXPENSES, () => json({ error: 'FAILED' }, 500))
  showFinance()
  await fillDirect()
  await press()
  fireEvent.click(
    within(screen.getByRole('form', { name: '지출 적기' })).getByRole('button', { name: '닫기' }),
  )
  await waitFor(() => expect(screen.queryByRole('form', { name: '지출 적기' })).toBeNull())
  await fillDirect()
  await press()
  const [first, reopened] = postedIds(api)
  expect(reopened).not.toBe(first)
})

test('422 COMMAND_REUSED는 문구를 보이고 다음에는 새 번호를 보낸다', async () => {
  const api = serve()
  api.on('POST', EXPENSES, () => json({ error: 'COMMAND_REUSED' }, 422))
  showFinance()
  await fillDirect()
  await press()
  expect(await screen.findByText(EXPENSE_CREATE_ERRORS.COMMAND_REUSED!)).toBeTruthy()
  await press()
  const [first, second] = postedIds(api)
  expect(second).not.toBe(first)
})

test('409 COMMAND_CONFLICT는 같은 번호로 다시 보낼 수 있다', async () => {
  const api = serve()
  api.on('POST', EXPENSES, () => json({ error: 'COMMAND_CONFLICT' }, 409))
  showFinance()
  await fillDirect()
  await press()
  expect(await screen.findByText(EXPENSE_CREATE_ERRORS.COMMAND_CONFLICT!)).toBeTruthy()
  await press()
  const [first, second] = postedIds(api)
  expect(second).toBe(first)
})

test('쓰던 입력이 남으면 떠날 때 확인을 걸고, 비우거나 닫으면 푼다', async () => {
  serve()
  showFinance()
  await openForm()
  expect(hasUnsavedInput()).toBe(false)
  fill('사용처', '인쇄소')
  expect(hasUnsavedInput()).toBe(true)
  fill('사용처', '')
  expect(hasUnsavedInput()).toBe(false)
  fill('사용처', '인쇄소')
  fireEvent.click(screen.getAllByRole('button', { name: '닫기' }).at(-1)!)
  await waitFor(() => expect(hasUnsavedInput()).toBe(false))
})

test('먼저 쓴 사용처와 내역은 요청을 고르거나 바꿔도 그대로이고 떠날 때 묻는다', async () => {
  serve()
  showFinance()
  await openForm()
  fill('사용처', '쿠팡')
  fill('내역', '간식 구입')
  await screen.findByRole('option', { name: '행사 포스터' })
  choose('결제할 요청', '0199d1a0-0000-7000-8000-00000000a001')
  fireEvent.click(await screen.findByRole('checkbox', { name: /A2 포스터/ }))
  expect(screen.getByLabelText('사용처')).toHaveProperty('value', '쿠팡')
  expect(screen.getByLabelText('내역')).toHaveProperty('value', '간식 구입')
  choose('결제할 요청', '0199d1a0-0000-7000-8000-00000000a002')
  fireEvent.click(screen.getByRole('button', { name: '요청 없이' }))
  expect(screen.getByLabelText('사용처')).toHaveProperty('value', '쿠팡')
  expect(screen.getByLabelText('내역')).toHaveProperty('value', '간식 구입')
  expect(hasUnsavedInput()).toBe(true)
})

test('결제 수단은 빈칸이고 누르면 해당 칸에 필수 오류와 포커스가 간다', async () => {
  const api = serve()
  showFinance()
  await fillRequestPayment('')
  const method = asElement(screen.getByLabelText('결제 수단'), HTMLSelectElement)
  expect(method.value).toBe('')
  fireEvent.click(submit())
  expect(await screen.findByText('결제 수단을 골라 주세요')).toBeTruthy()
  await waitFor(() => expect(document.activeElement).toBe(method))
  expect(method.getAttribute('aria-required')).toBe('true')
  expect(api.calls.some(call => call.method === 'POST')).toBe(false)
})

test('요청 제목·품목 도메인·오늘로 채워지고 고친 값이 보내진다', async () => {
  const api = serve()
  api.on('POST', EXPENSES, () => json({ error: 'FAILED' }, 500))
  showFinance()
  await openForm()
  await screen.findByRole('option', { name: '행사 포스터' })
  choose('결제할 요청', '0199d1a0-0000-7000-8000-00000000a001')
  fireEvent.click(await screen.findByRole('checkbox', { name: /A2 포스터/ }))
  expect(screen.getByLabelText('내역')).toHaveProperty('value', '행사 포스터')
  expect(screen.getByLabelText('사용처')).toHaveProperty('value', 'example.com')
  expect(screen.getByLabelText('결제일')).toHaveProperty('value', today())
  fill('내역', '고친 내역')
  fill('사용처', '고친 가게')
  fill('결제일', '2020-01-01')
  choose('결제 수단', 'transfer')
  document.dispatchEvent(new Event('visibilitychange'))
  await settle()
  fireEvent.click(submit())
  await screen.findByRole('alert')
  expect(api.calls.find(call => call.method === 'POST')?.body).toMatchObject({
    description: '고친 내역',
    vendor: '고친 가게',
    paidOn: '2020-01-01',
    method: 'transfer',
  })
})

test.each([36000, 36001])(
  '승인액 1.2배 경계(%i)에서 초과만 확인하고 닫으면 보내지 않는다',
  async amount => {
    const api = serve()
    api.on('POST', EXPENSES, () => json({ error: 'FAILED' }, 500))
    showFinance()
    await fillRequestPayment()
    choose('결제 수단', 'cash')
    fill('A2 포스터 결제 금액', String(amount))
    fireEvent.click(submit())
    if (amount === 36001) {
      const confirm = await screen.findByRole('dialog', { name: '금액과 자릿수를 확인하세요' })
      expect(api.calls.some(call => call.method === 'POST')).toBe(false)
      fireEvent.click(within(confirm).getAllByRole('button', { name: '닫기' })[0]!)
      await waitFor(() =>
        expect(screen.queryByRole('dialog', { name: '금액과 자릿수를 확인하세요' })).toBeNull(),
      )
      expect(screen.getByLabelText('A2 포스터 결제 금액')).toHaveProperty('value', '36001')
      fireEvent.click(submit())
      const reopened = await screen.findByRole('dialog', { name: '금액과 자릿수를 확인하세요' })
      fireEvent.click(within(reopened).getByRole('button', { name: '그래도 적기' }))
    }
    await waitFor(() => expect(api.calls.filter(call => call.method === 'POST')).toHaveLength(1))
    expect(api.calls.find(call => call.method === 'POST')?.body).toMatchObject({
      lines: [{ lineItemId: ITEM_1, amount }],
    })
  },
)

test('금액 확인 뒤 보내는 중에는 재전송·닫기를 막고 실패는 확인 창에 보인다', async () => {
  const api = serve()
  const pending = deferredResponse()
  api.on('POST', EXPENSES, () => pending.promise)
  showFinance()
  await fillRequestPayment()
  fill('A2 포스터 결제 금액', '36001')
  fireEvent.click(submit())
  const confirm = await screen.findByRole('dialog', { name: '금액과 자릿수를 확인하세요' })
  const send = within(confirm).getByRole('button', { name: '그래도 적기' })
  fireEvent.click(send)
  fireEvent.click(send)
  await waitFor(() => expect(api.calls.filter(call => call.method === 'POST')).toHaveLength(1))
  expect(send).toHaveProperty('disabled', true)
  expect(within(confirm).getAllByRole('button', { name: '닫기' })[0]).toHaveProperty(
    'disabled',
    true,
  )
  fireEvent.keyDown(confirm, { key: 'Escape' })
  expect(screen.getByRole('dialog', { name: '금액과 자릿수를 확인하세요' })).toBeTruthy()
  pending.resolve(json({ error: 'LINE_ITEM_NOT_PAYABLE' }, 409))
  expect((await within(confirm).findByRole('alert')).textContent).toContain(
    '결제할 수 없는 품목이 있어요',
  )
  await waitFor(() => expect(send).toHaveProperty('disabled', false))
})
