// @vitest-environment jsdom
import { act, useState } from 'react'
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { expenseSummary } from '@/test-support/expense-fixtures'
import { navigationWidth } from '@/test-support/navigation-width'
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
          amount: 50000,
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
  vi.unstubAllGlobals()
  delete (navigator as unknown as Record<string, unknown>).clipboard
})

test('기간 쿼리의 범위·합계와 필터·검색·0건을 보이고 받은 300개 제한을 알린다', () => {
  render(<Sample />)
  fireEvent.click(screen.getByRole('button', { name: /^필터/ }))
  expect(screen.getByRole<HTMLSelectElement>('combobox', { name: '회계 기간' }).value).toBe('p')
  expect(screen.getByText('36,000원', { selector: 'dd' })).toBeTruthy()
  expect(screen.getByText('1건')).toBeTruthy()
  expect(screen.queryByRole('heading', { name: '인쇄소' })).toBeNull()
  fireEvent.change(screen.getByLabelText('행사'), { target: { value: 'e' } })
  fireEvent.change(screen.getByLabelText('예산 항목'), { target: { value: 'b1' } })
  fireEvent.change(screen.getByLabelText('증빙'), { target: { value: 'present' } })
  fireEvent.change(screen.getByLabelText('사용처·내역 검색'), { target: { value: '없음' } })
  expect(screen.getAllByText('0건')).toHaveLength(2)
  expect(screen.getByText('지출 없음')).toBeTruthy()
  expect(screen.getByText('지출이 많아서 300개만 보여요.')).toBeTruthy()
})

const summaryCell = (label: string) => screen.getByText(label, { selector: 'dt' }).parentElement!
const summaryList: ExpenseList = {
  ...list,
  state: {
    kind: 'ready',
    data: {
      expenses: [
        expenseSummary('a', {
          amount: 100,
          event: { id: 'e', name: '축제' },
          departments: [
            { id: 'd1', name: '기획부' },
            { id: 'd2', name: '재정부' },
          ],
        }),
        expenseSummary('b', { amount: 200, evidenceCount: 0 }),
        expenseSummary('c', { amount: 900, evidenceCount: 0, cancelled: true }),
      ],
      truncated: true,
    },
  },
}

test('취소를 합계와 증빙 없음 수에서 빼고 건수에는 넣으며 행사 거르기로 세 수를 바꾼다', () => {
  render(<ExpensesPanel list={summaryList} onOpen={() => {}} />)
  expect(summaryCell('지출 합계').textContent).toBe('지출 합계300원')
  expect(summaryCell('건수').textContent).toBe('건수3건')
  expect(summaryCell('증빙 없음').textContent).toBe('증빙 없음1건')
  expect(within(summaryCell('증빙 없음')).getByText('1건').className).toContain('text-amber-700')
  fireEvent.change(screen.getByLabelText('행사'), { target: { value: 'e' } })
  expect(summaryCell('지출 합계').textContent).toBe('지출 합계100원')
  expect(summaryCell('건수').textContent).toBe('건수1건')
  const zero = within(summaryCell('증빙 없음')).getByText('0건')
  expect(zero.className).toContain('text-gray-500')
  expect(summaryCell('건수').closest('[role="status"]')).toBeTruthy()
})

test.each([1280, 1024])(
  '%ipx는 표 열과 상시·배분 항목·선택 범위·기존 상태 칩을 보이고 내역으로 연다',
  width => {
    navigationWidth(width)
    const onOpen = vi.fn()
    render(<ExpensesPanel list={summaryList} onOpen={onOpen} />)
    const table = screen.getByRole('table', { name: '지출 목록' })
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map(cell => cell.textContent),
    ).toEqual(['결제일', '내역', '행사', '부서', '예산 항목', '금액', '증빙', '행 복사'])
    const first = within(table).getByRole('button', { name: '사용처 a' }).closest('tr')!
    expect(within(first).getByText('기획부, 재정부')).toBeTruthy()
    const row = within(table).getByRole('button', { name: '사용처 b' }).closest('tr')!
    expect(within(row).getByText('상시')).toBeTruthy()
    // 부서와 예산 항목이 모두 없다.
    expect(within(row).getAllByText('—')).toHaveLength(2)
    expect(within(row).getByText('10월 20일 (화)')).toBeTruthy()
    expect(within(row).getByText('증빙 없음')).toBeTruthy()
    const cancelled = within(table).getByRole('button', { name: '사용처 c' }).closest('tr')!
    expect(within(cancelled).getByText('취소됨')).toBeTruthy()
    expect(within(cancelled).queryByText('증빙 없음')).toBeNull()
    expect(cancelled.className).toContain('opacity-50')
    const button = within(row).getByRole('button', { name: '사용처 b' })
    expect(button.tabIndex).toBe(0)
    fireEvent.click(button)
    expect(onOpen).toHaveBeenCalledExactlyOnceWith('b')
  },
)

