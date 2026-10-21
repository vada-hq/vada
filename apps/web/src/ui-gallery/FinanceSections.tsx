import { PURCHASE_STATUSES, type PurchaseRequestSummary } from '@vada/contracts'
import { Badge } from '@/components/ui/badge'
import { pendingCountOf } from '@/finance/purchase-view'
import RequestCard from '@/finance/RequestCard'
import { StatusBadge } from '@/finance/StatusBadge'
import { Section } from './GallerySection'
import { longName, unbroken } from './sample-text'

const request = (id: string, extra: Partial<PurchaseRequestSummary>): PurchaseRequestSummary => ({
  id,
  title: '행사 포스터 인쇄',
  status: 'pending',
  requestedBy: { id: 'm1', name: '김새내' },
  neededBy: '2026-10-25',
  itemCount: 3,
  createdAt: '2026-10-21T05:03:00.000Z',
  ...extra,
})

const noop = () => {}

export function FinanceSection() {
  const few = pendingCountOf([request('a', {}), request('b', {})], false)
  const many = pendingCountOf([request('c', {})], true)
  return (
    <Section title="구매 요청 카드·상태 배지">
      <div className="flex w-full flex-wrap items-center gap-2">
        {PURCHASE_STATUSES.map(status => (
          <StatusBadge key={status} status={status} />
        ))}
        {few && <Badge tone="warning">{few.label}</Badge>}
        {many && <Badge tone="warning">{many.label}</Badge>}
      </div>
      <div className="flex w-80 flex-col gap-2">
        <RequestCard request={request('1', {})} onOpen={noop} />
        <RequestCard
          request={request('2', { status: 'partial', neededBy: null, itemCount: 1 })}
          onOpen={noop}
        />
        <RequestCard request={request('3', { status: 'cancelled' })} onOpen={noop} />
        <RequestCard
          request={request('4', {
            title: `${unbroken} ${longName}`,
            requestedBy: { id: 'm2', name: longName },
          })}
          onOpen={noop}
        />
      </div>
    </Section>
  )
}
