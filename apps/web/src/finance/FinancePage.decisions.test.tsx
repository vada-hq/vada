// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { BudgetResponse, PurchaseRequestDetail } from '@vada/contracts'
import {
  BUDGET_A,
  BUDGET_B,
  budgetWithPeriod,
  budgetWithoutPeriod,
  LINE_1,
  LINE_2,
} from '@/test-support/budget-fixtures'
import { councilView, FINANCE_PERMISSIONS } from '@/test-support/council-fixtures'
import { asElement } from '@/test-support/elements'
import { deferredResponse, json, mockApi } from '@/test-support/mock-api'
import { purchaseDetail, purchaseSummary } from '@/test-support/purchase-fixtures'
import { PERMISSION_CHANGED } from '@/lib/messages'
import { forgetRememberedItems } from './decision-form'
import FinancePage from './FinancePage'

beforeEach(forgetRememberedItems)
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const ORG = '/api/organizations/c1'
const BASE = `${ORG}/purchase-requests`

const pendingItem = (id: string, name: string) => ({
  id,
  name,
  quantity: 2,
  link: null,
  options: null,
  amount: null,
  budgetItem: null,
  status: 'pending' as const,
  paid: false,
  actions: [],
})
const twoPending = (extra: Partial<PurchaseRequestDetail> = {}) =>
  purchaseDetail('r1', {
    items: [pendingItem(LINE_1, '포스터'), pendingItem(LINE_2, '테이프')],
    decisions: [],
    actions: ['purchase.approve'],
    ...extra,
  })

function setup(detail = twoPending(), budget: BudgetResponse = budgetWithPeriod()) {
  const api = mockApi()
  api.on('GET', `${BASE}?view=mine`, () =>
    json({ requests: [purchaseSummary('r1')], truncated: false }),
  )
  api.on('GET', `${BASE}/r1`, () => json({ request: detail }))
  api.on('GET', `${ORG}/budget`, () => json(budget))
  const handlers = { onForbidden: vi.fn(), onChanged: vi.fn(), onOpenEvent: vi.fn() }
  render(
    <FinancePage view={councilView('c1', { permissions: FINANCE_PERMISSIONS })} {...handlers} />,
  )
  return { api, handlers }
}
const open = async () => {
  fireEvent.click(await screen.findByRole('button', { name: '요청 r1' }))
  return screen.findByRole('group', { name: '결재 포스터' })
}
const btn = (name: string) => asElement(screen.getByRole('button', { name }), HTMLButtonElement)
const fill = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } })
const posts = (api: ReturnType<typeof mockApi>) => api.calls.filter(c => c.method === 'POST')

test('purchase.approve가 없으면 결재 칸이 없고 예산도 읽지 않는다', async () => {
  const { api } = setup(twoPending({ actions: [] }))
  fireEvent.click(await screen.findByRole('button', { name: '요청 r1' }))
  await screen.findByText('포스터 × 2')
  expect(screen.queryByRole('region', { name: '결재' })).toBeNull()
  expect(api.calls.some(call => call.path === `${ORG}/budget`)).toBe(false)
})

test('[승인]은 늘 켜져 있고 누르면 비운 칸 아래에 이유가 보이며 아무것도 보내지 않는다', async () => {
  const { api } = setup()
  const group = within(await open())
  expect(btn('포스터 승인').disabled).toBe(false)
  fireEvent.click(btn('포스터 승인'))
  expect(group.getByText('금액을 입력해 주세요')).toBeTruthy()
  expect(group.getByText('예산 항목을 골라 주세요')).toBeTruthy()
  await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText('포스터 금액')))
  // 다른 줄에는 보이지 않는다.
  expect(
    within(screen.getByRole('group', { name: '결재 테이프' })).queryByText(/입력해 주세요/),
  ).toBeNull()
  fill('포스터 금액', '15000')
  expect(group.queryByText('금액을 입력해 주세요')).toBeNull()
  fill('포스터 예산 항목', BUDGET_A)
  expect(group.queryByText('예산 항목을 골라 주세요')).toBeNull()
  fill('포스터 금액', '0')
  expect(group.getByText('더 큰 값을 입력해 주세요')).toBeTruthy()
  fireEvent.click(btn('포스터 승인'))
  expect(posts(api)).toHaveLength(0)
  expect(btn('테이프 반려')).toBeTruthy()
})