test('표의 예산 항목과 금액은 선택한 배분 범위를 따른다', () => {
  navigationWidth(1280)
  render(<Sample />)
  const table = screen.getByRole('table')
  expect(within(table).getByText('운영비')).toBeTruthy()
  expect(within(table).getByText('선택 범위 36,000원')).toBeTruthy()
})

test('390px에서는 카드만 보이고 1024px부터 표로 바뀐다', () => {
  const resize = navigationWidth(390)
  render(<ExpensesPanel list={summaryList} onOpen={() => {}} />)
  expect(screen.queryByRole('table')).toBeNull()
  const card = screen.getByRole('heading', { name: '사용처 a' }).closest('li')!
  expect(within(card).getByText('축제 · 기획부, 재정부')).toBeTruthy()
  act(() => resize(1024))
  expect(screen.getByRole('table')).toBeTruthy()
  expect(screen.queryByRole('heading', { name: '사용처 a' })).toBeNull()
})

test.each([390, 1280])('%ipx에서 상한 안내는 요약 바로 다음이고 행 복사 글이 같다', async width => {
  navigationWidth(width)
  const writeText = vi.fn().mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
  render(<ExpensesPanel list={list} onOpen={() => {}} />)
  const status = summaryCell('지출 합계').closest('[role="status"]')!
  const notice = screen.getByText('지출이 많아서 300개만 보여요.')
  expect(status.nextElementSibling).toBe(notice)
  // 390은 상한 안내와 목록 사이에 접힌 [필터]가 있다.
  const next =
    width === 390 ? notice.nextElementSibling!.nextElementSibling! : notice.nextElementSibling!
  expect(width === 390 ? next.tagName : next.firstElementChild?.tagName).toBe(
    width === 390 ? 'UL' : 'TABLE',
  )
  const button = screen.getByRole('button', { name: '문구점' })
  const row = button.closest(width === 390 ? 'li' : 'tr')!
  fireEvent.click(within(row).getByRole('button', { name: '행 복사' }))
  await screen.findByText('행 복사 완료')
  expect(writeText).toHaveBeenCalledExactlyOnceWith('축제\t포스터 인쇄')
})

test('행 복사는 탭으로 나눈 두 칸(행사, 내역)을 쓰며 실패 뒤 다시 누를 수 있다', async () => {
  const writeText = vi.fn().mockRejectedValueOnce(new Error('denied')).mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
  render(<Sample />)
  const card = screen.getByRole('heading', { name: '문구점' }).closest('li')!
  fireEvent.click(within(card).getByRole('button', { name: '행 복사' }))
  await screen.findByText('복사하지 못했어요. 다시 눌러 주세요.')
  fireEvent.click(within(card).getByRole('button', { name: '행 복사' }))
  await screen.findByText('행 복사 완료')
  expect(writeText).toHaveBeenLastCalledWith('축제\t포스터 인쇄')
})

test('모르는 기간의 주소는 전체 지출이나 0원으로 바꾸지 않는다', () => {
  render(<ExpensesPanel list={list} onOpen={() => {}} periodId="missing" />)
  expect(screen.queryByRole('heading', { name: '문구점' })).toBeNull()
  expect(screen.getByRole('alert').textContent).toBe('회계 기간을 찾을 수 없어요.')
  expect(screen.queryByText('합계 0원')).toBeNull()
})

// FIN-LEDGER-01 차례(요약 → 찾기 → 목록). 390에서 칸 다섯이 요약을 첫 화면 밖으로 밀지 않게 [필터] 하나로 접는다.
test('1024 아래에서는 요약이 맨 위이고 필터 칸은 [필터]로 접히며 고른 수를 보인다', () => {
  navigationWidth(390)
  render(<Sample />)
  const status = summaryCell('지출 합계').closest('[role="status"]')!
  const toggle = screen.getByRole('button', { name: '필터 1' })
  expect(status.compareDocumentPosition(toggle) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(toggle.getAttribute('aria-expanded')).toBe('false')
  expect(screen.queryByRole('combobox', { name: '회계 기간' })).toBeNull()
  fireEvent.click(toggle)
  expect(toggle.getAttribute('aria-expanded')).toBe('true')
  expect(screen.getByRole<HTMLSelectElement>('combobox', { name: '회계 기간' }).value).toBe('p')
  fireEvent.change(screen.getByLabelText('증빙'), { target: { value: 'present' } })
  expect(screen.getByRole('button', { name: '필터 2' })).toBe(toggle)
  fireEvent.click(toggle)
  expect(screen.queryByRole('combobox', { name: '증빙' })).toBeNull()
})

test('1024 이상은 필터 칸이 요약 위에 늘 펼쳐져 있고 [필터]가 없다', () => {
  navigationWidth(1280)
  render(<Sample />)
  expect(screen.queryByRole('button', { name: /^필터/ })).toBeNull()
  const period = screen.getByRole('combobox', { name: '회계 기간' })
  const status = summaryCell('지출 합계').closest('[role="status"]')!
  expect(period.compareDocumentPosition(status) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
})
