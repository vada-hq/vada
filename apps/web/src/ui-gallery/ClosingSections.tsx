import type { Closing } from '@vada/contracts'
import { ClosingChecks } from '@/finance/ClosingChecks'
import { ClosingStatusBadge } from '@/finance/ClosingStatusBadge'
import { Section } from './GallerySection'
import { longName } from './sample-text'

const noop = () => {}

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
      <div className="flex w-80 flex-col gap-3">
        <div className="flex gap-2">
          <ClosingStatusBadge status="draft" />
          <ClosingStatusBadge status="published" />
        </div>
        <ClosingChecks
          closing={closing}
          openers={{ onOpenExpense: noop, onOpenRequest: noop, onOpenEvent: noop }}
        />
      </div>
    </Section>
  )
}
