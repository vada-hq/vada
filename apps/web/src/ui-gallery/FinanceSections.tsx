import {
  PURCHASE_STATUSES,
  type BudgetItemView,
  type PurchaseLineItem,
  type PurchaseRequestSummary,
} from '@vada/contracts'
import { Badge } from '@/components/ui/badge'
import { emptyRow } from '@/finance/decision-form'
import { DecisionRow } from '@/finance/DecisionRow'
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
  event: null,
  ...extra,
})

const noop = () => {}

const lineItem = (name: string): PurchaseLineItem => ({
  id: name,
  name,
  quantity: 3,
  link: null,
  options: null,
  amount: null,
  budgetItem: null,
  status: 'pending',
  paid: false,
})
const budgetItems: BudgetItemView[] = [
  { id: 'b1', purpose: '행사 홍보', amount: 300000, type: 'expense', event: null },
  { id: 'b2', purpose: longName, amount: 50000, type: 'expense', event: null },
]

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

export function DecisionSection() {
  const filled = { ...emptyRow(), amount: '15000' }
  const rejecting = { ...emptyRow(), rejecting: true, reason: '이미 있어요' }
  const rows = [
    { item: lineItem('A2 포스터'), values: filled, chosen: 'b1', canApprove: true },
    { item: lineItem('테이프'), values: emptyRow(), chosen: '', canApprove: false },
    { item: lineItem('사유를 쓰는 중'), values: rejecting, chosen: 'b2', canApprove: true },
    { item: lineItem(longName), values: filled, chosen: 'b2', canApprove: true },
  ]
  return (
    <Section title="결재 줄">
      <div className="flex w-80 flex-col gap-2">
        {rows.map(row => (
          <DecisionRow
            key={row.item.id}
            {...row}
            budgetItems={budgetItems}
            disabled={false}
            canReject
            onChange={noop}
            onApprove={noop}
            onReject={noop}
          />
        ))}
      </div>
    </Section>
  )
}
