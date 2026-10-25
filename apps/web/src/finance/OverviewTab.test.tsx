// @vitest-environment jsdom
import { resetAddress } from '@/test-support/address-reset'
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, screen, within } from '@testing-library/react'
import { closingFixture } from '@/test-support/closing-fixtures'
import { MEMBER_PERMISSIONS } from '@/test-support/council-fixtures'
import { serveFinance, showFinance } from '@/test-support/expense-harness'
import { COUNCIL_ID } from '@/test-support/finance-at'
import { CURRENT_PERIOD, standardPeriods } from '@/test-support/income-fixtures'
import { PERIODS } from '@/test-support/income-harness'
import { json } from '@/test-support/mock-api'

afterEach(async () => {
  cleanup()
  await resetAddress()
  vi.unstubAllGlobals()
})

const CLOSING = `${PERIODS}/${CURRENT_PERIOD}/closing`

function serve(closing = closingFixture(), periods = standardPeriods()) {
  const api = serveFinance()
  api.on('GET', PERIODS, () => json(periods))
  api.on('GET', CLOSING, () => json({ closing }))
  return api
}
// 탭을 정하지 않은 재정 첫 화면(옆 메뉴 '재정')
const atFinanceHome = () => window.history.replaceState(null, '', `/finance/${COUNCIL_ID}`)

test('재정부가 재정을 열면 개요 탭이 먼저 열리고 총예산, 지출 예산, 실제 지출, 남은 예산을 보인다', async () => {
  serve()
  atFinanceHome()
  showFinance()
  const tabs = screen.getAllByRole('tab').map(tab => tab.textContent)
  expect(tabs[0]).toBe('개요')
  expect(screen.getByRole('tab', { name: '개요' }).getAttribute('aria-selected')).toBe('true')
  const total = await screen.findByRole('region', { name: '총예산' })
  // 총예산은 수입 예산 항목(재원)의 합
  expect(total.textContent).toContain('500,000원')
  expect(total.textContent).toContain('지원금 예산')
  expect(screen.getByRole('region', { name: '지출 예산' }).textContent).toContain('200,000원')
  // 실제 지출은 항목 없는 지출까지 이 기간 지출 전체
  const spent = screen.getByRole('region', { name: '실제 지출' })
  expect(spent.textContent).toContain('170,000원')
  expect(spent.textContent).toContain('지출 3건')
  const left = screen.getByRole('region', { name: '남은 예산' })
  expect(left.textContent).toContain('30,000원')
  expect(left.textContent).toContain('집행률 85%')
  expect(within(left).getByRole('progressbar', { name: '집행률' })).toBeTruthy()
  expect(screen.getByLabelText('회계 기간')).toHaveProperty('value', CURRENT_PERIOD)
})

test('예산 항목별 지출은 쓴 돈 / 예산, 남은 금액, 집행률과 항목 밖 지출을 보인다', async () => {
  serve()
  atFinanceHome()
  showFinance()
  await screen.findByText('예산 항목별 지출')
  const text = document.body.textContent ?? ''
  expect(text).toContain('150,000원 / 200,000원')
  expect(text).toContain('남은 금액 50,000원 · 75%')
  expect(text).toContain('예산 항목 없음')
  expect(text).not.toContain('다른 기간 항목')
})

test('예산이 없으면 수 대신 없음을 보인다', async () => {
  serve(
    closingFixture({
      income: { ...closingFixture().income, items: [] },
      expense: { items: [], noItem: 0, otherPeriod: 0, total: 0 },
      exportInfo: { ...closingFixture().exportInfo, expenseCount: 0 },
    }),
  )
  atFinanceHome()
  showFinance()
  expect((await screen.findByRole('region', { name: '총예산' })).textContent).toContain(
    '수입 예산 없음',
  )
  expect(screen.getByRole('region', { name: '남은 예산' }).textContent).toContain('지출 예산 없음')
  expect(screen.queryByRole('progressbar', { name: '집행률' })).toBeNull()
  expect(screen.getByText('지출 예산 항목 없음')).toBeTruthy()
})

test('회계 기간이 없으면 없음을 보이고 예산 탭으로 보낸다', async () => {
  serve(closingFixture(), { periods: [] })
  atFinanceHome()
  showFinance()
  await screen.findByText('회계 기간 없음')
  fireEvent.click(screen.getByRole('button', { name: '예산 탭에서 만들기' }))
  expect(window.location.search).toBe('?tab=budget')
})

test('재정부가 아니면 개요 탭이 없고 구매 요청 탭으로 열리며, 개요 주소도 구매 요청으로 바꿔 쓴다', async () => {
  const api = serve()
  window.history.replaceState(null, '', `/finance/${COUNCIL_ID}?tab=overview`)
  showFinance(MEMBER_PERMISSIONS)
  await screen.findByRole('tab', { name: '구매 요청', selected: true })
  expect(screen.queryByRole('tab', { name: '개요' })).toBeNull()
  expect(api.calls.some(call => call.path === CLOSING)).toBe(false)
})
