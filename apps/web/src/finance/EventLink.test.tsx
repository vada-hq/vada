// @vitest-environment jsdom
import { resetAddress } from '@/test-support/address-reset'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { BUDGET_A, budgetWithPeriod, LINE_1 } from '@/test-support/budget-fixtures'
import { councilView, FINANCE_PERMISSIONS } from '@/test-support/council-fixtures'
import { asElement } from '@/test-support/elements'
import { eventSummary } from '@/test-support/event-fixtures'
import { deferredResponse, json, mockApi } from '@/test-support/mock-api'
import { BUDGET_ERRORS, PURCHASE_ERRORS } from '@/lib/messages'
import { purchaseDetail, purchaseSummary } from '@/test-support/purchase-fixtures'
import { forgetRememberedItems } from './decision-form'
import { COUNCIL_ID, FinanceAt } from '@/test-support/finance-at'

beforeEach(forgetRememberedItems)
afterEach(async () => {
  cleanup()
  await resetAddress()
  vi.unstubAllGlobals()
})

const ORG = `/api/organizations/${COUNCIL_ID}`
const SPRING = '00000000-0000-4000-8000-0000000000e1'
const DONE = '00000000-0000-4000-8000-0000000000e2'

function setup(tab: string, budget = budgetWithPeriod()) {
  const api = mockApi()
  api.on('GET', `${ORG}/purchase-requests?view=mine`, () =>
    json({ requests: [purchaseSummary('0199d1a0-0000-7000-8000-00000000a001')], truncated: false }),
  )
  api.on('GET', `${ORG}/purchase-requests/0199d1a0-0000-7000-8000-00000000a001`, () =>
    json({
      request: purchaseDetail('0199d1a0-0000-7000-8000-00000000a001', {
        items: [
          {
            id: LINE_1,
            name: '포스터',
            quantity: 1,
            link: null,
            options: null,
            amount: null,
            budgetItem: null,
            status: 'pending',
            paid: false,
            payable: false,
            actions: [],
          },
        ],
        decisions: [],
        actions: ['purchase_request.decide'],
      }),
    }),
  )
  api.on('GET', `${ORG}/budget`, () => json(budget))
  api.on('GET', `${ORG}/events`, () =>
    json({
      events: [
        eventSummary({ id: SPRING, name: '봄 축제' }),
        eventSummary({ id: DONE, name: '끝난 축제', status: 'completed' }),
      ],
      truncated: false,
    }),
  )
  const handlers = { onForbidden: vi.fn(), onChanged: vi.fn() }
  render(
    <FinanceAt
      view={councilView(COUNCIL_ID, { permissions: FINANCE_PERMISSIONS })}
      {...handlers}
    />,
  )
  if (tab !== 'requests') fireEvent.click(screen.getByRole('tab', { name: tab }))
  return api
}

const eventSelect = async () => {
  const select = asElement(await screen.findByLabelText('행사'), HTMLSelectElement)
  await waitFor(() => expect(select.disabled).toBe(false))
  return select
}
const posted = (api: ReturnType<typeof mockApi>) =>
  api.calls.find(call => call.method === 'POST')?.body

