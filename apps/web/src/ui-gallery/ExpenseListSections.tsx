import { useState } from 'react'
import { CommitmentsView } from '@/finance/CommitmentsPanel'
import { ExpensesPanel } from '@/finance/ExpensesPanel'
import type { ExpenseList } from '@/finance/useExpenses'
import { expenseSummary } from '@/test-support/expense-fixtures'
import { Section } from './GallerySection'
import { longName } from './sample-text'

const period = {
  id: '0199d1a0-0000-7000-8000-00000000c001',
  name: '2026년 2학기',
  startsOn: '2026-07-01',
  endsOn: '2026-12-31',
}
const event = { id: '0199d1a0-0000-7000-8000-00000000a001', name: '가을 축제' }
const item = { id: '0199d1a0-0000-7000-8000-00000000d001', purpose: '홍보비' }
const expenseId = '0199d1a0-0000-7000-8000-00000000e001'
const noop = () => {}
const list: ExpenseList = {
  state: {
    kind: 'ready',
    data: {
      expenses: [
        expenseSummary(expenseId, { vendor: '인쇄소', description: '축제 포스터 인쇄', event }),
        expenseSummary('0199d1a0-0000-7000-8000-00000000e002', {
          vendor: longName,
          description: longName,
          evidenceCount: 0,
          amount: 12000,
        }),
      ],
      allocations: [
        {
          expenseId,
          budgetItemId: item.id,
          purpose: item.purpose,
          periodId: period.id,
          amount: 36000,
        },
      ],
      periods: [period],
      truncated: false,
    },
  },
  reload: async () => {},
  replace: noop,
}

function Sample() {
  const [periodId, setPeriodId] = useState<string | null>(period.id)
  return <ExpensesPanel list={list} onOpen={noop} periodId={periodId} onPeriod={setPeriodId} />
}

export function ExpenseListSection() {
  return (
    <Section title="지출 거르기·찾기·행 복사 (1280·390)">
      <div className="flex w-full min-w-0 flex-col gap-6">
        <Sample />
        <h3 className="text-base font-semibold">지출 예정</h3>
        <CommitmentsView
          items={[
            {
              id: item.id,
              name: '안내 현수막',
              requestId: event.id,
              requestTitle: '축제 홍보물',
              event,
              budgetItem: item,
              amount: 20000,
            },
          ]}
          onOpen={noop}
        />
        <CommitmentsView items={[]} onOpen={noop} />
      </div>
    </Section>
  )
}
