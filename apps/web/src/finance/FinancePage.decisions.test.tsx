// @vitest-environment jsdom
import { resetAddress } from '@/test-support/address-reset'
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
import { PUSH_ARRIVED_EVENT } from '@/lib/service-worker'
import { forgetRememberedItems } from './decision-form'
import { COUNCIL_ID, PurchasesAt } from '@/test-support/finance-at'

beforeEach(forgetRememberedItems)
afterEach(async () => {
  cleanup()
  await resetAddress()
  vi.unstubAllGlobals()
})

const ORG = `/api/organizations/${COUNCIL_ID}`
const BASE = `${ORG}/purchase-requests`
const REQUEST = '0199d1a0-0000-7000-8000-00000000a001'
const LINE_3 = '0199d1a0-0000-7000-8000-00000000c003'

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
  payable: false,
  actions: [],
})
const twoPending = (extra: Partial<PurchaseRequestDetail> = {}) =>
  purchaseDetail(REQUEST, {
    items: [pendingItem(LINE_1, '포스터'), pendingItem(LINE_2, '테이프')],
    decisions: [],
    actions: ['purchase_request.decide'],
    ...extra,
  })

function setup(detail = twoPending(), budget: BudgetResponse = budgetWithPeriod()) {
  const api = mockApi()
  api.on('GET', `${BASE}?view=pending`, () =>
    json({ requests: [purchaseSummary(REQUEST)], truncated: false }),
  )
  api.on('GET', `${BASE}/${REQUEST}`, () => json({ request: detail }))
  api.on('GET', `${ORG}/budget`, () => json(budget))
  api.on('GET', `${ORG}/fiscal-periods`, () => json({ periods: [] }))
  const handlers = { onForbidden: vi.fn() }
  render(
    <PurchasesAt
      view={councilView(COUNCIL_ID, { permissions: FINANCE_PERMISSIONS })}
      {...handlers}
    />,
  )
  return { api, handlers }
}
const open = async () => {
  fireEvent.click(await screen.findByRole('button', { name: `요청 ${REQUEST}` }))
  return screen.findByRole('group', { name: '결재 포스터' })
}
const radio = (name: string) => asElement(screen.getByRole('radio', { name }), HTMLButtonElement)
const choose = (item: string, choice: '승인' | '반려') =>
  fireEvent.click(radio(`${item} ${choice}`))
const submitButton = () =>
  asElement(screen.getByRole('button', { name: /처리$/ }), HTMLButtonElement)
const submit = () => fireEvent.click(submitButton())
// 보내기 줄의 수 세기 '승인 N · 반려 N · 미검토 N'
const tallyLine = () => screen.getByText(/^승인 \d+ · 반려 \d+/).textContent
const fill = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } })
const posts = (api: ReturnType<typeof mockApi>) => api.calls.filter(c => c.method === 'POST')
// 두 품목을 같은 항목(사용 가능 150,000원)으로 승인을 고른다.
function approveBoth(poster = '1000', tape = '500') {
  fill('포스터 금액', poster)
  fill('포스터 예산 항목', BUDGET_A)
  choose('포스터', '승인')
  fill('테이프 금액', tape)
  fill('테이프 예산 항목', BUDGET_A)
  choose('테이프', '승인')
}
type Handler = Parameters<ReturnType<typeof mockApi>['on']>[2]
const answer = (
  api: ReturnType<typeof mockApi>,
  respond: Handler = () => json({ request: twoPending() }),
) => api.on('POST', `${BASE}/${REQUEST}/decisions`, respond)

test('purchase_request.decide가 없으면 결재 칸이 없고 예산도 읽지 않는다', async () => {
  const { api } = setup(twoPending({ actions: [] }))
  fireEvent.click(await screen.findByRole('button', { name: `요청 ${REQUEST}` }))
  await screen.findByText('포스터 × 2')
  expect(screen.queryByRole('region', { name: '결재' })).toBeNull()
  expect(api.calls.some(call => call.path === `${ORG}/budget`)).toBe(false)
})