test('승인하면 금액과 항목을 그 품목만 보내고 요청과 수를 다시 읽는다', async () => {
  const { api, handlers } = setup()
  let reads = 0
  api.on('GET', `${BASE}/r1`, () => {
    reads += 1
    return json({ request: reads === 1 ? twoPending() : twoPending({ status: 'partial' }) })
  })
  api.on('POST', `${BASE}/r1/decisions`, () => json({ request: twoPending() }))
  await open()
  fill('포스터 금액', '15,000')
  fill('포스터 예산 항목', BUDGET_A)
  fireEvent.click(btn('포스터 승인'))
  await waitFor(() => expect(reads).toBeGreaterThan(1))
  expect(posts(api)[0]?.body).toEqual({
    decisions: [{ lineItemId: LINE_1, outcome: 'approved', amount: 15000, budgetItemId: BUDGET_A }],
  })
  expect(handlers.onChanged).toHaveBeenCalled()
})

test('반려는 사유 칸이 열리고 사유가 비면 누를 때 이유가 보인다', async () => {
  const { api } = setup()
  api.on('POST', `${BASE}/r1/decisions`, () => json({ request: twoPending() }))
  await open()
  expect(screen.queryByLabelText('테이프 반려 사유')).toBeNull()
  fireEvent.click(btn('테이프 반려'))
  expect(btn('테이프 반려 보내기').disabled).toBe(false)
  fill('테이프 반려 사유', '   ')
  fireEvent.click(btn('테이프 반려 보내기'))
  expect(screen.getByText('반려 사유를 입력해 주세요')).toBeTruthy()
  expect(posts(api)).toHaveLength(0)
  fill('테이프 반려 사유', '이미 있어요')
  fireEvent.click(btn('테이프 반려 보내기'))
  await waitFor(() => expect(posts(api)).toHaveLength(1))
  expect(posts(api)[0]?.body).toEqual({
    decisions: [{ lineItemId: LINE_2, outcome: 'rejected', reason: '이미 있어요' }],
  })
})

test('[모두 승인]은 늘 켜져 있고 비운 줄마다 이유가 보인 뒤 다 채우면 한 번에 보낸다', async () => {
  const { api } = setup()
  api.on('POST', `${BASE}/r1/decisions`, () => json({ request: twoPending() }))
  await open()
  expect(btn('모두 승인').disabled).toBe(false)
  fireEvent.click(btn('모두 승인'))
  expect(screen.getAllByText('금액을 입력해 주세요')).toHaveLength(2)
  fill('포스터 금액', '1000')
  fill('포스터 예산 항목', BUDGET_A)
  fill('테이프 금액', '500')
  fireEvent.click(btn('모두 승인'))
  expect(screen.getByText('예산 항목을 골라 주세요')).toBeTruthy()
  expect(posts(api)).toHaveLength(0)
  fill('테이프 예산 항목', BUDGET_B)
  fireEvent.click(btn('모두 승인'))
  await waitFor(() => expect(posts(api)).toHaveLength(1))
  expect(posts(api)[0]?.body).toEqual({
    decisions: [
      { lineItemId: LINE_1, outcome: 'approved', amount: 1000, budgetItemId: BUDGET_A },
      { lineItemId: LINE_2, outcome: 'approved', amount: 500, budgetItemId: BUDGET_B },
    ],
  })
})

test('마지막에 승인한 항목이 다음 줄의 기본이 되고, 목록에 없으면 비어 있다', async () => {
  const { api } = setup()
  api.on('POST', `${BASE}/r1/decisions`, () => json({ request: twoPending() }))
  await open()
  const select = () => asElement(screen.getByLabelText('테이프 예산 항목'), HTMLSelectElement)
  expect(select().value).toBe('')
  fill('포스터 금액', '1000')
  fill('포스터 예산 항목', BUDGET_B)
  fireEvent.click(btn('포스터 승인'))
  await waitFor(() => expect(select().value).toBe(BUDGET_B))
  // 기간이 바뀌어 그 항목이 사라지면(같은 값으로 다시 와도 목록에 없으면) 기본은 비어 있다.
  cleanup()
  const other = budgetWithPeriod()
  other.items = [{ id: BUDGET_A, purpose: '행사 홍보', amount: 1, type: 'expense', event: null }]
  api.on('GET', `${ORG}/budget`, () => json(other))
  render(
    <FinancePage
      view={councilView('c1', { permissions: FINANCE_PERMISSIONS })}
      onForbidden={vi.fn()}
      onChanged={vi.fn()}
      onOpenEvent={vi.fn()}
    />,
  )
  await open()
  expect(select().value).toBe('')
  // 낡은 항목으로는 보낼 수 없다(금액만 써서는 누를 때 항목을 고르라고 한다).
  fill('포스터 금액', '1000')
  const sent = posts(api).length
  fireEvent.click(btn('포스터 승인'))
  expect(screen.getByText('예산 항목을 골라 주세요')).toBeTruthy()
  expect(posts(api)).toHaveLength(sent)
})

