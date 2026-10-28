// @vitest-environment jsdom
import { resetAddress } from '@/test-support/address-reset'
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, screen, within } from '@testing-library/react'
import type { FinanceOverview } from '@vada/contracts'
import { MEMBER_PERMISSIONS } from '@/test-support/council-fixtures'
import { BASE, serveFinance, showFinance } from '@/test-support/expense-harness'
import { COUNCIL_ID } from '@/test-support/finance-at'
import { budgetWithPeriod, budgetWithoutPeriod } from '@/test-support/budget-fixtures'
import { CURRENT_PERIOD, OLD_PERIOD, standardPeriods } from '@/test-support/income-fixtures'
import { PERIODS } from '@/test-support/income-harness'
import { json } from '@/test-support/mock-api'
import { OVERVIEW_EVENT, OVERVIEW_EXPENSE, overviewFixture } from '@/test-support/overview-fixtures'

afterEach(async () => {
  cleanup()
  await resetAddress()
  vi.unstubAllGlobals()
})

const overviewPath = (period: string) => `${BASE}/finance-overview?period=${period}`

function serve(overview: FinanceOverview | null = overviewFixture(), periods = standardPeriods()) {
  const api = serveFinance()
  api.on('GET', `${BASE}/budget`, () =>
    json(periods.periods.length ? budgetWithPeriod() : budgetWithoutPeriod()),
  )
  api.on('GET', PERIODS, () => json(periods))
  api.on('GET', overviewPath(CURRENT_PERIOD), () => json({ overview }))
  return api
}
// 탭을 정하지 않은 재정 첫 화면(옆 메뉴 '재정')
const atFinanceHome = () => window.history.replaceState(null, '', `/finance/${COUNCIL_ID}`)
const region = (name: string) => screen.getByRole('region', { name })

test('재정부가 아닌 운영진도 재정을 열면 개요가 첫 탭이고, 카드 넷은 예산 셈의 숫자다', async () => {
  const api = serve()
  atFinanceHome()
  showFinance(MEMBER_PERMISSIONS)
  expect(screen.getAllByRole('tab')[0]?.textContent).toBe('예산 현황')
  expect(screen.getByRole('tab', { name: '예산 현황' }).getAttribute('aria-selected')).toBe('true')
  const total = await screen.findByRole('region', { name: '총예산' })
  expect(total.textContent).toContain('1,000,000원')
  expect(total.textContent).toContain('지원금 외 1건')
  expect(region('실제 지출').textContent).toContain('413,000원')
  expect(region('실제 지출').textContent).toContain('결제 완료 4건')
  expect(region('지출 예정').textContent).toContain('104,000원')
  expect(region('지출 예정').textContent).toContain('결제 예정 2건')
  expect(region('사용 가능').textContent).toContain('483,000원')
  expect(region('사용 가능').textContent).toContain('새로 쓸 수 있는 금액')
  // 결산서를 읽지 않는다(공개 전 결산서는 재정부만, DEC-70). 처리 버튼과 열람 안내 띠는 없다.
  expect(api.calls.some(call => call.path.includes('/closing'))).toBe(false)
  expect(document.body.textContent).not.toContain('열람용')
  expect(screen.queryByRole('button', { name: '편성' })).toBeNull()
  expect(screen.queryByRole('button', { name: '구매 요청 내기' })).toBeNull()
})

test('사용 가능이 음수면 빨갛다', async () => {
  serve(overviewFixture({ available: -20_000 }))
  atFinanceHome()
  showFinance()
  const value = within(await screen.findByRole('region', { name: '사용 가능' })).getByText(
    '-20,000원',
  )
  expect(value.className).toContain('text-red-600')
})

