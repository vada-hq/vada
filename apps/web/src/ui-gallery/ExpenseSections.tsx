import type { ExpenseSummary } from '@vada/contracts'
import ExpenseCard from '@/finance/ExpenseCard'
import { Section } from './GallerySection'
import { longName, unbroken } from './sample-text'

const expense = (id: string, extra: Partial<ExpenseSummary>): ExpenseSummary => ({
  id,
  vendor: '인쇄소',
  description: '포스터 인쇄',
  amount: 36000,
  paidOn: '2026-10-20',
  method: 'card',
  paidBy: null,
  reimbursed: false,
  evidenceCount: 1,
  cancelled: false,
  event: null,
  ...extra,
})

const noop = () => {}
const payer = { id: 'm3', name: '박새내' }

export function ExpenseSection() {
  return (
    <Section title="지출 카드">
      <div className="flex w-80 flex-col gap-2">
        <ExpenseCard expense={expense('1', {})} onOpen={noop} />
        <ExpenseCard expense={expense('2', { paidBy: payer, evidenceCount: 0 })} onOpen={noop} />
        <ExpenseCard
          expense={expense('3', { paidBy: payer, reimbursed: true, method: 'cash' })}
          onOpen={noop}
        />
        <ExpenseCard expense={expense('4', { cancelled: true })} onOpen={noop} />
        <ExpenseCard
          expense={expense('5', { vendor: `${unbroken} ${longName}`, description: longName })}
          onOpen={noop}
        />
      </div>
    </Section>
  )
}