test('보내는 동안 줄이 막히고 두 번 눌러도 한 번만 간다', async () => {
  const { api } = setup()
  const slow = deferredResponse()
  api.on('POST', `${BASE}/r1/decisions`, () => slow.promise)
  await open()
  fill('포스터 금액', '1000')
  fill('포스터 예산 항목', BUDGET_A)
  fireEvent.click(btn('포스터 승인'))
  fireEvent.click(btn('포스터 승인'))
  await waitFor(() => expect(btn('포스터 승인').disabled).toBe(true))
  expect(btn('테이프 반려').disabled).toBe(true)
  slow.resolve(json({ request: twoPending() }))
  await waitFor(() => expect(btn('테이프 반려').disabled).toBe(false))
  expect(posts(api)).toHaveLength(1)
})

test('이미 결재됐으면(409) 문구를 보이고 요청을 다시 읽어 그 줄이 사라진다', async () => {
  const { api } = setup()
  let reads = 0
  api.on('GET', `${BASE}/r1`, () => {
    reads += 1
    if (reads === 1) return json({ request: twoPending() })
    return json({ request: twoPending({ items: [pendingItem(LINE_2, '테이프')] }) })
  })
  api.on('POST', `${BASE}/r1/decisions`, () => json({ error: 'LINE_ITEM_DECIDED' }, 409))
  await open()
  fill('포스터 금액', '1000')
  fill('포스터 예산 항목', BUDGET_A)
  fireEvent.click(btn('포스터 승인'))
  expect(await screen.findByText(/이미 결재된 품목이 있어요/)).toBeTruthy()
  await waitFor(() => expect(screen.queryByRole('group', { name: '결재 포스터' })).toBeNull())
  expect(screen.getByRole('group', { name: '결재 테이프' })).toBeTruthy()
})

test('항목이 맞지 않으면(409) 문구를 보이고 예산을 다시 읽는다', async () => {
  const { api } = setup()
  let budgetReads = 0
  api.on('GET', `${ORG}/budget`, () => {
    budgetReads += 1
    return json(budgetWithPeriod())
  })
  api.on('POST', `${BASE}/r1/decisions`, () => json({ error: 'BUDGET_ITEM_INVALID' }, 409))
  await open()
  fill('포스터 금액', '1000')
  fill('포스터 예산 항목', BUDGET_A)
  fireEvent.click(btn('포스터 승인'))
  expect(await screen.findByText(/예산 항목은 지금 쓸 수 없어요/)).toBeTruthy()
  await waitFor(() => expect(budgetReads).toBeGreaterThan(1))
  // 입력은 남아 다시 보낼 수 있다.
  expect(asElement(screen.getByLabelText('포스터 금액'), HTMLInputElement).value).toBe('1000')
})

test('결재하다 요청이 사라지면(404) 대화상자를 닫고 이유를 보인다', async () => {
  const { api } = setup()
  api.on('POST', `${BASE}/r1/decisions`, () => json({ error: 'NOT_FOUND' }, 404))
  await open()
  fill('포스터 금액', '1000')
  fill('포스터 예산 항목', BUDGET_A)
  fireEvent.click(btn('포스터 승인'))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect((await screen.findByRole('alert')).textContent).toMatch(/이 요청을 볼 수 없어요/)
})

test('결재하다 권한을 잃으면(403) 학생회를 다시 읽게 하고 대화상자를 닫는다', async () => {
  const { api, handlers } = setup()
  api.on('POST', `${BASE}/r1/decisions`, () => json({ error: 'FORBIDDEN' }, 403))
  await open()
  fill('포스터 금액', '1000')
  fill('포스터 예산 항목', BUDGET_A)
  fireEvent.click(btn('포스터 승인'))
  await waitFor(() => expect(handlers.onForbidden).toHaveBeenCalled())
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect((await screen.findByRole('alert')).textContent).toBe(PERMISSION_CHANGED)
})