test('처리 버튼은 늘 켜져 있고 안 고른 품목이 있으면 보내지 않고 수와 줄마다 이유를 보인다', async () => {
  const { api } = setup()
  await open()
  expect(tallyLine()).toBe('승인 0 · 반려 0 · 미검토 2')
  expect(screen.queryByRole('alert')).toBeNull()
  expect(submitButton().textContent).toBe('최종 처리')
  expect(submitButton().disabled).toBe(false)
  submit()
  expect(screen.getAllByText('승인이나 반려를 골라 주세요')).toHaveLength(2)
  // 수 세기의 미검토만 빨갛게 알리고 같은 수를 따로 말하지 않는다.
  expect(screen.getByRole('alert').textContent).toBe('미검토 2')
  expect(screen.queryByText(/미검토 품목이/)).toBeNull()
  await waitFor(() =>
    expect(document.activeElement).toBe(
      screen.getByRole('radiogroup', { name: '포스터 검토 결과' }),
    ),
  )
  choose('포스터', '승인')
  expect(tallyLine()).toBe('승인 1 · 반려 0 · 미검토 1')
  expect(screen.getByRole('alert').textContent).toBe('미검토 1')
  submit()
  expect(posts(api)).toHaveLength(0)
})

test('버튼 이름은 고른 조합을 따른다', async () => {
  setup()
  await open()
  choose('포스터', '승인')
  expect(submitButton().textContent).toBe('최종 처리')
  choose('테이프', '반려')
  expect(submitButton().textContent).toBe('부분 승인 처리')
  expect(radio('테이프 반려').getAttribute('aria-checked')).toBe('true')
  expect(radio('테이프 승인').getAttribute('aria-checked')).toBe('false')
  choose('테이프', '승인')
  expect(submitButton().textContent).toBe('승인 완료 처리')
  choose('포스터', '반려')
  choose('테이프', '반려')
  expect(submitButton().textContent).toBe('반려 처리')
})

test('승인을 고른 줄은 비운 칸 아래에 이유가 보이고 고치면 사라진다', async () => {
  const { api } = setup()
  const group = within(await open())
  choose('포스터', '승인')
  choose('테이프', '반려')
  fill('테이프 반려 사유', '있어요')
  submit()
  expect(group.getByText('금액을 입력해 주세요')).toBeTruthy()
  expect(group.getByText('예산 항목을 골라 주세요')).toBeTruthy()
  await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText('포스터 금액')))
  // 반려를 고른 줄에는 금액 문제가 없다.
  expect(
    within(screen.getByRole('group', { name: '결재 테이프' })).queryByText(/입력해 주세요/),
  ).toBeNull()
  fill('포스터 금액', '15000')
  expect(group.queryByText('금액을 입력해 주세요')).toBeNull()
  fill('포스터 예산 항목', BUDGET_A)
  expect(group.queryByText('예산 항목을 골라 주세요')).toBeNull()
  fill('포스터 금액', '0')
  expect(group.getByText('더 큰 값을 입력해 주세요')).toBeTruthy()
  submit()
  expect(posts(api)).toHaveLength(0)
})

test('반려를 고르면 사유 칸이 열리고 승인의 문제는 사라지며 사유가 비면 이유가 보인다', async () => {
  const { api } = setup()
  answer(api)
  await open()
  approveBoth()
  fill('테이프 금액', '')
  submit()
  const tape = within(screen.getByRole('group', { name: '결재 테이프' }))
  expect(tape.getByText('금액을 입력해 주세요')).toBeTruthy()
  expect(screen.queryByLabelText('테이프 반려 사유')).toBeNull()
  choose('테이프', '반려')
  expect(tape.queryByText('금액을 입력해 주세요')).toBeNull()
  expect(tape.getByText('반려 사유를 입력해 주세요')).toBeTruthy()
  // 반려에는 쓰이지 않는 금액·예산 항목 칸은 숨기고, 승인으로 돌아가면 쓴 값이 그대로다.
  expect(screen.queryByLabelText('테이프 금액')).toBeNull()
  expect(screen.queryByLabelText('테이프 예산 항목')).toBeNull()
  choose('테이프', '승인')
  expect(asElement(screen.getByLabelText('테이프 예산 항목'), HTMLSelectElement).value).toBe(
    BUDGET_A,
  )
  choose('테이프', '반려')
  fill('테이프 반려 사유', '   ')
  submit()
  expect(posts(api)).toHaveLength(0)
  fill('테이프 반려 사유', '이미 있어요')
  submit()
  await waitFor(() => expect(posts(api)).toHaveLength(1))
  expect(posts(api)[0]?.body).toEqual({
    decisions: [
      { lineItemId: LINE_1, outcome: 'approved', amount: 1000, budgetItemId: BUDGET_A },
      { lineItemId: LINE_2, outcome: 'rejected', reason: '이미 있어요' },
    ],
  })
})

