// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { json, mockApi } from '../test-support/mock-api'
import Budget from './Budget'
import { budgetPeriod, budgetPlan } from './budget-fixtures'

const base = '/api/organizations/o/budget/periods'
beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-10T03:00:00Z')) })
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks() })
function setup(finance = true, periods = [budgetPeriod({ id: 'p2', name: '2027년 1학기', startsOn: '2027-03-01', endsOn: '2027-08-31' }), budgetPeriod()],
  plan = budgetPlan()) {
  const api = mockApi()
  api.on('GET', base, () => json({ periods }))
  api.on('GET', `${base}/p1`, () => json(plan))
  api.on('GET', `${base}/p2`, () => json(budgetPlan({ period: { id: 'p2', name: '2027년 1학기', startsOn: '2027-03-01', endsOn: '2027-08-31', version: 1 },
    incomes: [], events: [], operating: [] })))
  const onOpenEvent = vi.fn()
  render(<Budget organizationId="o" finance={finance} onOpenEvent={onOpenEvent} />)
  return { api, onOpenEvent }
}

test('기간이 없으면 빈 상태이고, 재정 권한자에게만 만들기 버튼이 있다', async () => {
  setup(true, [])
  expect(await screen.findByText('아직 회계 기간이 없어요')).toBeTruthy()
  expect(screen.getByRole('button', { name: '회계 기간 만들기' })).toBeTruthy()
  cleanup()
  setup(false, [])
  await screen.findByText('아직 회계 기간이 없어요')
  expect(screen.queryByRole('button', { name: '회계 기간 만들기' })).toBeNull()
})

test('오늘이 든 기간을 먼저 열고 숫자·수입 줄·행사·운영 카드를 보여 주며, 행사 이름을 누르면 그 행사를 연다', async () => {
  const { onOpenEvent } = setup()
  expect(await screen.findByRole('heading', { name: '2026년 2학기' })).toBeTruthy()
  const numbers = screen.getByRole('region', { name: '예산 요약' })
  for (const text of ['400,000원', '69,000원', '23,180원', '307,820원']) expect(within(numbers).getByText(text)).toBeTruthy()
  expect(screen.getByText('수입 예산 800,000원 · 배정 안 한 돈 400,000원')).toBeTruthy()
  const events = screen.getByRole('region', { name: '행사 예산' })
  expect(within(events).getByText('집행 19%')).toBeTruthy()
  fireEvent.click(within(events).getByRole('button', { name: '체육대회' }))
  expect(onOpenEvent).toHaveBeenCalledWith('e')
  expect(within(screen.getByRole('region', { name: '운영 예산' })).getByText('집행 12%')).toBeTruthy()
  fireEvent.change(screen.getByLabelText('회계 기간'), { target: { value: 'p2' } })
  expect(await screen.findByRole('heading', { name: '2027년 1학기' })).toBeTruthy()
  for (const text of ['수입 예산이 없어요', '넣은 행사가 없어요', '운영 예산이 없어요']) expect(screen.getByText(text)).toBeTruthy()
})

test('배정이 수입보다 많으면 경고하고, 재정 권한자에게만 알림을 보여 준다', async () => {
  const plan = budgetPlan({ totals: { ...budgetPlan().totals, income: 300000 }, notices: { eventsWithSpending: 2, operatingOutside: 1 },
    unassigned: { spent: 3000, count: 1 } })
  setup(true, [budgetPeriod()], plan)
  expect(await screen.findByText('배정이 수입보다 100,000원 많아요')).toBeTruthy()
  expect(screen.getByText('지출이 있는데 기간에 넣지 않은 행사 2개 — 편성 수정에서 행사를 넣어 주세요.')).toBeTruthy()
  expect(screen.getByText('어느 기간에도 들지 않는 상시 운영 지출 1건 — 결제일이 들도록 기간 날짜를 확인해 주세요.')).toBeTruthy()
  expect(screen.getByText('운영 항목을 고르지 않은 지출 1건 · 3,000원')).toBeTruthy()
  cleanup()
  setup(false, [budgetPeriod()], plan)
  await screen.findByText('배정이 수입보다 100,000원 많아요')
  expect(screen.queryByText(/편성 수정에서 행사를 넣어 주세요/)).toBeNull()
  expect(screen.queryByRole('button', { name: '편성 수정' })).toBeNull()
})

test('편성 수정을 저장하면 받은 편성으로 보기로 돌아가고 기간 목록을 새로 받는다', async () => {
  const { api } = setup(true, [budgetPeriod()])
  api.on('POST', `${base}/p1/plan`, () => json(budgetPlan({ incomes: [{ id: 'li', name: '학생회비', amount: 900000 }],
    totals: { ...budgetPlan().totals, income: 900000 } })))
  // 편성을 받기 전에는 [편성 수정]이 꺼져 있다.
  await screen.findByRole('heading', { name: '2026년 2학기' })
  fireEvent.click(screen.getByRole('button', { name: '편성 수정' }))
  const row = within(screen.getByRole('region', { name: '수입 예산' })).getByRole('listitem', { name: '수입 예산 1' })
  fireEvent.change(within(row).getByLabelText('금액(원)'), { target: { value: '900,000' } })
  fireEvent.click(screen.getByRole('button', { name: '저장' }))
  expect(await screen.findByText('수입 예산 900,000원 · 배정 안 한 돈 500,000원')).toBeTruthy()
  await waitFor(() => expect(api.calls.filter(call => call.method === 'GET' && call.path === base)).toHaveLength(2))
})

test('새 기간을 만들면 목록을 새로 받기 전에도 새 기간을 연다', async () => {
  const { api } = setup(true, [budgetPeriod()])
  const created = budgetPlan({ period: { id: 'p3', name: '2027년 1학기', startsOn: '2027-03-01', endsOn: '2027-08-31', version: 1 }, incomes: [], events: [],
    operating: [] })
  api.on('POST', base, () => json(created, 201))
  api.on('GET', `${base}/p3`, () => json(created))
  fireEvent.click(await screen.findByRole('button', { name: '새 기간' }))
  fireEvent.click(within(await screen.findByRole('dialog', { name: '회계 기간 만들기' })).getByRole('button', { name: '만들기' }))
  expect(await screen.findByRole('heading', { name: '2027년 1학기' })).toBeTruthy()
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
})
