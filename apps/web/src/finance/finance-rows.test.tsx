// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { eventSummary } from '@/test-support/event-fixtures'
import { expenseSummary } from '@/test-support/expense-fixtures'
import { incomeSummary } from '@/test-support/income-fixtures'
import { overviewFixture } from '@/test-support/overview-fixtures'
import { ClosingChecks } from './ClosingChecks'
import { EventSettlementList } from './EventSettlementList'
import ExpenseCard from './ExpenseCard'
import IncomeCard from './IncomeCard'
import { OverviewCards } from './OverviewCards'
import { OverviewEvents } from './OverviewEvents'
import { OverviewRecent } from './OverviewRecent'

afterEach(cleanup)

// 재정 줄은 홈 줄(mob-6)과 같은 '줄 전체 누르기'다: 줄 상자는 휴대폰에서 44px 이상이고 초점 링을 그리며,
// 제목 단추 하나의 ::after가 줄을 덮는다. jsdom에는 배치가 없어 class 계약으로 보고 실제 크기는 390 브라우저에서 잰다.
const tokens = (element: Element) => element.className.split(' ')
const BOX = [
  'relative',
  'max-sm:min-h-11',
  'has-focus-visible:ring-2',
  'has-focus-visible:ring-inset',
]
const TARGET = ['after:absolute', 'after:inset-0', 'focus-visible:ring-0']

function expectStretched(row: Element, name: string) {
  const buttons = within(row as HTMLElement).getAllByRole('button')
  const target = within(row as HTMLElement).getByRole('button', { name })
  expect(tokens(row)).toEqual(expect.arrayContaining(BOX))
  expect(tokens(target)).toEqual(expect.arrayContaining(TARGET))
  return { buttons, target }
}

test('행사별·최근 지출·행사 정산 카드 줄은 이름 단추 하나가 줄 전체를 덮는다', () => {
  const overview = overviewFixture()
  const onOpen = vi.fn()
  render(
    <>
      <OverviewEvents rows={overview.events} wide={false} onOpen={onOpen} />
      <OverviewRecent rows={overview.recent} wide={false} onOpen={onOpen} onAll={() => {}} />
      <EventSettlementList
        rows={[
          {
            event: eventSummary({ id: 's1', name: '봄 축제', status: 'ended' }),
            settlement: { remaining: 3, settled: false },
          },
        ]}
        onOpen={onOpen}
      />
    </>,
  )
  for (const [list, name] of [
    ['행사별 예산', '체육대회'],
    ['최근 지출 목록', '현수막 제작'],
    ['행사 정산', '봄 축제'],
  ] as const) {
    const row = within(screen.getByRole('list', { name: list })).getAllByRole('listitem')[0]!
    const { buttons, target } = expectStretched(row, name)
    expect(buttons).toHaveLength(1)
    fireEvent.click(target)
  }
  expect(onOpen).toHaveBeenCalledTimes(3)
})

test('넓은 화면의 행사별·최근 지출 표는 그대로다(줄 상자 class 없음)', () => {
  const overview = overviewFixture()
  render(
    <>
      <OverviewEvents rows={overview.events} wide onOpen={() => {}} />
      <OverviewRecent rows={overview.recent} wide onOpen={() => {}} onAll={() => {}} />
    </>,
  )
  for (const row of screen.getAllByRole('row').slice(1)) {
    expect(tokens(row)).not.toContain('max-sm:min-h-11')
  }
})

test('수입 카드와 지출 카드는 제목 단추가 카드 전체를 덮고 행 복사는 덮개 위에 남는다', () => {
  const onIncome = vi.fn()
  const onExpense = vi.fn()
  render(
    <>
      <IncomeCard income={incomeSummary('i1')} onOpen={onIncome} />
      <ExpenseCard expense={expenseSummary('x1', { vendor: '인쇄소' })} onOpen={onExpense} />
    </>,
  )
  const incomeCard = screen.getByRole('heading', { name: '지원금' }).closest('[data-slot="card"]')!
  expect(expectStretched(incomeCard, '지원금').buttons).toHaveLength(1)
  const expenseCard = screen.getByRole('heading', { name: '인쇄소' }).closest('[data-slot="card"]')!
  const { buttons, target } = expectStretched(expenseCard, '인쇄소')
  expect(buttons).toHaveLength(2)
  const copy = within(expenseCard as HTMLElement).getByRole('button', { name: '행 복사' })
  expect(tokens(copy)).toEqual(expect.arrayContaining(['relative', 'z-10']))
  fireEvent.click(target)
  expect(onExpense).toHaveBeenCalledOnce()
})

test('예산 현황 카드의 [편성]·[내역]과 [지출 전체 보기]는 휴대폰에서 44px 이상이고 자리는 그대로다', () => {
  const overview = overviewFixture()
  render(
    <>
      <OverviewCards
        overview={overview}
        links={{
          onBudget: () => {},
          budgetLabel: '편성',
          onSpent: () => {},
          onCommitted: () => {},
        }}
      />
      <OverviewRecent rows={overview.recent} wide={false} onOpen={() => {}} onAll={() => {}} />
    </>,
  )
  const links = [
    screen.getByRole('button', { name: '편성' }),
    ...screen.getAllByRole('button', { name: '내역' }),
    screen.getByRole('button', { name: '지출 전체 보기' }),
  ]
  expect(links).toHaveLength(4)
  for (const link of links) {
    // 키운 만큼 음수 바깥 여백으로 되돌려 카드·머리 높이와 글자 자리를 바꾸지 않는다.
    expect(tokens(link)).toEqual(expect.arrayContaining(['max-sm:min-h-11', 'max-sm:-my-3']))
  }
})

test('결산 점검의 대상 링크는 휴대폰에서 44px 이상이고, 입금 행사 줄은 줄 전체를 누른다', () => {
  const openers = { onOpenExpense: vi.fn(), onOpenRequest: vi.fn(), onOpenEvent: vi.fn() }
  render(
    <ClosingChecks
      closing={{
        checks: [
          {
            kind: 'no_period',
            count: 2,
            targets: [
              { type: 'expense', id: 'x1', vendor: '문구점', amount: 1234 },
              { type: 'expense', id: 'x2', vendor: '인쇄소', amount: 5000 },
            ],
          },
        ],
        feePending: {
          blocking: [{ event: { id: 'e1', name: '체육대회' }, depositCount: 2, amount: 20000 }],
          nextPeriod: { eventCount: 0, depositCount: 0, amount: 0 },
        },
      }}
      openers={openers}
    />,
  )
  const target = screen.getByRole('button', { name: /문구점/ })
  expect(tokens(target)).toContain('max-sm:min-h-11')
  fireEvent.click(target)
  expect(openers.onOpenExpense).toHaveBeenCalledWith('x1')
  const pending = screen.getByRole('button', { name: '체육대회' }).closest('li')!
  expect(expectStretched(pending, '체육대회').buttons).toHaveLength(1)
})
