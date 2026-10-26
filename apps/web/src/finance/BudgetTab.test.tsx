// @vitest-environment jsdom
import { resetAddress } from '@/test-support/address-reset'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import {
  councilView,
  FINANCE_PERMISSIONS,
  MEMBER_PERMISSIONS,
} from '@/test-support/council-fixtures'
import { budgetWithPeriod, budgetWithoutPeriod } from '@/test-support/budget-fixtures'
import { asElement } from '@/test-support/elements'
import { deferredResponse, json, mockApi } from '@/test-support/mock-api'
import { COUNCIL_ID, FinanceAt } from '@/test-support/finance-at'
import { periodSummary } from '@/test-support/income-fixtures'

// 회계 기간 만들기는 오늘이 든 학기로 채운다. 시험의 오늘은 2026-10-26(2학기)이다.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-26T03:00:00Z'))
})
afterEach(async () => {
  cleanup()
  await resetAddress()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

const ORG = `/api/organizations/${COUNCIL_ID}`
const BUDGET = `${ORG}/budget`

function show(
  permissions = FINANCE_PERMISSIONS,
  budget = budgetWithoutPeriod(),
  periods = budget.period ? [periodSummary(budget.period.id, budget.period)] : [],
) {
  const api = mockApi()
  api.on('GET', `${ORG}/purchase-requests?view=mine`, () =>
    json({ requests: [], truncated: false }),
  )
  api.on('GET', BUDGET, () => json(budget))
  api.on('GET', `${ORG}/fiscal-periods`, () => json({ periods }))
  const handlers = { onForbidden: vi.fn(), onChanged: vi.fn() }
  render(<FinanceAt view={councilView(COUNCIL_ID, { permissions })} {...handlers} />)
  fireEvent.click(screen.getByRole('tab', { name: '예산' }))
  return { api, handlers }
}
const fill = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } })
const button = (name: string) => asElement(screen.getByRole('button', { name }), HTMLButtonElement)

test('재정 탭에는 계좌가 없다', async () => {
  show()
  await screen.findByText('회계 기간 없음')
  expect(screen.getAllByRole('tab').map(tab => tab.textContent)).toEqual([
    '개요',
    '지출',
    '수입',
    '예산',
    '행사 정산',
    '납부자 명단',
    '결산',
  ])
})

test('오늘이 든 기간이 없어도 미리 만든 다음 기간을 골라 편성한다', async () => {
  const period = periodSummary('77777777-7777-4777-8777-777777777779', {
    name: '2027년 1학기',
    startsOn: '2027-01-01',
    endsOn: '2027-06-30',
    current: false,
  })
  const { api } = show(FINANCE_PERMISSIONS, budgetWithoutPeriod(), [period])
  api.on('GET', `${BUDGET}?period=${period.id}`, () => json({ period, items: [] }))
  await waitFor(() =>
    expect(
      asElement(screen.getByRole('combobox', { name: '회계 기간' }), HTMLSelectElement).value,
    ).toBe(period.id),
  )
  expect(screen.getByRole('button', { name: '예산 편성' })).toBeTruthy()
})

test('다음 기간을 만들면 그 기간을 골라 예산 편성하고 새로고침할 주소에도 남긴다', async () => {
  const { api } = show(FINANCE_PERMISSIONS, budgetWithPeriod())
  const id = '77777777-7777-4777-8777-777777777779'
  const period = periodSummary(id, {
    name: '2027년 1학기',
    startsOn: '2027-03-01',
    endsOn: '2027-08-31',
    current: false,
  })
  const next = { period, items: [] }
  api.on('GET', `${ORG}/fiscal-periods`, () => json({ periods: [period] }))
  api.on('POST', `${ORG}/fiscal-periods`, () => json(next, 201))
  api.on('GET', `${BUDGET}?period=${id}`, () => json(next))
  api.on('POST', `${ORG}/budget-items/batch?period=${id}`, () => json(next, 201))
  fireEvent.click(await screen.findByRole('button', { name: '회계 기간 만들기' }))
  await screen.findByRole('form', { name: '회계 기간 만들기' })
  fill('이름', period.name)
  fill('시작일', period.startsOn)
  fill('끝일', period.endsOn)
  fireEvent.click(button('만들기'))
  await waitFor(() => expect(window.location.search).toContain(`period=${id}`))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  await waitFor(() =>
    expect(
      asElement(screen.getByRole('combobox', { name: '회계 기간' }), HTMLSelectElement).value,
    ).toBe(id),
  )
  await openPlan('다음 학기 식비', '1000')
  fireEvent.click(button('예산 저장'))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(
    api.calls.some(
      call => call.method === 'POST' && call.path.endsWith(`/budget-items/batch?period=${id}`),
    ),
  ).toBe(true)
})