test('고른 대로 한 번에 보내고 요청을 다시 읽는다', async () => {
  const { api } = setup()
  let reads = 0
  api.on('GET', `${BASE}/${REQUEST}`, () => {
    reads += 1
    return json({ request: reads === 1 ? twoPending() : twoPending({ status: 'approved' }) })
  })
  answer(api)
  await open()
  approveBoth('15,000', '500')
  submit()
  await waitFor(() => expect(reads).toBeGreaterThan(1))
  expect(posts(api)).toHaveLength(1)
  expect(posts(api)[0]?.body).toEqual({
    decisions: [
      { lineItemId: LINE_1, outcome: 'approved', amount: 15000, budgetItemId: BUDGET_A },
      { lineItemId: LINE_2, outcome: 'approved', amount: 500, budgetItemId: BUDGET_A },
    ],
  })
})

test('예산 항목 옆에 사용 가능이 있고 이번 승인으로 넘으면 승인한 뒤의 사용 가능이 보인다', async () => {
  setup()
  const poster = within(await open())
  const tape = within(screen.getByRole('group', { name: '결재 테이프' }))
  expect(poster.queryByText(/사용 가능/)).toBeNull()
  fill('포스터 예산 항목', BUDGET_A)
  expect(poster.getByText(/사용 가능/).textContent).toBe('사용 가능 150,000원')
  fill('포스터 금액', '100000')
  choose('포스터', '승인')
  fill('테이프 예산 항목', BUDGET_A)
  fill('테이프 금액', '80000')
  // 고르기 전에는 이번 승인에 들지 않는다.
  expect(tape.getByText(/사용 가능/).textContent).toBe('사용 가능 150,000원')
  choose('테이프', '승인')
  // 같은 항목에 두 줄을 승인하면 합이 넘는다.
  // 같은 항목에 두 줄을 승인하면 합이 넘고, 두 줄 모두 그 항목의 같은 값을 보인다(확인 창과 같은 말).
  expect(poster.getByText(/사용 가능/).textContent).toBe('사용 가능 150,000원 · 승인하면 -30,000원')
  expect(tape.getByText(/사용 가능/).textContent).toBe('사용 가능 150,000원 · 승인하면 -30,000원')
  // 이미 음수인 항목은 그 값 그대로 보인다.
  fill('테이프 예산 항목', BUDGET_B)
  expect(tape.getByText(/사용 가능/).textContent).toBe('사용 가능 -10,000원 · 승인하면 -90,000원')
  expect(poster.getByText(/사용 가능/).textContent).toBe('사용 가능 150,000원')
})

test('사용 가능을 넘으면 그래도 승인을 한 번 묻고, 닫으면 보내지 않는다', async () => {
  const { api } = setup()
  answer(api)
  await open()
  approveBoth('100000', '80000')
  submit()
  const confirm = await screen.findByRole('dialog', { name: '사용 가능 금액 초과' })
  expect(confirm.textContent).toContain('행사 홍보')
  expect(confirm.textContent).toContain('승인하면 사용 가능 -30,000원')
  fireEvent.click(
    within(confirm)
      .getAllByRole('button', { name: '닫기' })
      .find(button => button.textContent === '닫기')!,
  )
  await waitFor(() =>
    expect(screen.queryByRole('dialog', { name: '사용 가능 금액 초과' })).toBeNull(),
  )
  expect(posts(api)).toHaveLength(0)
  submit()
  fireEvent.click(
    within(await screen.findByRole('dialog', { name: '사용 가능 금액 초과' })).getByRole('button', {
      name: '그래도 승인',
    }),
  )
  await waitFor(() => expect(posts(api)).toHaveLength(1))
})

