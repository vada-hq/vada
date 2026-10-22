import type { IncomeSummary } from '@vada/contracts'
import IncomeCard from '@/finance/IncomeCard'
import { Section } from './GallerySection'
import { longName, unbroken } from './sample-text'

const income = (id: string, extra: Partial<IncomeSummary>): IncomeSummary => ({
  id,
  source: 'grant',
  amount: 500000,
  receivedOn: '2026-10-20',
  description: '단과대학 지원금',
  budgetItem: null,
  account: { id: 'a1', name: '학생회 통장' },
  createdBy: { id: 'm2', name: '이재정' },
  cancelled: false,
  ...extra,
})

const noop = () => {}

export function IncomeSection() {
  return (
    <Section title="수입 카드">
      <div className="flex w-80 flex-col gap-2">
        <IncomeCard income={income('1', {})} onOpen={noop} />
        <IncomeCard
          income={income('2', { source: 'participation_fee', description: '가을 MT 참가비' })}
          onOpen={noop}
        />
        <IncomeCard
          income={income('3', { source: 'carryover', description: null, account: null })}
          onOpen={noop}
        />
        <IncomeCard income={income('4', { cancelled: true })} onOpen={noop} />
        <IncomeCard
          income={income('5', {
            description: `${unbroken} ${longName}`,
            account: { id: 'a2', name: longName },
          })}
          onOpen={noop}
        />
      </div>
    </Section>
  )
}