test('기간이 없으면 재정부에게 [회계 기간 만들기]가 있고 오늘이 든 학기의 이름과 날짜로 채워진다', async () => {
  const { api } = show()
  fireEvent.click(await screen.findByRole('button', { name: '회계 기간 만들기' }))
  const form = await screen.findByRole('form', { name: '회계 기간 만들기' })
  expect(asElement(within(form).getByLabelText('이름'), HTMLInputElement).value).toBe(
    '2026년 2학기',
  )
  expect(asElement(within(form).getByLabelText('시작일'), HTMLInputElement).value).toBe(
    '2026-07-01',
  )
  api.on('POST', `${ORG}/fiscal-periods`, () => json(budgetWithPeriod(), 201))
  api.on('GET', BUDGET, () => json(budgetWithPeriod()))
  fireEvent.click(button('만들기'))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(api.calls.find(call => call.method === 'POST')?.body).toEqual({
    name: '2026년 2학기',
    startsOn: '2026-07-01',
    endsOn: '2026-12-31',
  })
  expect(await screen.findByText('2026년 2학기')).toBeTruthy()
})

test('끝일이 시작일보다 앞서거나 이름이 비면 [만들기]를 눌러도 보내지 않고 그 칸 아래에 알린다', async () => {
  const { api } = show()
  fireEvent.click(await screen.findByRole('button', { name: '회계 기간 만들기' }))
  await screen.findByRole('form', { name: '회계 기간 만들기' })
  fill('끝일', '2025-12-31')
  fireEvent.click(button('만들기'))
  expect(screen.getByText('시작일보다 뒤의 날짜를 입력해 주세요')).toBeTruthy()
  expect(screen.getByLabelText('끝일').getAttribute('aria-invalid')).toBe('true')
  fill('끝일', '2026-12-31')
  expect(screen.queryByText('시작일보다 뒤의 날짜를 입력해 주세요')).toBeNull()
  fill('이름', '   ')
  fireEvent.click(button('만들기'))
  expect(screen.getByText('이름을 입력해 주세요')).toBeTruthy()
  await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText('이름')))
  expect(api.calls.some(call => call.method === 'POST')).toBe(false)
})

test('기간이 겹치면(409) 문구가 보이고 입력이 남는다', async () => {
  const { api } = show()
  api.on('POST', `${ORG}/fiscal-periods`, () => json({ error: 'FISCAL_PERIOD_CONFLICT' }, 409))
  fireEvent.click(await screen.findByRole('button', { name: '회계 기간 만들기' }))
  await screen.findByRole('form', { name: '회계 기간 만들기' })
  fireEvent.click(button('만들기'))
  expect((await screen.findByRole('alert')).textContent).toMatch(/겹치거나 같은 이름/)
  expect(asElement(screen.getByLabelText('이름'), HTMLInputElement).value).toBe('2026년 2학기')
})

test('보내는 동안 막히고 두 번 눌러도 한 번만 간다', async () => {
  const { api } = show()
  const slow = deferredResponse()
  api.on('POST', `${ORG}/fiscal-periods`, () => slow.promise)
  api.on('GET', BUDGET, () => json(budgetWithPeriod()))
  fireEvent.click(await screen.findByRole('button', { name: '회계 기간 만들기' }))
  const form = await screen.findByRole('form', { name: '회계 기간 만들기' })
  fireEvent.click(button('만들기'))
  await waitFor(() => expect(button('만들기').disabled).toBe(true))
  fireEvent.submit(form)
  slow.resolve(json(budgetWithPeriod(), 201))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(api.calls.filter(call => call.method === 'POST')).toHaveLength(1)
})

