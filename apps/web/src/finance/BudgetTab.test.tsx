// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import {
  councilView,
  FINANCE_PERMISSIONS,
  MEMBER_PERMISSIONS,
} from '@/test-support/council-fixtures'
import { budgetWithPeriod, budgetWithoutPeriod } from '@/test-support/budget-fixtures'
import { asElement } from '@/test-support/elements'
import { deferredResponse, json, mockApi } from '@/test-support/mock-api'
import FinancePage from './FinancePage'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const ORG = '/api/organizations/c1'
const BUDGET = `${ORG}/budget`

function show(permissions = FINANCE_PERMISSIONS, budget = budgetWithoutPeriod()) {
  const api = mockApi()
  api.on('GET', `${ORG}/purchase-requests?view=mine`, () =>
    json({ requests: [], truncated: false }),
  )
  api.on('GET', BUDGET, () => json(budget))
  const handlers = { onForbidden: vi.fn(), onChanged: vi.fn() }
  render(<FinancePage view={councilView('c1', { permissions })} {...handlers} />)
  fireEvent.click(screen.getByRole('tab', { name: '예산' }))
  return { api, handlers }
}
const fill = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } })
const button = (name: string) => asElement(screen.getByRole('button', { name }), HTMLButtonElement)

test('탭은 구매 요청, 지출, 예산이다', async () => {
  show()
  await screen.findByText(/아직 회계 기간이 없어요/)
  expect(screen.getAllByRole('tab').map(tab => tab.textContent)).toEqual([
    '구매 요청',
    '지출',
    '예산',
  ])
})

test('기간이 없으면 재정부에게 [회계 기간 만들기]가 있고 지금 기수의 이름과 날짜로 채워진다', async () => {
  const { api } = show()
  fireEvent.click(await screen.findByRole('button', { name: '회계 기간 만들기' }))
  const form = await screen.findByRole('form', { name: '회계 기간 만들기' })
  expect(asElement(within(form).getByLabelText('이름'), HTMLInputElement).value).toBe('2026년')
  expect(asElement(within(form).getByLabelText('시작일'), HTMLInputElement).value).toBe(
    '2026-01-01',
  )
  api.on('POST', `${ORG}/fiscal-periods`, () => json(budgetWithPeriod(), 201))
  api.on('GET', BUDGET, () => json(budgetWithPeriod()))
  fireEvent.click(button('만들기'))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(api.calls.find(call => call.method === 'POST')?.body).toEqual({
    name: '2026년',
    startsOn: '2026-01-01',
    endsOn: '2026-12-31',
  })
  expect(await screen.findByText('2026년 2학기')).toBeTruthy()
})

test('끝일이 시작일보다 앞서거나 이름이 비면 [만들기]가 꺼진다', async () => {
  show()
  fireEvent.click(await screen.findByRole('button', { name: '회계 기간 만들기' }))
  await screen.findByRole('form', { name: '회계 기간 만들기' })
  expect(button('만들기').disabled).toBe(false)
  fill('끝일', '2025-12-31')
  expect(button('만들기').disabled).toBe(true)
  fill('끝일', '2026-12-31')
  fill('이름', '   ')
  expect(button('만들기').disabled).toBe(true)
})