test('회계 기간이 없으면 결재 대신 안내와 예산 탭으로 가는 버튼이 보인다', async () => {
  const { api } = setup(twoPending(), budgetWithoutPeriod())
  api.on('GET', `${ORG}/budget`, () => json(budgetWithoutPeriod()))
  fireEvent.click(await screen.findByRole('button', { name: '요청 r1' }))
  const dialog = await screen.findByRole('dialog')
  expect(await within(dialog).findByText('회계 기간을 먼저 만들어 주세요.')).toBeTruthy()
  expect(within(dialog).queryByLabelText('포스터 금액')).toBeNull()
  fireEvent.click(within(dialog).getByRole('button', { name: '예산 탭으로 가기' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(screen.getByRole('tab', { name: '예산' }).getAttribute('aria-selected')).toBe('true')
  expect(await screen.findByRole('button', { name: '회계 기간 만들기' })).toBeTruthy()
})

test('기간은 있는데 항목이 없으면 항목을 먼저 더하라고 안내한다', async () => {
  const empty = { ...budgetWithPeriod(), items: [] }
  setup(twoPending(), empty)
  fireEvent.click(await screen.findByRole('button', { name: '요청 r1' }))
  expect(await screen.findByText('지출 예산 항목을 먼저 더해 주세요.')).toBeTruthy()
})

test('예산을 못 읽으면 결재 칸에 다시 시도가 보인다', async () => {
  const { api } = setup()
  let reads = 0
  api.on('GET', `${ORG}/budget`, () => {
    reads += 1
    return reads === 1 ? json({ error: 'INTERNAL' }, 500) : json(budgetWithPeriod())
  })
  fireEvent.click(await screen.findByRole('button', { name: '요청 r1' }))
  fireEvent.click(await screen.findByRole('button', { name: '다시 시도' }))
  expect(await screen.findByLabelText('포스터 금액')).toBeTruthy()
})

test('결재 뒤 상태 배지가 바뀐다', async () => {
  const { api } = setup()
  let decided = false
  api.on('GET', `${BASE}/r1`, () =>
    json({
      request: decided ? twoPending({ status: 'approved', actions: [], items: [] }) : twoPending(),
    }),
  )
  api.on('POST', `${BASE}/r1/decisions`, () => {
    decided = true
    return json({ request: twoPending() })
  })
  await open()
  const dialog = screen.getByRole('dialog')
  expect(within(dialog).getByText('결재 대기')).toBeTruthy()
  fill('포스터 금액', '1000')
  fill('포스터 예산 항목', BUDGET_A)
  fireEvent.click(btn('포스터 승인'))
  expect(await within(dialog).findByText('승인')).toBeTruthy()
  expect(screen.queryByRole('group', { name: '결재 포스터' })).toBeNull()
})

// 남이 그사이 결재하거나 취소해 결재 칸이 사라져도 이유는 대화상자에 남는다.
test.each([
  ['LINE_ITEM_DECIDED', /이미 결재된 품목이 있어요/, { items: [], actions: [] }],
  ['REQUEST_CLOSED', /취소된 요청이라 결재할 수 없어요/, { status: 'cancelled', actions: [] }],
  ['EVENT_COMPLETED', /완료한 행사의 요청이라 바꿀 수 없어요/, { actions: [] }],
] satisfies [string, RegExp, Partial<PurchaseRequestDetail>][])(
  '%s로 결재 칸이 사라져도 문구가 남는다',
  async (code, message, after) => {
    const { api } = setup()
    let reads = 0
    api.on('GET', `${BASE}/r1`, () => {
      reads += 1
      return json({ request: reads === 1 ? twoPending() : twoPending(after) })
    })
    api.on('POST', `${BASE}/r1/decisions`, () => json({ error: code }, 409))
    await open()
    fill('포스터 금액', '1000')
    fill('포스터 예산 항목', BUDGET_A)
    fireEvent.click(btn('포스터 승인'))
    await waitFor(() => expect(screen.queryByRole('group', { name: '결재 포스터' })).toBeNull())
    expect(within(screen.getByRole('dialog')).getByText(message)).toBeTruthy()
  },
)

test('결재 중 기간이 없어졌으면(NO_FISCAL_PERIOD) 문구를 보이고 예산을 다시 읽는다', async () => {
  const { api } = setup()
  let budgetReads = 0
  api.on('GET', `${ORG}/budget`, () => {
    budgetReads += 1
    return json(budgetReads === 1 ? budgetWithPeriod() : budgetWithoutPeriod())
  })
  api.on('POST', `${BASE}/r1/decisions`, () => json({ error: 'NO_FISCAL_PERIOD' }, 409))
  await open()
  fill('포스터 금액', '1000')
  fill('포스터 예산 항목', BUDGET_A)
  fireEvent.click(btn('포스터 승인'))
  expect(await screen.findByText('회계 기간을 먼저 만들어 주세요.')).toBeTruthy()
  expect(budgetReads).toBeGreaterThan(1)
})