test('기간이 있으면 이름, 기간, 지출 항목과 [예산 편성]이 보인다', async () => {
  show(FINANCE_PERMISSIONS, budgetWithPeriod())
  expect(await screen.findByRole('option', { name: '2026년 2학기 (지금)' })).toBeTruthy()
  expect(screen.getByText('2026-09-01 ~ 2027-02-28')).toBeTruthy()
  const list = screen.getByRole('list', { name: '예산 항목' })
  expect(within(list).getByText('행사 홍보')).toBeTruthy()
  expect(within(list).getByText('배정 300,000원')).toBeTruthy()
  expect(screen.getByRole('button', { name: '예산 편성' })).toBeTruthy()
})

test('재정부가 아니면 보기만 하고 만들기와 편성 버튼이 없다', async () => {
  show(MEMBER_PERMISSIONS, budgetWithPeriod())
  await screen.findByRole('option', { name: '2026년 2학기 (지금)' })
  expect(screen.queryByRole('button', { name: '예산 편성' })).toBeNull()
  cleanup()
  show(MEMBER_PERMISSIONS)
  await screen.findByText('회계 기간 없음')
  expect(screen.queryByRole('button', { name: '회계 기간 만들기' })).toBeNull()
})

// 예산 편성 창을 열고 첫 행을 채운다(창은 지금 기간의 예산도 읽는다).
async function openPlan(purpose: string, amount: string) {
  fireEvent.click(await screen.findByRole('button', { name: '예산 편성' }))
  await screen.findByRole('form', { name: '예산 편성' })
  fill('항목 1 이름', purpose)
  fill('항목 1 금액', amount)
}

test('예산 편성은 이름과 금액이 비거나 금액이 숫자가 아니면 보내지 않고 그 행 아래에 알리며, 맞으면 보낸다', async () => {
  const { api } = show(FINANCE_PERMISSIONS, budgetWithPeriod())
  api.on('POST', `${ORG}/budget-items/batch`, () => json(budgetWithPeriod(), 201))
  fireEvent.click(await screen.findByRole('button', { name: '예산 편성' }))
  await screen.findByRole('form', { name: '예산 편성' })
  fireEvent.click(button('예산 저장'))
  expect(screen.getByText('항목 이름을 입력해 주세요')).toBeTruthy()
  fill('항목 1 이름', '간식')
  fill('항목 1 금액', '-5')
  fireEvent.click(button('예산 저장'))
  expect(screen.getByText('숫자만 입력해 주세요')).toBeTruthy()
  expect(screen.getByLabelText('항목 1 금액').getAttribute('aria-invalid')).toBe('true')
  expect(api.calls.some(call => call.method === 'POST')).toBe(false)
  fill('항목 1 금액', '12000')
  fireEvent.click(button('예산 저장'))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(api.calls.find(call => call.method === 'POST')?.body).toEqual({
    items: [{ purpose: '간식', amount: 12000, type: 'expense', eventId: null }],
  })
})

test('기간이 없을 때 편성하면(409) 문구와 아무것도 저장하지 않았다는 말이 보인다', async () => {
  const { api } = show(FINANCE_PERMISSIONS, budgetWithPeriod())
  api.on('POST', `${ORG}/budget-items/batch`, () => json({ error: 'NO_FISCAL_PERIOD' }, 409))
  await openPlan('간식', '1000')
  fireEvent.click(button('예산 저장'))
  const alert = await screen.findByRole('alert')
  expect(alert.textContent).toMatch(/지금 회계 기간이 없어요/)
  expect(alert.textContent).toMatch(/아무것도 저장하지 않았어요/)
})

test('저장하다 권한을 잃으면(403) 학생회를 다시 읽게 하고 대화상자를 닫는다', async () => {
  const { api, handlers } = show(FINANCE_PERMISSIONS, budgetWithPeriod())
  api.on('POST', `${ORG}/budget-items/batch`, () => json({ error: 'FORBIDDEN' }, 403))
  await openPlan('간식', '1000')
  fireEvent.click(button('예산 저장'))
  await waitFor(() => expect(handlers.onForbidden).toHaveBeenCalled())
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect((await screen.findByRole('alert')).textContent).toMatch(/권한이 바뀌었어요/)
})