test('기간이 겹치면(409) 문구가 보이고 입력이 남는다', async () => {
  const { api } = show()
  api.on('POST', `${ORG}/fiscal-periods`, () => json({ error: 'FISCAL_PERIOD_CONFLICT' }, 409))
  fireEvent.click(await screen.findByRole('button', { name: '회계 기간 만들기' }))
  await screen.findByRole('form', { name: '회계 기간 만들기' })
  fireEvent.click(button('만들기'))
  expect((await screen.findByRole('alert')).textContent).toMatch(/겹치거나 같은 이름/)
  expect(asElement(screen.getByLabelText('이름'), HTMLInputElement).value).toBe('2026년')
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

test('기간이 있으면 이름, 기간, 지출 항목과 [항목 더하기]가 보인다', async () => {
  show(FINANCE_PERMISSIONS, budgetWithPeriod())
  expect(await screen.findByText('2026년 2학기')).toBeTruthy()
  expect(screen.getByText('2026-09-01 ~ 2027-02-28')).toBeTruthy()
  const list = screen.getByRole('list', { name: '지출 예산 항목' })
  expect(within(list).getByText('행사 홍보')).toBeTruthy()
  expect(within(list).getByText('300,000원')).toBeTruthy()
  expect(screen.getByRole('button', { name: '항목 더하기' })).toBeTruthy()
})

test('재정부가 아니면 보기만 하고 만들기와 더하기 버튼이 없다', async () => {
  show(MEMBER_PERMISSIONS, budgetWithPeriod())
  await screen.findByText('2026년 2학기')
  expect(screen.queryByRole('button', { name: '항목 더하기' })).toBeNull()
  cleanup()
  show(MEMBER_PERMISSIONS)
  await screen.findByText(/재정부가 만들면/)
  expect(screen.queryByRole('button', { name: '회계 기간 만들기' })).toBeNull()
})

test('항목 더하기는 목적과 금액을 계약대로 검사해 보낸다', async () => {
  const { api } = show(FINANCE_PERMISSIONS, budgetWithPeriod())
  api.on('POST', `${ORG}/budget-items`, () => json(budgetWithPeriod(), 201))
  fireEvent.click(await screen.findByRole('button', { name: '항목 더하기' }))
  await screen.findByRole('form', { name: '예산 항목 더하기' })
  expect(button('더하기').disabled).toBe(true)
  fill('목적', '간식')
  fill('금액(원)', '-5')
  expect(button('더하기').disabled).toBe(true)
  fill('금액(원)', '12,000')
  expect(button('더하기').disabled).toBe(false)
  fireEvent.click(button('더하기'))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(api.calls.find(call => call.method === 'POST')?.body).toEqual({
    purpose: '간식',
    amount: 12000,
  })
})

test('기간이 없을 때 항목을 더하면(409) 문구가 보인다', async () => {
  const { api } = show(FINANCE_PERMISSIONS, budgetWithPeriod())
  api.on('POST', `${ORG}/budget-items`, () => json({ error: 'NO_FISCAL_PERIOD' }, 409))
  fireEvent.click(await screen.findByRole('button', { name: '항목 더하기' }))
  await screen.findByRole('form', { name: '예산 항목 더하기' })
  fill('목적', '간식')
  fill('금액(원)', '1000')
  fireEvent.click(button('더하기'))
  expect((await screen.findByRole('alert')).textContent).toMatch(/지금 회계 기간이 없어요/)
})

test('저장하다 권한을 잃으면(403) 학생회를 다시 읽게 하고 대화상자를 닫는다', async () => {
  const { api, handlers } = show(FINANCE_PERMISSIONS, budgetWithPeriod())
  api.on('POST', `${ORG}/budget-items`, () => json({ error: 'FORBIDDEN' }, 403))
  fireEvent.click(await screen.findByRole('button', { name: '항목 더하기' }))
  await screen.findByRole('form', { name: '예산 항목 더하기' })
  fill('목적', '간식')
  fill('금액(원)', '1000')
  fireEvent.click(button('더하기'))
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
  fireEvent.click(screen.getByRole('tab', { name: '구매 요청' }))
  fireEvent.click(screen.getByRole('tab', { name: '예산' }))
  fireEvent.click(await screen.findByRole('button', { name: '다시 시도' }))
  expect(await screen.findByText('2026년 2학기')).toBeTruthy()
})

test('금액 칸은 숫자만 받는다(1e3, 0x10 거부)', async () => {
  show(FINANCE_PERMISSIONS, budgetWithPeriod())
  fireEvent.click(await screen.findByRole('button', { name: '항목 더하기' }))
  await screen.findByRole('form', { name: '예산 항목 더하기' })
  fill('목적', '간식')
  for (const bad of ['1e3', '0x10', '1.5', '12원'] as const) {
    fill('금액(원)', bad)
    expect(button('더하기').disabled).toBe(true)
  }
  fill('금액(원)', '0')
  expect(button('더하기').disabled).toBe(false)
})
