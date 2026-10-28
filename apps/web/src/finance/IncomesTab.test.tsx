// @vitest-environment jsdom
import { resetAddress } from '@/test-support/address-reset'
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, screen, within } from '@testing-library/react'
import { MEMBER_PERMISSIONS } from '@/test-support/council-fixtures'
import { BASE, showFinance } from '@/test-support/expense-harness'
import { budgetWithoutPeriod } from '@/test-support/budget-fixtures'
import {
  CURRENT_PERIOD,
  incomeSummary,
  OLD_PERIOD,
  periodSummary,
} from '@/test-support/income-fixtures'
import {
  CURRENT_INCOMES,
  INCOMES,
  openIncomesTab,
  PERIODS,
  serveIncomes,
} from '@/test-support/income-harness'
import { json } from '@/test-support/mock-api'

afterEach(async () => {
  cleanup()
  await resetAddress()
  vi.unstubAllGlobals()
})

const card = (name: string) => screen.getByRole('heading', { name }).closest('div')!.parentElement!

test('재정 탭 다섯은 줄을 바꿔 가로 스크롤 없이 다 보인다', () => {
  serveIncomes()
  showFinance()
  const tabs = screen.getAllByRole('tab').map(tab => tab.textContent)
  expect(tabs).toEqual(['예산 현황', '사용 내역', '행사 정산', '납부자 명단', '결산'])
  const list = screen.getByRole('tablist', { name: '재정 보기' })
  // 탭 부품은 부모에 overflow를 줄 수 없다(tab-button.tsx). 넘치면 줄을 바꾼다.
  expect(list.className).toContain('flex-wrap')
  expect(list.className).not.toMatch(/overflow/)
})

test('수입 탭은 지금 기간의 수입을 카드로 보이고 출처, 금액, 받은 날, 계좌, 취소됨을 적는다', async () => {
  const api = serveIncomes([
    incomeSummary('a', { description: '단과대학 지원금' }),
    incomeSummary('b', { source: 'participation_fee', description: '가을 MT 참가비' }),
    incomeSummary('c', { source: 'carryover', description: null, account: null }),
    incomeSummary('d', { source: 'fee', cancelled: true }),
  ])
  showFinance()
  openIncomesTab()
  await screen.findByRole('heading', { name: '지원금' })
  const grant = card('지원금')
  expect(grant.textContent).toContain('500,000원')
  expect(grant.textContent).toContain('10월 20일')
  expect(grant.textContent).toContain('단과대학 지원금')
  expect(grant.textContent).toContain('학생회비 통장')
  expect(card('참가비').textContent).toContain('가을 MT 참가비')
  expect(card('이월금').textContent).not.toContain('학생회비 통장')
  expect(within(card('학생회비')).getByText('취소됨')).toBeTruthy()
  expect(within(grant).queryByText('취소됨')).toBeNull()
  // 긴 내용이 칸을 밀어내지 않는다.
  expect(screen.getByText('단과대학 지원금').className).toContain('wrap-anywhere')
  // 기본은 지금 기간이다.
  expect(api.calls.some(call => call.path === CURRENT_INCOMES)).toBe(true)
  expect(screen.getByLabelText('회계 기간')).toHaveProperty('value', CURRENT_PERIOD)
})

test('기간을 바꾸면 그 기간의 수입을 읽는다', async () => {
  const api = serveIncomes()
  api.on('GET', `${INCOMES}?period=${OLD_PERIOD}`, () =>
    json({ incomes: [incomeSummary('old', { source: 'donation' })], truncated: false }),
  )
  showFinance()
  openIncomesTab()
  await screen.findByRole('heading', { name: '지원금' })
  fireEvent.change(screen.getByLabelText('회계 기간'), { target: { value: OLD_PERIOD } })
  await screen.findByRole('heading', { name: '후원금' })
  expect(screen.queryByRole('heading', { name: '지원금' })).toBeNull()
})

test('빈 목록, 읽기 실패와 다시 시도, 넘침', async () => {
  const api = serveIncomes()
  let call = 0
  api.on('GET', CURRENT_INCOMES, () => {
    call += 1
    if (call === 1) return json({}, 500)
    if (call === 2) return json({ incomes: [], truncated: false })
    return json({ incomes: [incomeSummary('a')], truncated: true })
  })
  showFinance()
  openIncomesTab()
  expect((await screen.findByRole('alert')).textContent).toContain('수입을 불러오지 못했어요')
  fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))
  await screen.findByText('수입 없음')
})

test('회계 기간이 없으면 만들라고 알리고, 기간 읽기 실패도 알린다', async () => {
  const api = serveIncomes()
  api.on('GET', PERIODS, () => json({ periods: [] }))
  showFinance()
  openIncomesTab()
  await screen.findByText('회계 기간 없음')
  cleanup()
  api.on('GET', PERIODS, () => json({}, 500))
  showFinance()
  openIncomesTab()
  expect((await screen.findByRole('alert')).textContent).toContain('회계 기간을 불러오지 못했어요')
})

test('지금 기간이 없으면 가장 최근 기간을 보인다', async () => {
  const api = serveIncomes()
  api.on('GET', PERIODS, () =>
    json({ periods: [periodSummary(OLD_PERIOD, { current: false, name: '지난 기간' })] }),
  )
  api.on('GET', `${INCOMES}?period=${OLD_PERIOD}`, () =>
    json({ incomes: [incomeSummary('x')], truncated: false }),
  )
  showFinance()
  openIncomesTab()
  await screen.findByRole('heading', { name: '지원금' })
})

test('[수입 적기]는 재정부에게만 보이고 운영진은 목록을 본다', async () => {
  serveIncomes()
  showFinance()
  openIncomesTab()
  expect(await screen.findByRole('button', { name: '수입 적기' })).toBeTruthy()
  cleanup()
  showFinance(MEMBER_PERMISSIONS)
  openIncomesTab()
  await screen.findByRole('heading', { name: '지원금' })
  expect(screen.queryByRole('button', { name: '수입 적기' })).toBeNull()
})

test('수입 탭을 열기 전에는 수입을 읽지 않는다', () => {
  const api = serveIncomes()
  showFinance()
  expect(api.calls.some(call => call.path.startsWith(INCOMES))).toBe(false)
  // 개요가 같은 회계 기간 목록을 쓴다.
  expect(api.calls.some(call => call.path === PERIODS)).toBe(true)
})

test.each([true, false])(
  '회계 기간이 없을 때 만들기 경로는 재정부에게만 보인다: %s',
  async canManage => {
    const api = serveIncomes()
    api.on('GET', PERIODS, () => json({ periods: [] }))
    api.on('GET', `${BASE}/budget`, () => json(budgetWithoutPeriod()))
    if (canManage) showFinance()
    else showFinance(MEMBER_PERMISSIONS)
    openIncomesTab()
    await screen.findByText('회계 기간 없음')
    const create = screen.queryByRole('button', { name: '예산 현황에서 만들기' })
    expect(create !== null).toBe(canManage)
    if (create) {
      fireEvent.click(create)
      expect(await screen.findByRole('button', { name: '회계 기간 만들기' })).toBeTruthy()
    }
  },
)