test('일반 부원도 예산 항목과 이력을 열람하고 고치기 동작은 보이지 않는다', async () => {
  serve()
  atFinanceHome()
  showFinance(MEMBER_PERMISSIONS)
  fireEvent.click(await screen.findByRole('button', { name: '항목 보기' }))
  const dialog = await screen.findByRole('dialog', { name: '예산 항목' })
  expect(await within(dialog).findByText('행사 홍보')).toBeTruthy()
  expect(within(dialog).queryByRole('button', { name: '예산 편성' })).toBeNull()
  fireEvent.keyDown(within(dialog).getByRole('button', { name: '행사 홍보 더 보기' }), {
    key: 'Enter',
  })
  expect(screen.queryByRole('menuitem', { name: '고치기' })).toBeNull()
  expect(screen.queryByRole('menuitem', { name: '항목 지우기' })).toBeNull()
  fireEvent.click(await screen.findByRole('menuitem', { name: '이력 보기' }))
  const history = await screen.findByRole('dialog', { name: '이력' })
  expect(history.textContent).toContain('김재정')
  expect(history.textContent).toContain('300,000원')
})

test('집행률 막대 둘(실제 지출, 지출 예정 포함)과 그 비율을 보인다', async () => {
  serve()
  atFinanceHome()
  showFinance()
  const rate = await screen.findByRole('region', { name: '전체 예산 집행률' })
  expect(rate.textContent).toContain('41.3%')
  expect(rate.textContent).toContain('지출 예정 포함 51.7%')
  expect(within(rate).getByRole('progressbar', { name: '실제 지출' })).toHaveProperty(
    'value',
    413_000,
  )
  expect(within(rate).getByRole('progressbar', { name: '지출 예정 포함' })).toHaveProperty(
    'value',
    517_000,
  )
})

test('총예산이 없으면 수 대신 없음을 보이고 막대가 없다', async () => {
  serve(overviewFixture({ total: 0, sources: [], available: -517_000 }))
  atFinanceHome()
  showFinance()
  expect((await screen.findByRole('region', { name: '총예산' })).textContent).toContain(
    '수입 예산 없음',
  )
  expect(screen.queryByRole('progressbar', { name: '실제 지출' })).toBeNull()
})

test('예정 포함 금액이 예산을 넘으면 전체와 행사 막대가 빨갛다', async () => {
  const overview = overviewFixture()
  serve({
    ...overview,
    total: 500_000,
    available: -17_000,
    events: overview.events.map(row => ({ ...row, amount: 200_000, available: -70_000 })),
  })
  atFinanceHome()
  showFinance()
  const rate = await screen.findByRole('region', { name: '전체 예산 집행률' })
  const bars = [
    ...within(rate).getAllByRole('progressbar'),
    ...within(region('행사별')).getAllByRole('progressbar'),
  ]
  for (const bar of bars) {
    expect(bar.className).toContain('[&::-webkit-progress-value]:bg-red-600')
    expect(bar.className).toContain('[&::-moz-progress-bar]:bg-red-600')
  }
})

test('행사별 표의 줄을 누르면 그 행사의 예산·정산이 열린다', async () => {
  serve()
  atFinanceHome()
  showFinance()
  const table = await screen.findByRole('region', { name: '행사별' })
  const row = within(table).getByText('체육대회').closest('li, tr')
  expect(row?.textContent).toContain('500,000원')
  expect(row?.textContent).toContain('230,000원')
  fireEvent.click(within(table).getByRole('button', { name: '체육대회' }))
  expect(window.location.pathname).toBe(`/events/${COUNCIL_ID}/${OVERVIEW_EVENT}`)
  expect(window.location.search).toBe('?tab=money')
})

