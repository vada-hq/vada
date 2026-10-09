// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import type { ExpenseSummary } from '@vada/contracts'
import { json, mockApi } from '../test-support/mock-api'
import { event } from '../test-support/workflow-fixtures'
import Expenses from './Expenses'
import { expense } from './expense-fixtures'
import { useExpenses } from './useExpenses'

afterEach(() => { cleanup(); vi.unstubAllGlobals() })
const base = '/api/organizations/o/expenses'
function Harness({ finance = true }: { finance?: boolean }) {
  const state = useExpenses('o', true)
  return <Expenses organizationId="o" finance={finance} viewerMembershipId="mf" events={[event()]} state={state} />
}
const totals = { thisMonth: 25000, total: 85000, missingEvidence: 1 }
function setup(expenses: ExpenseSummary[], finance = true) {
  const api = mockApi()
  api.on('GET', base, () => json({ expenses, truncated: false, totals }))
  render(<Harness finance={finance} />)
  return api
}

test('합계를 보여 주고, 지출을 결제한 달별로 묶어 증빙 상태와 취소를 표시한다', async () => {
  setup([
    expense({ id: 'x1', vendor: '쿠팡', amount: 25000, paidOn: '2026-10-09' }),
    expense({ id: 'x2', vendor: '인쇄소', description: '현수막', amount: 60000, paidOn: '2026-09-30', event: null, evidence: 'complete',
      receiptCount: 1, items: [], approvedTotal: null }),
    expense({ id: 'x3', vendor: '다이소', amount: 3000, paidOn: '2026-09-02',
      voided: { by: { id: 'f', name: '재정 테스터' }, at: '2026-09-03T00:00:00.000Z', reason: '중복' } }),
  ])
  const summary = await screen.findByRole('region', { name: '지출 요약' })
  expect(within(summary).getByText('25,000원')).toBeTruthy()
  expect(within(summary).getByText('85,000원')).toBeTruthy()
  expect(within(summary).getByText('1건')).toBeTruthy()
  const october = screen.getByRole('region', { name: '2026년 10월' })
  expect(within(october).getByRole('button', { name: '쿠팡' })).toBeTruthy()
  expect(within(october).getByText('10.9 · 학생회 카드 · 재정 테스터')).toBeTruthy()
  expect(within(october).getByText('증빙 누락')).toBeTruthy()
  const september = screen.getByRole('region', { name: '2026년 9월' })
  expect(within(september).getByText('상시 운영')).toBeTruthy()
  expect(within(september).getByText('증빙 완료')).toBeTruthy()
  expect(within(september).getByText('취소됨')).toBeTruthy()
  expect(within(september).queryByText('증빙 누락')).toBeNull()
})

test('지출이 없으면 안내하고, 재정 권한이 있을 때만 기록하라고 덧붙인다', async () => {
  setup([], false)
  expect(await screen.findByText('아직 기록된 지출이 없어요')).toBeTruthy()
  expect(screen.queryByText('결제한 뒤 지출을 기록해 주세요.')).toBeNull()
  cleanup()
  setup([], true)
  expect(await screen.findByText('결제한 뒤 지출을 기록해 주세요.')).toBeTruthy()
})

test('사용 내역을 불러오지 못하면 알리고 다시 시도한다', async () => {
  const api = mockApi()
  api.on('GET', base, () => json({ error: 'X' }, 500))
  render(<Harness />)
  expect(await screen.findByText('사용 내역을 불러오지 못했어요.')).toBeTruthy()
  api.on('GET', base, () => json({ expenses: [expense()], truncated: false, totals }))
  fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))
  expect(await screen.findByRole('button', { name: '쿠팡' })).toBeTruthy()
})

test('긴 사용처·내용은 카드 안에서 줄을 바꾼다', async () => {
  const vendor = '가'.repeat(120)
  const description = '나'.repeat(200)
  setup([expense({ vendor, description })])
  expect((await screen.findByRole('button', { name: vendor })).className).toContain('wrap-anywhere')
  expect(screen.getByText(description).className).toContain('wrap-anywhere')
})
