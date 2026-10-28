import type { Closing } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { ClosingChecks } from '@/finance/ClosingChecks'
import { ClosingSectionLinks, ClosingSectionPart } from '@/finance/ClosingSectionLinks'
import { ClosingExpenseSection } from '@/finance/ClosingSections'
import { ClosingStatusBadge } from '@/finance/ClosingStatusBadge'
import { closingFixture } from '@/test-support/closing-fixtures'
import { Section } from './GallerySection'
import { longName } from './sample-text'

const noop = () => {}

const report = closingFixture()
const expenseLine = report.expense.items[0]!
const expenseClosing = {
  ...report,
  expense: {
    ...report.expense,
    items: [
      { ...expenseLine, id: 'spring', purpose: '식비', eventName: '봄 축제' },
      { ...expenseLine, id: 'sports', purpose: '식비', eventName: '체육대회' },
      { ...expenseLine, id: 'long', purpose: '행사 운영비', eventName: longName },
      { ...expenseLine, id: 'council', purpose: '학생회 운영비', eventName: null },
    ],
    noItem: 0,
  },
}

const closing: Pick<Closing, 'checks' | 'feePending'> = {
  checks: [
    {
      kind: 'no_evidence',
      count: 3,
      targets: [{ type: 'expense', id: 'x1', vendor: longName, amount: 36000 }],
    },
  ],
  feePending: {
    blocking: [{ event: { id: 'e1', name: longName }, depositCount: 4, amount: 120000 }],
    nextPeriod: { eventCount: 1, depositCount: 2, amount: 60000 },
  },
}

export function ClosingSection() {
  return (
    <Section title="결산 상태 배지와 점검">
      <div className="flex w-80 max-w-full flex-col gap-6">
        <ClosingSectionLinks />
        <ClosingSectionPart part="events">
          <StateMessage kind="empty">행사 없음</StateMessage>
        </ClosingSectionPart>
        <ClosingSectionPart part="period">
          <div className="flex gap-2">
            <ClosingStatusBadge status="draft" />
            <ClosingStatusBadge status="published" />
          </div>
          <ClosingExpenseSection closing={expenseClosing} />
          <ClosingChecks
            closing={closing}
            openers={{ onOpenExpense: noop, onOpenRequest: noop, onOpenEvent: noop }}
          />
        </ClosingSectionPart>
      </div>
    </Section>
  )
}