test('그래도 승인 창이 열린 사이 새 대기 품목이 생기면 보내지 않고 미검토를 알린다', async () => {
  const { api } = setup()
  answer(api)
  await open()
  approveBoth('100000', '80000')
  submit()
  const confirm = await screen.findByRole('dialog', { name: '사용 가능 금액 초과' })
  api.on('GET', `${BASE}/${REQUEST}`, () =>
    json({
      request: twoPending({
        items: [
          pendingItem(LINE_1, '포스터'),
          pendingItem(LINE_2, '테이프'),
          pendingItem(LINE_3, '풀'),
        ],
      }),
    }),
  )
  window.dispatchEvent(new Event(PUSH_ARRIVED_EVENT))
  // 확인 창이 열려 있어 뒤 화면은 보조 기술에 숨겨져 있다.
  await screen.findByRole('group', { name: '결재 풀', hidden: true })
  fireEvent.click(within(confirm).getByRole('button', { name: '그래도 승인' }))
  await waitFor(() =>
    expect(screen.queryByRole('dialog', { name: '사용 가능 금액 초과' })).toBeNull(),
  )
  expect(screen.getByRole('alert').textContent).toBe('미검토 1')
  expect(posts(api)).toHaveLength(0)
})

test('품목이 하나여도 고른 수를 보인다', async () => {
  setup(twoPending({ items: [pendingItem(LINE_1, '포스터')] }))
  await open()
  expect(tallyLine()).toBe('승인 0 · 반려 0 · 미검토 1')
})

test('결재 중이면 대기 품목은 결재 칸에만 있고 옵션과 링크가 그 머리에 있다', async () => {
  const withFacts = {
    ...pendingItem(LINE_1, '포스터'),
    options: 'A2 · 무광',
    link: 'https://shop.example/p',
  }
  setup(
    twoPending({
      items: [withFacts, { ...pendingItem(LINE_2, '테이프'), status: 'approved', amount: 3000 }],
    }),
  )
  const poster = within(await open())
  expect(screen.getAllByText('포스터 × 2')).toHaveLength(1)
  expect(poster.getByText('포스터 × 2')).toBeTruthy()
  expect(poster.getByText('A2 · 무광')).toBeTruthy()
  expect(poster.getByRole('link', { name: 'https://shop.example/p' })).toBeTruthy()
  // 대기가 아닌 품목은 위 품목 목록에 남는다.
  const list = within(screen.getByRole('region', { name: '품목' }))
  expect(list.getByText('테이프 × 2')).toBeTruthy()
  expect(list.queryByText('포스터 × 2')).toBeNull()
})

test('사용 가능 안이면 묻지 않고 보낸다', async () => {
  const { api } = setup()
  answer(api)
  await open()
  approveBoth('100000', '50000')
  submit()
  await waitFor(() => expect(posts(api)).toHaveLength(1))
  expect(screen.queryByRole('dialog', { name: '사용 가능 금액 초과' })).toBeNull()
})

