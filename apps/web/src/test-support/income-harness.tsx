import { fireEvent, screen } from '@testing-library/react'
import { BASE, serveFinance } from './expense-harness'
import { CURRENT_PERIOD, incomeSummary, standardPeriods } from './income-fixtures'
import { json } from './mock-api'

// 수입 화면 시험이 같이 쓰는 준비. 재정 화면에서 수입 탭으로 간다.
export const INCOMES = `${BASE}/incomes`
export const PERIODS = `${BASE}/fiscal-periods`
export const CURRENT_INCOMES = `${INCOMES}?period=${CURRENT_PERIOD}`

export function serveIncomes(incomes = [incomeSummary('i1')]) {
  const api = serveFinance()
  api.on('GET', PERIODS, () => json(standardPeriods()))
  api.on('GET', CURRENT_INCOMES, () => json({ incomes, truncated: false }))
  return api
}

export const openIncomesTab = () => {
  fireEvent.click(screen.getByRole('tab', { name: '사용 내역' }))
  fireEvent.click(screen.getByRole('button', { name: '수입' }))
}
