import { useState } from 'react'
import {
  EVENT_PURCHASE_VIEWS,
  type EventSettlement,
  type EventSettlementRow,
  type EventSummary,
  type PurchaseRequestSummary,
  type PurchaseStage,
} from '@vada/contracts'
import { EventSettlementList } from '@/finance/EventSettlementList'
import { EventSettlementTable } from '@/finance/EventSettlementTable'
import { useSplit } from '@/lib/use-split'
import { SettlementRemaining } from '@/events/SettlementRemaining'
import { SettlementBudget } from '@/events/SettlementSummary'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { RequestFilter } from '@/purchases/RequestFilter'
import { PurchaseStages } from '@/purchases/PurchaseStages'
import { PurchasesBody } from '@/purchases/PurchasesBody'
import { Section } from './GallerySection'
import { longName } from './sample-text'

const noop = () => {}

const settlement: EventSettlement = {
  budget: {
    expense: 500000,
    income: 0,
    items: [
      {
        id: 'b1',
        type: 'expense',
        purpose: '간식',
        amount: 300000,
        actual: 336000,
        committed: 24000,
        available: -60000,
      },
      {
        id: 'b2',
        type: 'income',
        purpose: longName,
        amount: 100000,
        actual: 40000,
        committed: null,
        available: null,
      },
    ],
  },
  actual: { expense: 336000, fee: 40000, income: 0, depositCount: 2, refundPendingCount: 1 },
  difference: 164000,
  remaining: [
    {
      kind: 'no_reason',
      count: 1,
      targets: [{ type: 'expense', id: 'x1', vendor: '인쇄소', amount: 36000 }],
    },
    {
      kind: 'unpaid_items',
      count: 60,
      targets: [{ type: 'request', id: 'r1', title: longName }],
    },
    { kind: 'refund_pending', count: 1, targets: [] },
  ],
  settled: false,
  completed: false,
  approvals: [],
}

const request: PurchaseRequestSummary = {
  id: '0199d1a0-0000-7000-8000-000000000001',
  title: '신입생 환영회 간식과 행사 물품 구매',
  status: 'pending',
  requestedBy: { id: '0199d1a0-0000-7000-8000-000000000002', name: '김새내' },
  neededBy: '2026-10-30',
  itemCount: 2,
  createdAt: '2026-10-28T03:00:00Z',
  payable: false,
  event: { id: '0199d1a0-0000-7000-8000-000000000003', name: '신입생 환영회' },
  progress: { decided: false, paid: false, partlyPaid: false, hasShipment: false },
}

// 실제 탭과 같은 부품·차례로 예산 → 행동 → 요청 목록 → 정산에 남은 것을 본다.
export function SettlementSection() {
  const [view, setView] = useState<(typeof EVENT_PURCHASE_VIEWS)[number]>('all')
  const [stage, setStage] = useState<PurchaseStage | undefined>()
  return (
    <Section title="행사 구매 탭">
      <div className="flex min-w-0 w-full flex-col gap-6">
        <SettlementBudget settlement={settlement} />
        <div className="flex flex-wrap gap-2">
          {['구매 요청 내기', '예산 편성', '지출 적기'].map(label => (
            <Button key={label} touch variant="outline" size="sm">
              {label}
            </Button>
          ))}
        </div>
        <section aria-label="행사 구매 요청" className="flex flex-col gap-4">
          <RequestFilter
            views={EVENT_PURCHASE_VIEWS}
            view={view}
            onView={next => {
              setView(next === 'mine' ? 'mine' : 'all')
              setStage(undefined)
            }}
          />
          <PurchaseStages
            counts={{ pending: 1, unpaid: 0, paid: 0, closed: 0 }}
            stage={stage}
            onStage={next => setStage(next ?? undefined)}
          />
          <PurchasesBody
            view={view}
            list={{
              state: {
                kind: 'ready',
                requests: !stage || stage === 'pending' ? [request] : [],
                truncated: false,
                stageCounts: { pending: 1, unpaid: 0, paid: 0, closed: 0 },
              },
              reload: async () => {},
            }}
            onOpen={noop}
          />
        </section>
        <SettlementRemaining settlement={settlement} onOpenRequest={noop} onOpenExpense={noop} />
      </div>
    </Section>
  )
}

const settlingEvent = (
  id: string,
  name: string,
  status: EventSummary['status'],
  settlement: EventSettlementRow['settlement'],
): EventSettlementRow => ({
  event: {
    id,
    name,
    startsAt: status === 'tbd' ? null : '2026-10-24T14:00',
    endsAt: null,
    place: null,
    owner: null,
    status,
  },
  settlement,
})

const settlingRows = [
  settlingEvent('s1', '봄 축제', 'ended', { remaining: 12, settled: false }),
  settlingEvent('s2', longName, 'ended', { remaining: 0, settled: true }),
  settlingEvent('s3', '전시', 'ongoing', { remaining: 1, settled: false }),
  settlingEvent('s4', '졸업 파티', 'tbd', { remaining: 0, settled: false }),
  settlingEvent('s5', '개강 파티', 'completed', { remaining: 0, settled: true }),
]

// 재정의 '행사 정산' 탭: 끝났고 완료하지 않은 것 → 진행 중·예정·날짜 미정 → 완료.
// 실제 탭과 같은 조건으로 넓은 화면(lg)에서만 표를 그리고, 카드 줄은 늘 보인다.
export function EventSettlementsSection() {
  const wide = useSplit()
  return (
    <Section title="재정 행사 정산 탭">
      <div className="flex w-full flex-col gap-4">
        {wide && <EventSettlementTable rows={settlingRows} onOpen={noop} />}
        <div className="w-full max-w-sm">
          <EventSettlementList rows={settlingRows} onOpen={noop} />
        </div>
        <StateMessage kind="empty">행사 없음</StateMessage>
      </div>
    </Section>
  )
}
