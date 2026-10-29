import { type EventSettlement, type EventSettlementRow, type EventSummary } from '@vada/contracts'
import { EventSettlementList } from '@/finance/EventSettlementList'
import { EventSettlementTable } from '@/finance/EventSettlementTable'
import { useSplit } from '@/lib/use-split'
import { SettlementRemaining } from '@/events/SettlementRemaining'
import { PurchaseBudgetSummary } from '@/purchases/PurchaseBudgetSummary'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
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

// 행사 구매 탭의 예산 요약(재정부 버튼 포함)과 정산에 남은 것. 품목 칸반은 PurchasesSection에 있다.
export function SettlementSection() {
  return (
    <Section title="행사 구매 탭의 예산 요약">
      <div className="flex w-full min-w-0 flex-col gap-6">
        <PurchaseBudgetSummary
          settlement={settlement}
          actions={['예산 편성', '지출 적기'].map(label => (
            <Button key={label} touch variant="outline">
              {label}
            </Button>
          ))}
        />
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