test('마지막에 승인한 항목이 다음 요청의 기본이 되고, 목록에 없으면 비어 있다', async () => {
  const { api } = setup()
  answer(api)
  await open()
  const select = () => asElement(screen.getByLabelText('테이프 예산 항목'), HTMLSelectElement)
  expect(select().value).toBe('')
  approveBoth()
  submit()
  await waitFor(() => expect(posts(api)).toHaveLength(1))
  cleanup()
  // 새로고침처럼 주소를 처음으로 돌려 그 요청이 열린 채 시작하지 않게 한다.
  await resetAddress()
  render(
    <PurchasesAt
      view={councilView(COUNCIL_ID, { permissions: FINANCE_PERMISSIONS })}
      onForbidden={vi.fn()}
    />,
  )
  await open()
  expect(select().value).toBe(BUDGET_A)
  // 기간이 바뀌어 그 항목이 사라지면(같은 값으로 다시 와도 목록에 없으면) 기본은 비어 있다.
  cleanup()
  await resetAddress()
  const other = budgetWithPeriod()
  other.items = [{ ...other.items[1]!, id: BUDGET_B }]
  api.on('GET', `${ORG}/budget`, () => json(other))
  render(
    <PurchasesAt
      view={councilView(COUNCIL_ID, { permissions: FINANCE_PERMISSIONS })}
      onForbidden={vi.fn()}
    />,
  )
  await open()
  expect(select().value).toBe('')
  // 낡은 항목으로는 보낼 수 없다(금액만 써서는 누를 때 항목을 고르라고 한다).
  fill('포스터 금액', '1000')
  choose('포스터', '승인')
  choose('테이프', '반려')
  fill('테이프 반려 사유', '없어요')
  submit()
  expect(screen.getByText('예산 항목을 골라 주세요')).toBeTruthy()
  expect(posts(api)).toHaveLength(1)
})

test('보내는 동안 줄이 막히고 두 번 눌러도 한 번만 간다', async () => {
  const { api } = setup()
  const slow = deferredResponse()
  answer(api, () => slow.promise)
  await open()
  approveBoth()
  submit()
  submit()
  await waitFor(() => expect(submitButton().disabled).toBe(true))
  expect(radio('테이프 반려').disabled).toBe(true)
  slow.resolve(json({ request: twoPending() }))
  await waitFor(() => expect(radio('테이프 반려').disabled).toBe(false))
  expect(posts(api)).toHaveLength(1)
})

test('이미 결재됐으면(409) 문구를 보이고 요청을 다시 읽어 그 줄이 사라진다', async () => {
  const { api } = setup()
  let reads = 0
  api.on('GET', `${BASE}/${REQUEST}`, () => {
    reads += 1
    if (reads === 1) return json({ request: twoPending() })
    return json({ request: twoPending({ items: [pendingItem(LINE_2, '테이프')] }) })
  })
  answer(api, () => json({ error: 'LINE_ITEM_DECIDED' }, 409))
  await open()
  approveBoth()
  submit()
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
  answer(api, () => json({ error: 'BUDGET_ITEM_INVALID' }, 409))
  await open()
  approveBoth()
  submit()
  expect(await screen.findByText(/예산 항목은 지금 쓸 수 없어요/)).toBeTruthy()
  await waitFor(() => expect(budgetReads).toBeGreaterThan(1))
  // 입력은 남아 다시 보낼 수 있다.
  expect(asElement(screen.getByLabelText('포스터 금액'), HTMLInputElement).value).toBe('1000')
})

test('요청과 다른 행사의 항목이면(409 EVENT_MISMATCH) 결재 문구를 보이고 입력은 남는다', async () => {
  const { api } = setup()
  answer(api, () => json({ error: 'EVENT_MISMATCH' }, 409))
  await open()
  approveBoth()
  submit()
  expect(await screen.findByText(/요청과 다른 행사의 예산 항목이에요/)).toBeTruthy()
  expect(screen.queryByText(/연결을 확인하고/)).toBeNull()
  expect(asElement(screen.getByLabelText('포스터 금액'), HTMLInputElement).value).toBe('1000')
})

test('결재하다 요청이 사라지면(404) 상세를 거두고 페이지에 이유를 보인다', async () => {
  const { api } = setup()
  answer(api, () => json({ error: 'NOT_FOUND' }, 404))
  await open()
  approveBoth()
  submit()
  await waitFor(() => expect(screen.queryByRole('region', { name: '구매 요청 상세' })).toBeNull())
  expect((await screen.findByRole('alert')).textContent).toMatch(/이 요청을 볼 수 없어요/)
})