test('요청 내기: 행사는 없음과 완료하지 않은 행사만 고르고, 고르면 eventId를 보낸다', async () => {
  const api = setup('requests')
  api.on('POST', `${ORG}/purchase-requests`, () => json({ request: purchaseDetail() }, 201))
  fireEvent.click(await screen.findByRole('button', { name: '구매 요청 내기' }))
  const select = await eventSelect()
  expect(
    within(select)
      .getAllByRole('option')
      .map(option => option.textContent),
  ).toEqual(['행사 없음', '봄 축제'])
  fireEvent.change(select, { target: { value: SPRING } })
  fireEvent.change(screen.getByLabelText('제목'), { target: { value: '포스터' } })
  fireEvent.change(screen.getByLabelText('품목 1 이름'), { target: { value: 'A2' } })
  fireEvent.click(screen.getByRole('button', { name: '내기' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(posted(api)).toMatchObject({ title: '포스터', eventId: SPRING })
})

test('예산 항목 더하기: 종류는 지출이 기본이고 수입과 행사를 골라 보낸다', async () => {
  const api = setup('예산')
  api.on('POST', `${ORG}/budget-items`, () => json(budgetWithPeriod(), 201))
  fireEvent.click(await screen.findByRole('button', { name: '항목 더하기' }))
  await screen.findByRole('form', { name: '예산 항목 더하기' })
  expect(asElement(screen.getByLabelText('종류'), HTMLSelectElement).value).toBe('expense')
  fireEvent.change(screen.getByLabelText('목적'), { target: { value: '참가비' } })
  fireEvent.change(screen.getByLabelText('금액(원)'), { target: { value: '100000' } })
  fireEvent.change(screen.getByLabelText('종류'), { target: { value: 'income' } })
  fireEvent.change(await eventSelect(), { target: { value: SPRING } })
  fireEvent.click(screen.getByRole('button', { name: '더하기' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(posted(api)).toEqual({
    purpose: '참가비',
    amount: 100000,
    type: 'income',
    eventId: SPRING,
  })
})

test('결재의 예산 항목 고르기에는 지출 항목만 보인다', async () => {
  const budget = budgetWithPeriod()
  budget.items.push({
    id: '55555555-5555-4555-8555-555555555599',
    purpose: '참가비 수입',
    amount: 1,
    type: 'income',
    event: null,
    selectable: true,
    actual: 0,
    committed: null,
    available: null,
  })
  setup('requests', budget)
  fireEvent.click(
    await screen.findByRole('button', { name: '요청 0199d1a0-0000-7000-8000-00000000a001' }),
  )
  const select = await screen.findByLabelText('포스터 예산 항목')
  const names = within(select)
    .getAllByRole('option')
    .map(option => option.textContent ?? '')
  expect(names.some(name => name.includes('행사 홍보'))).toBe(true)
  expect(names.some(name => name.includes('참가비 수입'))).toBe(false)
  expect(BUDGET_A).toBeTruthy()
})

test('요청 내기가 409면 그 창 안에 문구가 보이고, 보내는 동안 두 번 눌러도 한 번만 간다', async () => {
  const api = setup('requests')
  const slow = deferredResponse()
  api.on('POST', `${ORG}/purchase-requests`, () => slow.promise)
  fireEvent.click(await screen.findByRole('button', { name: '구매 요청 내기' }))
  fireEvent.change(await eventSelect(), { target: { value: SPRING } })
  fireEvent.change(screen.getByLabelText('제목'), { target: { value: '포스터' } })
  fireEvent.change(screen.getByLabelText('품목 1 이름'), { target: { value: 'A2' } })
  const submit = screen.getByRole('button', { name: '내기' })
  fireEvent.click(submit)
  fireEvent.click(submit)
  expect(api.calls.filter(call => call.method === 'POST')).toHaveLength(1)
  slow.resolve(json({ error: 'EVENT_COMPLETED' }, 409))
  expect(await screen.findByText(PURCHASE_ERRORS.EVENT_COMPLETED!)).toBeTruthy()
  expect(screen.getByRole('form', { name: '구매 요청 내기' })).toBeTruthy()
})

test('예산 항목 더하기가 409면 그 창 안에 문구가 보인다', async () => {
  const api = setup('예산')
  api.on('POST', `${ORG}/budget-items`, () => json({ error: 'EVENT_INVALID' }, 409))
  fireEvent.click(await screen.findByRole('button', { name: '항목 더하기' }))
  await screen.findByRole('form', { name: '예산 항목 더하기' })
  fireEvent.change(screen.getByLabelText('목적'), { target: { value: '간식' } })
  fireEvent.change(screen.getByLabelText('금액(원)'), { target: { value: '1000' } })
  fireEvent.click(screen.getByRole('button', { name: '더하기' }))
  expect(await screen.findByText(BUDGET_ERRORS.EVENT_INVALID!)).toBeTruthy()
})
