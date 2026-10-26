import { useState } from 'react'
import type { AccountItem, FiscalPeriodSummary } from '@vada/contracts'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { AccountCard } from '@/finance/AccountCard'
import { AccountFormDialog } from '@/finance/AccountFormDialog'
import { ClosingChecks } from '@/finance/ClosingChecks'
import { emptyExpense } from '@/finance/expense-form'
import { expensePeriodNotice } from '@/finance/ExpensePaymentFields'
import { PaymentFields } from '@/finance/ExpenseFields'
import { PeriodSelect } from '@/finance/PeriodSelect'
import { SettingsTabs } from '@/settings/SettingsTabs'
import { Section } from './GallerySection'

const noop = () => {}
const COUNCIL = '11111111-1111-4111-8111-111111111111'
const account: AccountItem = {
  id: '22222222-2222-4222-8222-222222222222',
  name: '학생회비 통장',
  bank: '국민은행',
  accountNumber: '123-45-678901',
  holder: '소프트웨어학부 학생회',
  type: 'main',
  closedOn: null,
  formsInUse: 0,
  actions: ['account.update'],
}
const periods: FiscalPeriodSummary[] = [
  {
    id: '33333333-3333-4333-8333-333333333333',
    name: '2027년 1학기',
    startsOn: '2027-01-01',
    endsOn: '2027-06-30',
    current: false,
    previousPeriodId: null,
    status: 'draft',
    publishedAt: null,
  },
]

function Preview() {
  const [editing, setEditing] = useState(false)
  const [values, setValues] = useState(() => emptyExpense('2026-08-31', null))
  return (
    <div className="flex min-w-0 flex-col gap-4 break-keep">
      <Card className="flex flex-col gap-3 p-4">
        <h3 className="text-base font-semibold">설정</h3>
        <SettingsTabs accounts onChange={noop} />
        <AccountCard account={account} onEdit={() => setEditing(true)} onClose={noop} />
      </Card>
      <Card className="flex flex-col gap-3 p-4">
        <h3 className="text-base font-semibold">다음 기간 예산</h3>
        <PeriodSelect periods={periods} value={periods[0]!.id} onChange={noop} />
        <Button variant="outline" className="self-start max-sm:min-h-11" onClick={noop}>
          예산 편성
        </Button>
      </Card>
      <Card className="flex flex-col gap-3 p-4">
        <h3 className="text-base font-semibold">지출 적기</h3>
        <PaymentFields
          values={values}
          disabled={false}
          today="2026-10-26"
          onChange={setValues}
          errors={{}}
          paidOnNotice={expensePeriodNotice(values.paidOn, periods)}
        />
      </Card>
      <ClosingChecks
        closing={{
          checks: [
            {
              kind: 'no_period',
              count: 1,
              targets: [
                {
                  type: 'expense',
                  id: '44444444-4444-4444-8444-444444444444',
                  vendor: '문구점',
                  amount: 1234,
                },
              ],
            },
          ],
          feePending: { blocking: [], nextPeriod: { eventCount: 0, depositCount: 0, amount: 0 } },
        }}
        openers={{ onOpenExpense: noop, onOpenRequest: noop, onOpenEvent: noop }}
      />
      {editing && (
        <AccountFormDialog
          councilId={COUNCIL}
          account={account}
          onClose={() => setEditing(false)}
          onSaved={() => setEditing(false)}
          onLost={noop}
          onForbidden={noop}
        />
      )}
    </div>
  )
}

export function FinancePeriodsSection() {
  return (
    <Section title="설정 계좌·다음 기간 예산·기간 없는 지출">
      {['1280px', '390px'].map(width => (
        <div key={width} className={width === '1280px' ? 'w-full' : 'w-97.5 max-w-full'}>
          <h3 className="mb-3 text-sm text-muted-foreground">{width}</h3>
          <Preview />
        </div>
      ))}
    </Section>
  )
}
