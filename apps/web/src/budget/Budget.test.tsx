// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { json, mockApi } from '../test-support/mock-api'
import Budget from './Budget'
import { budgetEventLine, budgetPeriod, budgetPlan, incomeDetail, incomeSummary } from './budget-fixtures'

const base = '/api/organizations/o/budget/periods'
beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-10T03:00:00Z')) })
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks() })
function setup(finance = true, periods = [budgetPeriod({ id: 'p2', name: '2027년 1학기', startsOn: '2027-03-01', endsOn: '2027-08-31' }), budgetPeriod()],
  plan = budgetPlan()) {
  const api = mockApi()
  api.on('GET', base, () => json({ periods }))
  api.on('GET', `${base}/p1`, () => json(plan))
  api.on('GET', `${base}/p2`, () => json(budgetPlan({ period: { id: 'p2', name: '2027년 1학기', startsOn: '2027-03-01', endsOn: '2027-08-31', version: 1, closed: null },
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
  api.on('POST', `${base}/p1/plan`, () => json(budgetPlan({ incomes: [{ id: 'li', name: '학생회비', amount: 900000, received: 0, incomeCount: 0 }],
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
  const created = budgetPlan({ period: { id: 'p3', name: '2027년 1학기', startsOn: '2027-03-01', endsOn: '2027-08-31', version: 1, closed: null }, incomes: [], events: [],
    operating: [] })
  api.on('POST', base, () => json(created, 201))
  api.on('GET', `${base}/p3`, () => json(created))
  fireEvent.click(await screen.findByRole('button', { name: '새 기간' }))
  fireEvent.click(within(await screen.findByRole('dialog', { name: '회계 기간 만들기' })).getByRole('button', { name: '만들기' }))
  expect(await screen.findByRole('heading', { name: '2027년 1학기' })).toBeTruthy()
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
})

test('행사 재정 탭에서 바뀐 행사 때문에 저장이 막히면, 문구를 남기고 그 줄만 새 값으로 바꿔 다시 저장할 수 있다', async () => {
  const { api } = setup(true, [budgetPeriod()])
  const bodies: unknown[] = []
  api.on('POST', `${base}/p1/plan`, call => {
    bodies.push(call.body)
    return bodies.length === 1 ? json({ error: 'VERSION_CONFLICT' }, 409)
      : json(budgetPlan({ events: [budgetEventLine({ budget: 400000, version: 2 })] }))
  })
  await screen.findByRole('heading', { name: '2026년 2학기' })
  fireEvent.click(screen.getByRole('button', { name: '편성 수정' }))
  const incomes = screen.getByRole('region', { name: '수입 예산' })
  fireEvent.change(within(within(incomes).getByRole('listitem', { name: '수입 예산 1' })).getByLabelText('금액(원)'), { target: { value: '900,000' } })
  const amountOf = () => within(screen.getByRole('listitem', { name: '체육대회' })).getByLabelText('예산(원)') as HTMLInputElement
  fireEvent.change(amountOf(), { target: { value: '350,000' } })
  // 그사이 행사 재정 탭에서 체육대회 예산이 400,000원(버전 2)으로 바뀌었다.
  api.on('GET', `${base}/p1`, () => json(budgetPlan({ events: [budgetEventLine({ budget: 400000, version: 2 })] })))
  fireEvent.click(screen.getByRole('button', { name: '저장' }))
  expect(await screen.findByText('다른 곳에서 먼저 바뀌었어요. 새로 불러왔어요.')).toBeTruthy()
  await waitFor(() => expect(amountOf().value).toBe('400,000'))
  expect((within(within(screen.getByRole('region', { name: '수입 예산' })).getByRole('listitem', { name: '수입 예산 1' }))
    .getByLabelText('금액(원)') as HTMLInputElement).value).toBe('900,000')
  fireEvent.click(screen.getByRole('button', { name: '저장' }))
  await waitFor(() => expect(bodies).toHaveLength(2))
  expect((bodies[1] as { events: unknown[] }).events).toEqual([{ eventId: 'e', version: 2 }])
  expect(await screen.findByRole('heading', { name: '2026년 2학기' })).toBeTruthy()
})

const incomesPath = `${base}/p1/incomes`
test('수입 줄의 예산·실제 수입, 항목 없는 수입, 실제 수입·남은 돈, 수입 내역을 보여 주고, 수입을 누르면 상세가 열린다', async () => {
  const plan = budgetPlan({ incomes: [{ id: 'li', name: '학생회비', amount: 800000, received: 750000, incomeCount: 1 }],
    unassignedIncome: { received: 30000, count: 1 }, totals: { ...budgetPlan().totals, received: 780000, balance: 711000 },
    incomeRecords: [incomeSummary(), incomeSummary({ id: 'i2', budgetLine: null, description: '후원금', amount: 30000, receivedOn: '2026-10-02',
      voided: { by: { id: 'f', name: '재정' }, at: '2026-10-03T00:00:00.000Z', reason: '중복' } })] })
  const { api } = setup(true, [budgetPeriod()], plan)
  api.on('GET', `${incomesPath}/i1`, () => json({ income: incomeDetail() }))
  const incomes = await screen.findByRole('region', { name: '수입' })
  for (const text of ['예산의 94%', '800,000원', '750,000원', '수입 항목을 고르지 않은 수입 1건 · 30,000원']) expect(within(incomes).getByText(text)).toBeTruthy()
  expect(screen.getByText('실제 수입 780,000원 · 남은 돈 711,000원')).toBeTruthy()
  const records = screen.getByRole('region', { name: '수입 내역' })
  expect(within(records).getByText('취소됨')).toBeTruthy()
  fireEvent.click(within(records).getByRole('button', { name: '2학기 학생회비' }))
  expect(await screen.findByRole('dialog', { name: '2학기 학생회비 · 750,000원' })).toBeTruthy()
})

test('남은 돈이 0보다 작으면 경고하고 재정 권한자에게만 확인 문구를 덧붙이며, 권한이 없으면 수입 기록 버튼이 없다', async () => {
  setup(true, [budgetPeriod()])
  expect(await screen.findByText('실제 지출이 실제 수입보다 69,000원 많아요')).toBeTruthy()
  expect(screen.getByText('빠진 수입 기록이 없는지 확인해 주세요.')).toBeTruthy()
  expect(within(screen.getByRole('region', { name: '수입 내역' })).getByText('기록한 수입이 없어요')).toBeTruthy()
  cleanup()
  setup(false, [budgetPeriod()])
  expect(await screen.findByText('실제 지출이 실제 수입보다 69,000원 많아요')).toBeTruthy()
  expect(screen.queryByText('빠진 수입 기록이 없는지 확인해 주세요.')).toBeNull()
  expect(screen.queryByRole('button', { name: '수입 기록' })).toBeNull()
  expect(screen.getByRole('button', { name: '결산서 내려받기' })).toBeTruthy()
})

test('수입을 기록하면 편성을 다시 받고 기록한 수입의 상세를 연다', async () => {
  const { api } = setup(true, [budgetPeriod()])
  const bodies: unknown[] = []
  api.on('POST', incomesPath, call => { bodies.push(call.body); return json({ income: incomeDetail() }, 201) })
  api.on('GET', `${incomesPath}/i1`, () => json({ income: incomeDetail() }))
  fireEvent.click(await screen.findByRole('button', { name: '수입 기록' }))
  const dialog = screen.getByRole('dialog', { name: '수입 기록' })
  fireEvent.change(within(dialog).getByLabelText('수입 항목'), { target: { value: 'li' } })
  fireEvent.change(within(dialog).getByLabelText('내용'), { target: { value: '2학기 학생회비' } })
  fireEvent.change(within(dialog).getByLabelText('금액(원)'), { target: { value: '750000' } })
  fireEvent.click(within(dialog).getByRole('button', { name: '기록' }))
  expect(await screen.findByRole('dialog', { name: '2학기 학생회비 · 750,000원' })).toBeTruthy()
  expect(bodies).toEqual([{ description: '2학기 학생회비', amount: 750000, receivedOn: '2026-10-10', budgetLineId: 'li', note: null }])
  await waitFor(() => expect(api.calls.filter(call => call.method === 'GET' && call.path === `${base}/p1`)).toHaveLength(2))
})

test('결산서를 내려받으면 서버가 준 이름으로 받고, 실패하면 알린다', async () => {
  const { api } = setup(false, [budgetPeriod()])
  const name = '2026년 2학기 결산 2026-10-10.xlsx'
  // jsdom의 Blob은 Node Response 본문으로 읽히지 않아 문자열로 준다.
  api.on('GET', `${base}/p1/export`, () => new Response('xlsx', { headers: {
    'Content-Disposition': `attachment; filename="settlement.xlsx"; filename*=UTF-8''${encodeURIComponent(name)}` } }))
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, writable: true, value: vi.fn(() => 'blob:report') })
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, writable: true, value: vi.fn() })
  const clicks: string[] = []
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) { clicks.push(this.download) })
  fireEvent.click(await screen.findByRole('button', { name: '결산서 내려받기' }))
  await waitFor(() => expect(clicks).toEqual([name]))
  api.on('GET', `${base}/p1/export`, () => json({ error: 'EXPORT_TOO_LARGE' }, 409))
  fireEvent.click(screen.getByRole('button', { name: '결산서 내려받기' }))
  expect(await screen.findByText('기록이 너무 많아 엑셀로 만들 수 없어요.')).toBeTruthy()
})