test('예산을 못 읽으면 다시 시도를 보인다', async () => {
  const { api } = show()
  let reads = 0
  api.on('GET', BUDGET, () => {
    reads += 1
    return reads === 1 ? json({ error: 'INTERNAL' }, 500) : json(budgetWithPeriod())
  })
  fireEvent.click(screen.getByRole('tab', { name: '개요' }))
  fireEvent.click(screen.getByRole('tab', { name: '예산' }))
  fireEvent.click(await screen.findByRole('button', { name: '다시 시도' }))
  expect(await screen.findByText('2026년 2학기')).toBeTruthy()
})

test('금액 칸은 숫자만 받고(1e3, 0x10 거부) 0원은 막으며, 쉼표(12,000)는 받는다', async () => {
  const { api } = show(FINANCE_PERMISSIONS, budgetWithPeriod())
  api.on('POST', `${ORG}/budget-items/batch`, () => json(budgetWithPeriod(), 201))
  await openPlan('간식', '')
  for (const bad of ['1e3', '0x10', '1.5', '12원'] as const) {
    fill('항목 1 금액', bad)
    fireEvent.click(button('예산 저장'))
    expect(screen.getByText('숫자만 입력해 주세요')).toBeTruthy()
  }
  fill('항목 1 금액', '0')
  fireEvent.click(button('예산 저장'))
  expect(screen.getByText('0원보다 큰 금액을 입력해 주세요')).toBeTruthy()
  expect(api.calls.some(call => call.method === 'POST')).toBe(false)
  fill('항목 1 금액', '12,000')
  fireEvent.click(button('예산 저장'))
  await waitFor(() =>
    expect(api.calls.find(call => call.method === 'POST')?.body).toMatchObject({
      items: [{ amount: 12000 }],
    }),
  )
})

test('수입 항목에만 종류 칩이 보이고 행사가 있으면 행사 이름이 보인다', async () => {
  const budget = budgetWithPeriod()
  budget.items.push({
    id: '55555555-5555-4555-8555-555555555599',
    purpose: '참가비',
    amount: 100000,
    type: 'income',
    event: { id: 'e1', name: '봄 축제' },
    selectable: true,
    actual: 40000,
    committed: null,
    available: null,
    deletable: true,
    history: [],
  })
  show(FINANCE_PERMISSIONS, budget)
  const list = await screen.findByRole('list', { name: '예산 항목' })
  const income = within(list).getByText('참가비').closest('li') as HTMLElement
  expect(within(income).getByText('수입')).toBeTruthy()
  expect(within(income).getByText('봄 축제')).toBeTruthy()
  const spend = within(list).getByText('소모품').closest('li') as HTMLElement
  expect(within(spend).queryByText('지출')).toBeNull()
})

test('지출 항목은 배정·실제 지출·지출 예정을 흐린 한 줄로, 사용 가능을 크게 보이고 음수면 빨강이다', async () => {
  show(MEMBER_PERMISSIONS, budgetWithPeriod())
  const list = await screen.findByRole('list', { name: '예산 항목' })
  const line = (purpose: string) => within(list).getByText(purpose).closest('li') as HTMLElement
  const dim = within(line('행사 홍보')).getByText('배정 300,000원').closest('p') as HTMLElement
  expect(dim.textContent).toBe('배정 300,000원 · 실제 지출 120,000원 · 지출 예정 30,000원')
  expect(dim.className).toContain('text-xs')
  const available = within(line('행사 홍보')).getByText('사용 가능 150,000원')
  expect(available.className).toContain('text-base')
  expect(available.className).not.toContain('text-red')
  const over = within(line('소모품')).getByText('사용 가능 -10,000원')
  expect(over.className).toContain('text-red-600')
})

test('수입 항목은 예산과 들어온 돈만 있고 지출 예정과 사용 가능이 없다', async () => {
  const budget = budgetWithPeriod()
  budget.items = [
    {
      id: '55555555-5555-4555-8555-555555555599',
      purpose: '후원',
      amount: 100000,
      type: 'income',
      event: null,
      selectable: true,
      actual: 40000,
      committed: null,
      available: null,
      deletable: true,
      history: [],
    },
  ]
  show(MEMBER_PERMISSIONS, budget)
  const list = await screen.findByRole('list', { name: '예산 항목' })
  expect(within(list).getByText('예산 100,000원')).toBeTruthy()
  expect(within(list).getByText('들어온 돈 40,000원')).toBeTruthy()
  expect(within(list).queryByText(/지출 예정|사용 가능|배정/)).toBeNull()
})
