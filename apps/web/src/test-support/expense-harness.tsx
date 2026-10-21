import { vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import type { Action } from '@vada/contracts'
import FinancePage from '@/finance/FinancePage'
import { councilView, FINANCE_PERMISSIONS } from './council-fixtures'
import { json, mockApi } from './mock-api'

// 지출 화면 시험이 같이 쓰는 준비. 재정 화면을 열고 지출 탭으로 간다.
export const BASE = '/api/organizations/c1'
export const EXPENSES = `${BASE}/expenses`
export const REQUESTS = `${BASE}/purchase-requests`

export function serveFinance() {
  const api = mockApi()
  api.on('GET', `${REQUESTS}?view=mine`, () => json({ requests: [], truncated: false }))
  return api
}

// 번호는 서버처럼 uuid여야 계약 검사를 지난다.
export const ME = '11111111-1111-4111-8111-111111111111'

export function showFinance(permissions: Action[] = FINANCE_PERMISSIONS) {
  const handlers = { onForbidden: vi.fn(), onChanged: vi.fn() }
  render(<FinancePage view={councilView('c1', { permissions, memberId: ME })} {...handlers} />)
  return handlers
}

export const openExpensesTab = () => fireEvent.click(screen.getByRole('tab', { name: '지출' }))