test('결재하다 권한을 잃으면(403) 학생회를 다시 읽게 하고 상세를 거둔다', async () => {
  const { api, handlers } = setup()
  answer(api, () => json({ error: 'FORBIDDEN' }, 403))
  await open()
  approveBoth()
  submit()
  await waitFor(() => expect(handlers.onForbidden).toHaveBeenCalled())
  await waitFor(() => expect(screen.queryByRole('region', { name: '구매 요청 상세' })).toBeNull())
  expect((await screen.findByRole('alert')).textContent).toBe(PERMISSION_CHANGED)
})

test('회계 기간이 없으면 결재 대신 안내와 예산 탭으로 가는 버튼이 보인다', async () => {
  const { api } = setup(twoPending(), budgetWithoutPeriod())
  api.on('GET', `${ORG}/budget`, () => json(budgetWithoutPeriod()))
  fireEvent.click(await screen.findByRole('button', { name: `요청 ${REQUEST}` }))
  const dialog = await screen.findByRole('region', { name: '구매 요청 상세' })
  expect(await within(dialog).findByText('회계 기간을 먼저 만들어 주세요.')).toBeTruthy()
  expect(within(dialog).queryByLabelText('포스터 금액')).toBeNull()
  fireEvent.click(within(dialog).getByRole('button', { name: '예산 현황으로 가기' }))
  await waitFor(() => expect(screen.queryByRole('region', { name: '구매 요청 상세' })).toBeNull())
  expect(screen.getByRole('tab', { name: '예산 현황' }).getAttribute('aria-selected')).toBe('true')
  expect(await screen.findByRole('button', { name: '회계 기간 만들기' })).toBeTruthy()
})

test('기간은 있는데 항목이 없으면 항목을 먼저 더하라고 안내한다', async () => {
  const empty = { ...budgetWithPeriod(), items: [] }
  setup(twoPending(), empty)
  fireEvent.click(await screen.findByRole('button', { name: `요청 ${REQUEST}` }))
  expect(await screen.findByText('지출 예산 항목을 먼저 더해 주세요.')).toBeTruthy()
})

test('예산을 못 읽으면 결재 칸에 다시 시도가 보인다', async () => {
  const { api } = setup()
  let reads = 0
  api.on('GET', `${ORG}/budget`, () => {
    reads += 1
    return reads === 1 ? json({ error: 'INTERNAL' }, 500) : json(budgetWithPeriod())
  })
  fireEvent.click(await screen.findByRole('button', { name: `요청 ${REQUEST}` }))
  fireEvent.click(await screen.findByRole('button', { name: '다시 시도' }))
  expect(await screen.findByLabelText('포스터 금액')).toBeTruthy()
})

test('결재 뒤 상태 배지가 바뀐다', async () => {
  const { api } = setup()
  let decided = false
  api.on('GET', `${BASE}/${REQUEST}`, () =>
    json({
      request: decided ? twoPending({ status: 'approved', actions: [], items: [] }) : twoPending(),
    }),
  )
  answer(api, () => {
    decided = true
    return json({ request: twoPending() })
  })
  await open()
  const dialog = screen.getByRole('region', { name: '구매 요청 상세' })
  expect(within(dialog).getByText('결재 대기')).toBeTruthy()
  approveBoth()
  submit()
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
    api.on('GET', `${BASE}/${REQUEST}`, () => {
      reads += 1
      return json({ request: reads === 1 ? twoPending() : twoPending(after) })
    })
    answer(api, () => json({ error: code }, 409))
    await open()
    approveBoth()
    submit()
    await waitFor(() => expect(screen.queryByRole('group', { name: '결재 포스터' })).toBeNull())
    expect(
      within(screen.getByRole('region', { name: '구매 요청 상세' })).getByText(message),
    ).toBeTruthy()
  },
)