test('최근 지출과 예산 항목별 현황(항목 없는 지출 포함)을 보이고, 지출을 누르면 그 지출이 열린다', async () => {
  serve()
  atFinanceHome()
  showFinance()
  const recent = await screen.findByRole('region', { name: '최근 지출' })
  expect(recent.textContent).toContain('10월 17일 (토)')
  expect(recent.textContent).toContain('현수막 제작')
  expect(recent.textContent).toContain('180,000원')
  // 행사가 없으면 사용처
  expect(recent.textContent).toContain('편의점')
  const items = region('예산 항목별 현황')
  expect(items.textContent).toContain('식비')
  expect(items.textContent).toContain('사용 가능 56,000원')
  expect(items.textContent).toContain('예산 항목 안 정한 지출')
  expect(items.textContent).toContain('3,000원')
  fireEvent.click(within(recent).getByRole('button', { name: '현수막 제작' }))
  expect(window.location.pathname).toBe(`/expenses/${COUNCIL_ID}/${OVERVIEW_EXPENSE}`)
})

test('카드의 내역은 같은 기간의 실제·예정 지출로, 편성은 예산 현황 안에서 열린다', async () => {
  serve()
  atFinanceHome()
  showFinance()
  await screen.findByRole('region', { name: '실제 지출' })
  fireEvent.click(within(region('실제 지출')).getByRole('button', { name: '내역' }))
  expect(window.location.search).toBe(`?tab=ledger&period=${CURRENT_PERIOD}`)
  window.history.back()
  await screen.findByRole('region', { name: '지출 예정' })
  fireEvent.click(within(region('지출 예정')).getByRole('button', { name: '내역' }))
  expect(window.location.search).toBe(`?tab=ledger&period=${CURRENT_PERIOD}&spending=committed`)
  window.history.back()
  await screen.findByRole('region', { name: '총예산' })
  fireEvent.click(within(region('총예산')).getByRole('button', { name: '편성' }))
  expect(await screen.findByRole('dialog', { name: '예산 편성' })).toBeTruthy()
  expect(window.location.pathname).toBe(`/finance/${COUNCIL_ID}`)
  expect(window.location.search).toBe('')
  expect(await screen.findByText('행사 홍보')).toBeTruthy()
})

test('기간을 바꾸면 그 기간의 개요를 읽는다', async () => {
  const api = serve()
  api.on('GET', overviewPath(OLD_PERIOD), () =>
    json({ overview: overviewFixture({ total: 7_000, sources: ['이월금'] }) }),
  )
  atFinanceHome()
  showFinance()
  await screen.findByRole('region', { name: '총예산' })
  fireEvent.change(screen.getByLabelText('회계 기간'), { target: { value: OLD_PERIOD } })
  expect(await screen.findByText('7,000원')).toBeTruthy()
  expect(window.location.search).toBe(`?period=${OLD_PERIOD}`)
})

test('기간이 없으면 예산 현황에서 바로 만들고, 재정 권한이 없는 사람에게는 버튼이 없다', async () => {
  serve(null, { periods: [] })
  atFinanceHome()
  showFinance(MEMBER_PERMISSIONS)
  await screen.findByText('회계 기간 없음')
  expect(screen.queryByRole('button', { name: '회계 기간 만들기' })).toBeNull()
  cleanup()
  serve(null, { periods: [] })
  atFinanceHome()
  showFinance()
  fireEvent.click(await screen.findByRole('button', { name: '회계 기간 만들기' }))
  expect(await screen.findByRole('form', { name: '회계 기간 만들기' })).toBeTruthy()
  expect(window.location.search).toBe('')
})

test('재정부가 아닌 운영진도 총예산 카드의 내역으로 예산 본문을 읽는다. 편성 버튼만 없다', async () => {
  serve()
  atFinanceHome()
  showFinance(MEMBER_PERMISSIONS)
  const total = await screen.findByRole('region', { name: '총예산' })
  expect(within(total).queryByRole('button', { name: '편성' })).toBeNull()
  fireEvent.click(within(total).getByRole('button', { name: '내역' }))
  const dialog = await screen.findByRole('dialog', { name: '예산 항목' })
  expect(await within(dialog).findByText('행사 홍보')).toBeTruthy()
  expect(within(dialog).queryByRole('button', { name: '예산 편성' })).toBeNull()
  expect(window.location.search).toBe('')
})
