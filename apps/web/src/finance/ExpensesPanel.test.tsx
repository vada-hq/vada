// @vitest-environment jsdom
import { useState } from 'react'
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { expenseSummary } from '@/test-support/expense-fixtures'
import { ExpensesPanel } from './ExpensesPanel'
import type { ExpenseList } from './useExpenses'

const period = { id: 'p', name: '2026년 1학기', startsOn: '2026-01-01', endsOn: '2026-06-30' }
const list: ExpenseList = {
  state: {
    kind: 'ready',
    data: {
      expenses: [
        expenseSummary('a', {
          vendor: '문구점',
          paidOn: '2026-07-01',
          event: { id: 'e', name: '축제' },
        }),
        expenseSummary('b', { vendor: '인쇄소', evidenceCount: 0 }),
      ],
      allocations: [
        { expenseId: 'a', budgetItemId: 'b1', purpose: '운영비', periodId: 'p', amount: 36000 },
      ],
      periods: [period],
      truncated: true,
    },
  },
  reload: async () => {},
  replace: () => {},
}

function Sample() {
  const [periodId, setPeriod] = useState<string | null>('p')
  return <ExpensesPanel list={list} onOpen={() => {}} periodId={periodId} onPeriod={setPeriod} />
}

afterEach(() => {
  cleanup()
  delete (navigator as unknown as Record<string, unknown>).clipboard
})

test('기간 쿼리의 범위·합계와 필터·검색·0건을 보이고 받은 300개 제한을 알린다', () => {
  render(<Sample />)
  expect(screen.getByRole<HTMLSelectElement>('combobox', { name: '회계 기간' }).value).toBe('p')
  expect(screen.getByText('합계 36,000원')).toBeTruthy()
  expect(screen.getByText('1건')).toBeTruthy()
  expect(screen.queryByRole('heading', { name: '인쇄소' })).toBeNull()
  fireEvent.change(screen.getByLabelText('행사'), { target: { value: 'e' } })
  fireEvent.change(screen.getByLabelText('예산 항목'), { target: { value: 'b1' } })
  fireEvent.change(screen.getByLabelText('증빙'), { target: { value: 'present' } })
  fireEvent.change(screen.getByLabelText('사용처·내역 검색'), { target: { value: '없음' } })
  expect(screen.getByText('0건')).toBeTruthy()
  expect(screen.getByText('지출 없음')).toBeTruthy()
  expect(screen.getByText('지출이 많아서 300개만 보여요.')).toBeTruthy()
})

test('행 복사는 탭으로 나눈 세 칸을 쓰며 실패 뒤 다시 누를 수 있다', async () => {
  const writeText = vi.fn().mockRejectedValueOnce(new Error('denied')).mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
  render(<Sample />)
  const card = screen.getByRole('heading', { name: '문구점' }).closest('li')!
  fireEvent.click(within(card).getByRole('button', { name: '행 복사' }))
  await screen.findByText('복사하지 못했어요. 다시 눌러 주세요.')
  fireEvent.click(within(card).getByRole('button', { name: '행 복사' }))
  await screen.findByText('행 복사 완료')
  expect(writeText).toHaveBeenLastCalledWith('확인 필요\t축제\t포스터 인쇄')
})

test('모르는 기간의 주소는 전체 지출이나 0원으로 바꾸지 않는다', () => {
  render(<ExpensesPanel list={list} onOpen={() => {}} periodId="missing" />)
  expect(screen.queryByRole('heading', { name: '문구점' })).toBeNull()
  expect(screen.getByRole('alert').textContent).toBe('회계 기간을 찾을 수 없어요.')
  expect(screen.queryByText('합계 0원')).toBeNull()
})