test('결재 중 기간이 없어졌으면(NO_FISCAL_PERIOD) 문구를 보이고 예산을 다시 읽는다', async () => {
  const { api } = setup()
  let budgetReads = 0
  api.on('GET', `${ORG}/budget`, () => {
    budgetReads += 1
    return json(budgetReads === 1 ? budgetWithPeriod() : budgetWithoutPeriod())
  })
  answer(api, () => json({ error: 'NO_FISCAL_PERIOD' }, 409))
  await open()
  approveBoth()
  submit()
  expect(await screen.findByText('회계 기간을 먼저 만들어 주세요.')).toBeTruthy()
  expect(budgetReads).toBeGreaterThan(1)
})

const AUTUMN_ITEM = '55555555-5555-4555-8555-555555555555'
const SPRING_DONE_ITEM = '66666666-6666-4666-8666-666666666666'
const SPRING = { id: 'ev-spring', name: '봄 축제' }
const AUTUMN = { id: 'ev-autumn', name: '가을 축제' }
const budgetLine = (
  id: string,
  purpose: string,
  event: typeof SPRING | null,
  selectable = true,
) => ({
  id,
  purpose,
  amount: 100000,
  type: 'expense' as const,
  event,
  selectable,
  deletable: true,
  history: [],
  actual: 0,
  committed: 0,
  available: 100000,
})
const eventBudget = (): BudgetResponse => ({
  ...budgetWithPeriod(),
  items: [
    budgetLine(BUDGET_A, '상시 비품', null),
    budgetLine(BUDGET_B, '봄 항목', SPRING),
    budgetLine(AUTUMN_ITEM, '가을 항목', AUTUMN),
    budgetLine(SPRING_DONE_ITEM, '끝난 봄 항목', SPRING, false),
  ],
})
const optionsOf = (label: string) =>
  within(screen.getByLabelText(label))
    .getAllByRole('option')
    .map(option => option.textContent)

test('결재 창의 예산 항목은 요청 행사의 항목이 먼저, 그 아래 행사 없는 항목이고 고를 수 없는 항목은 없다', async () => {
  setup(twoPending({ event: SPRING }), eventBudget())
  await open()
  expect(optionsOf('포스터 예산 항목')).toEqual(['항목 고르기', '봄 항목', '상시 비품'])
})

test('행사가 없는 요청은 행사가 있는 항목도 고를 수 있지만 고를 수 없는 항목은 없다', async () => {
  setup(twoPending({ event: null }), eventBudget())
  await open()
  expect(optionsOf('포스터 예산 항목')).toEqual([
    '항목 고르기',
    '상시 비품',
    '봄 항목',
    '가을 항목',
  ])
})

test('기억한 항목이 이 요청의 행사와 맞지 않으면 비운다', async () => {
  const { api } = setup(twoPending({ event: null }), eventBudget())
  answer(api, () => json({ request: twoPending({ event: null }) }))
  await open()
  fill('포스터 금액', '1000')
  fill('포스터 예산 항목', AUTUMN_ITEM)
  choose('포스터', '승인')
  choose('테이프', '반려')
  fill('테이프 반려 사유', '없어요')
  submit()
  await waitFor(() => expect(posts(api)).toHaveLength(1))
  cleanup()
  // 새로고침처럼 주소를 처음으로 돌려 그 요청이 열린 채 시작하지 않게 한다.
  await resetAddress()
  api.on('GET', `${BASE}/${REQUEST}`, () => json({ request: twoPending({ event: null }) }))
  render(
    <PurchasesAt
      view={councilView(COUNCIL_ID, { permissions: FINANCE_PERMISSIONS })}
      onForbidden={vi.fn()}
    />,
  )
  await open()
  expect(asElement(screen.getByLabelText('테이프 예산 항목'), HTMLSelectElement).value).toBe(
    AUTUMN_ITEM,
  )
  cleanup()
  await resetAddress()
  api.on('GET', `${BASE}/${REQUEST}`, () => json({ request: twoPending({ event: SPRING }) }))
  render(
    <PurchasesAt
      view={councilView(COUNCIL_ID, { permissions: FINANCE_PERMISSIONS })}
      onForbidden={vi.fn()}
    />,
  )
  await open()
  expect(asElement(screen.getByLabelText('테이프 예산 항목'), HTMLSelectElement).value).toBe('')
})
