import { useState, type ReactNode } from 'react'
import {
  PURCHASE_STATUSES,
  type BudgetItemView,
  type PurchaseLineItem,
  type PurchaseRequestSummary,
} from '@vada/contracts'
import { Button } from '@/components/ui/button'
import { RequestFilter } from '@/purchases/RequestFilter'
import type { PurchaseView } from '@vada/contracts'
import { emptyRow, type RowValues } from '@/finance/decision-form'
import { DecisionFrame, DecisionRows, NeedsBudget } from '@/finance/DecisionPanel'
import { DecisionRow, PendingItemCard } from '@/finance/DecisionRow'
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
// 예산 항목과 결재 칸 품목의 번호는 서버처럼 UUID다. 계약 검사가 UUID만 받아, 아니면 누를 때 확인이 '그래도 승인'까지 가지 못한다.
const B1 = '0199d1a0-0000-7000-8000-0000000000b1'
const B2 = '0199d1a0-0000-7000-8000-0000000000b2'
const UUID_TAIL_LENGTH = 12
const uuidOf = (index: number) =>
  `0199d1a0-0000-7000-8000-${String(index).padStart(UUID_TAIL_LENGTH, '0')}`
// 예산 없음 표본의 품목 번호(결재 칸 표본의 번호와 겹치지 않게).
const WAITING_LINES = [
  '0199d1a0-0000-7000-8000-0000000000a9',
  '0199d1a0-0000-7000-8000-0000000000aa',
]
const budgetItems: BudgetItemView[] = [
  {
    id: B1,
    purpose: '행사 홍보',
    amount: 300000,
    type: 'expense',
    event: null,
    selectable: true,
    deletable: true,
    history: [],
    actual: 0,
    committed: 0,
    available: 300000,
  },
  {
    id: B2,
    purpose: longName,
    amount: 50000,
    type: 'expense',
    event: null,
    selectable: true,
    deletable: true,
    history: [],
    actual: 0,
    committed: 0,
    available: 50000,
  },
]

export function FinanceSection() {
  const [view, setView] = useState<PurchaseView>('mine')
  return (
    <Section title="구매 요청 카드·상태 배지">
      <RequestFilter view={view} onView={setView} canViewDepartment />
      <div className="flex w-full flex-wrap items-center gap-2">
        {PURCHASE_STATUSES.map(status => (
          <StatusBadge key={status} status={status} />
        ))}
      </div>
      <div className="flex w-80 flex-col gap-2">
        <RequestCard request={request('1', {})} mark="soon" onOpen={noop} />
        <RequestCard request={request('5', { title: '지난 요청' })} mark="overdue" onOpen={noop} />
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
    {
      item: { ...lineItem('A2 포스터'), estimatedShippingFee: 2500 },
      values: filled,
      chosen: B1,
      errors: {},
    },
    {
      item: lineItem('테이프'),
      values: { ...emptyRow(), choice: 'approve' },
      chosen: '',
      errors: tried,
    },
    {
      item: { ...lineItem('미검토'), estimatedUnitPrice: 100, estimatedShippingFee: null },
      values: emptyRow({ quantity: 3, estimatedUnitPrice: 100, estimatedShippingFee: null }),
      chosen: '',
      errors: { choice: '승인이나 반려를 골라 주세요' },
    },
    { item: lineItem('사유를 쓰는 중'), values: rejecting, chosen: B2, errors: {} },
    { item: lineItem(longName), values: filled, chosen: B2, errors: {} },
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
// 줄 이름 → 처음 입력값. 금액은 쉼표 꼴로 맞춘다.
type Preset = [name: string, values: RowValues | null]
const approveRow = (amount: string, budgetItemId: string): RowValues => ({
  ...emptyRow(),
  amount,
  budgetItemId,
  choice: 'approve',
})
const rejectRow: RowValues = { ...emptyRow(), choice: 'reject', reason: '이미 있어요' }

function GalleryRows({ presets }: { presets: Preset[] }) {
  const items = presets.map(([name], index) => ({
    ...lineItem(name),
    id: uuidOf(index + 1),
    options: index === 0 ? 'A2 · 무광' : null,
    link: index === 0 ? 'https://www.coupang.com/vp/products/123456' : null,
  }))
  const initial = Object.fromEntries(
    presets.flatMap(([, values], index) => (values ? [[uuidOf(index + 1), values]] : [])),
  )
  return (
    <DecisionFrame count={items.length}>
      <DecisionRows
        councilId="gallery"
        items={items}
        budgetItems={budgetItems}
        decide={idleDecide}
        onInvalidItem={noop}
        initial={initial}
      />
    </DecisionFrame>
  )
}

// 승인(같은 항목 합이 넘어 '승인하면 -20,000원'), 반려(금액 칸 숨김), 미검토, 긴 이름.
const mixed: Preset[] = [
  ['A2 포스터', approveRow('30,000', B2)],
  ['현수막', approveRow('40,000', B2)],
  ['테이프', rejectRow],
  ['간식', null],
  [longName, approveRow('3,000', B1)],
]
// 미검토가 없어 [부분 승인 처리]를 누르면 '사용 가능 금액 초과' 확인 창이 열린다.
const complete: Preset[] = [
  ['A2 포스터', approveRow('30,000', B2)],
  ['현수막', approveRow('40,000', B2)],
  ['테이프', rejectRow],
]

// 결재 칸 한 벌(024 조각 7, 와이어프레임 FIN-REV-01 '품목별 검토').
export function DecisionPanelSection() {
  return (
    <Section title="결재 칸">
      <Width label="1280px 창(요청 상세 대화상자)" className="w-116 shrink-0">
        <GalleryRows presets={mixed} />
      </Width>
      <Width label="390px 창" className="w-77.5 shrink-0">
        <GalleryRows presets={mixed} />
      </Width>
      <Width label="1280px 창(누르면 그래도 승인 창)" className="w-116 shrink-0">
        <GalleryRows presets={complete} />
      </Width>
      <Width label="1280px 창(예산 없음)" className="w-116 shrink-0">
        <div className="flex flex-col gap-4">
          <DecisionFrame count={1}>
            <PendingItemCard item={{ ...lineItem('A2 포스터'), id: WAITING_LINES[0]! }} />
            <NeedsBudget hasPeriod={false} onOpenBudget={noop} />
          </DecisionFrame>
          <DecisionFrame count={1}>
            <PendingItemCard item={{ ...lineItem('A2 포스터'), id: WAITING_LINES[1]! }} />
            <NeedsBudget hasPeriod onOpenBudget={noop} />
          </DecisionFrame>
        </div>
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
