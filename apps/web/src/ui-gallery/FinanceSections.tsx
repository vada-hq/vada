import { useState, type ReactNode } from 'react'
import {
  PURCHASE_STATUSES,
  type BudgetItemView,
  type PurchaseLineItem,
  type PurchaseRequestSummary,
} from '@vada/contracts'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { emptyRow, type RowValues } from '@/finance/decision-form'
import { DecisionRows } from '@/finance/DecisionPanel'
import { DecisionRow } from '@/finance/DecisionRow'
import { pendingCountOf } from '@/finance/purchase-view'
import { ItemCancelDialog } from '@/finance/ItemCancel'
import RequestCard from '@/finance/RequestCard'
import { RequestItems } from '@/finance/RequestItems'
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
  payable: false,
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
  payable: false,
  actions: [],
})
const budgetItems: BudgetItemView[] = [
  {
    id: 'b1',
    purpose: '행사 홍보',
    amount: 300000,
    type: 'expense',
    event: null,
    selectable: true,
    actual: 0,
    committed: 0,
    available: 300000,
  },
  {
    id: 'b2',
    purpose: longName,
    amount: 50000,
    type: 'expense',
    event: null,
    selectable: true,
    actual: 0,
    committed: 0,
    available: 50000,
  },
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
        <RequestCard request={request('1', {})} soon onOpen={noop} />
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
  const filled: RowValues = { ...emptyRow(), amount: '15000', choice: 'approve' }
  const rejecting: RowValues = { ...emptyRow(), choice: 'reject', reason: '이미 있어요' }
  // 누르고 난 뒤의 모양: 비운 칸 아래에 이유가 보인다.
  const tried = { amount: '금액을 입력해 주세요', budgetItemId: '예산 항목을 골라 주세요' }
  const rows = [
    { item: lineItem('A2 포스터'), values: filled, chosen: 'b1', errors: {} },
    {
      item: lineItem('테이프'),
      values: { ...emptyRow(), choice: 'approve' },
      chosen: '',
      errors: tried,
    },
    {
      item: lineItem('미검토'),
      values: emptyRow(),
      chosen: '',
      errors: { choice: '승인이나 반려를 골라 주세요' },
    },
    { item: lineItem('사유를 쓰는 중'), values: rejecting, chosen: 'b2', errors: {} },
    { item: lineItem(longName), values: filled, chosen: 'b2', errors: {} },
  ] satisfies { item: PurchaseLineItem; values: RowValues; chosen: string; errors: object }[]
  return (
    <Section title="결재 줄">
      <div className="flex w-80 flex-col gap-2">
        {rows.map(row => (
          <DecisionRow
            key={row.item.id}
            {...row}
            budgetItems={budgetItems}
            overages={[]}
            disabled={false}
            onChange={noop}
          />
        ))}
      </div>
    </Section>
  )
}

const idleDecide = {
  saving: false,
  problem: null,
  decide: () => Promise.resolve({ ok: true as const }),
  clearProblem: noop,
}

// 실제 화면의 결재 칸 폭: 요청 상세 대화상자(최대 512px, 안쪽 여백 24px)라 1280px 창은 464px, 390px 창은 약 310px다.
function Width({
  label,
  className,
  children,
}: {
  label: string
  className: string
  children: ReactNode
}) {
  return (
    <div className="flex max-w-full flex-col gap-1 overflow-x-auto">
      <p className="text-xs text-gray-400">{label}</p>
      <div className={className}>{children}</div>
    </div>
  )
}

// 결재 칸 한 벌(024 조각 7, 와이어프레임 FIN-REV-01 '품목별 검토'): 승인(사용 가능 안), 승인(같은 항목 합이 넘어 초과), 반려, 미검토.
export function DecisionPanelSection() {
  const items = ['A2 포스터', '현수막', '테이프', '간식'].map(lineItem)
  const initial: Record<string, RowValues> = {
    'A2 포스터': { ...emptyRow(), amount: '30000', budgetItemId: 'b2', choice: 'approve' },
    현수막: { ...emptyRow(), amount: '40,000', budgetItemId: 'b2', choice: 'approve' },
    테이프: {
      ...emptyRow(),
      amount: '3000',
      budgetItemId: 'b1',
      choice: 'reject',
      reason: '이미 있어요',
    },
  }
  const panel = (
    <DecisionRows
      councilId="gallery"
      items={items}
      budgetItems={budgetItems}
      decide={idleDecide}
      onInvalidItem={noop}
      initial={initial}
    />
  )
  return (
    <Section title="결재 칸">
      <Width label="1280px 창(요청 상세 대화상자)" className="w-116 shrink-0">
        {panel}
      </Width>
      <Width label="390px 창" className="w-77.5 shrink-0">
        {panel}
      </Width>
    </Section>
  )
}

const noCancel = {
  saving: false,
  problem: null,
  cancelItem: () => Promise.resolve('done' as const),
  clearProblem: noop,
}

export function ItemCancelSection() {
  const [open, setOpen] = useState(false)
  const items: PurchaseLineItem[] = [
    { ...lineItem('A2 포스터'), status: 'approved', amount: 15000, actions: ['line_item.cancel'] },
    { ...lineItem('테이프'), status: 'cancelled', amount: 3000 },
    { ...lineItem(longName), status: 'approved', amount: 3000, paid: true },
  ]
  const blocked = {
    ...noCancel,
    problem: {
      lineItemId: 'A2 포스터',
      message: '취소할 수 없는 품목이에요. 요청을 새로 불러왔으니 확인해 주세요.',
    },
  }
  return (
    <Section title="품목 취소">
      <div className="flex w-80 flex-col gap-4">
        <RequestItems items={items} cancel={noCancel} />
        <RequestItems items={items.slice(0, 1)} cancel={blocked} />
      </div>
      <Button variant="outline" onClick={() => setOpen(true)}>
        품목 취소 창 열기
      </Button>
      {open && (
        <ItemCancelDialog
          busy={false}
          error={null}
          onClose={() => setOpen(false)}
          onConfirm={noop}
        />
      )}
    </Section>
  )
}
