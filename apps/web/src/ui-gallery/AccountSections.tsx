import type { AccountItem } from '@vada/contracts'
import { AccountCard } from '@/finance/AccountCard'
import { Section } from './GallerySection'
import { longName, unbroken } from './sample-text'

const account = (id: string, extra: Partial<AccountItem>): AccountItem => ({
  id,
  name: '학생회비 통장',
  bank: '국민은행',
  accountNumber: '123-45-678901',
  holder: '소프트웨어학부 학생회',
  type: 'main',
  closedOn: null,
  formsInUse: 0,
  actions: ['account.update', 'account.close'],
  ...extra,
})

const noop = () => {}

export function AccountSection() {
  return (
    <Section title="계좌 카드">
      <div className="flex w-80 flex-col gap-2">
        <AccountCard account={account('1', {})} onEdit={noop} onClose={noop} />
        <AccountCard
          account={account('2', { name: '행사 통장', type: 'business', actions: [] })}
          onEdit={noop}
          onClose={noop}
        />
        <AccountCard
          account={account('5', {
            name: '참가비 통장',
            formsInUse: 2,
            actions: ['account.update'],
          })}
          onEdit={noop}
          onClose={noop}
        />
        <AccountCard
          account={account('3', { closedOn: '2026-09-01', type: 'business', actions: [] })}
          onEdit={noop}
          onClose={noop}
        />
        <AccountCard
          account={account('4', {
            name: longName,
            bank: longName,
            accountNumber: unbroken,
            holder: `${unbroken} ${longName}`,
          })}
          onEdit={noop}
          onClose={noop}
        />
      </div>
    </Section>
  )
}
