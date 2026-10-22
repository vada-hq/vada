import type { EventSettlement } from '@vada/contracts'
import EventCard from '@/events/EventCard'
import { SettlementRemaining } from '@/events/SettlementRemaining'
import { SettlementItems, SettlementNumbers } from '@/events/SettlementSummary'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { EVENT_COMPLETED_NOTICE } from '@/lib/messages'
import { Section } from './GallerySection'
import { longName } from './sample-text'

const noop = () => {}

const settlement: EventSettlement = {
  budget: {
    expense: 500000,
    income: 0,
    items: [
      { id: 'b1', type: 'expense', purpose: '간식', amount: 300000, used: 336000 },
      { id: 'b2', type: 'income', purpose: longName, amount: 100000, used: 40000 },
    ],
  },
  actual: { expense: 336000, fee: 40000, depositCount: 2, refundPendingCount: 1 },
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

// 행사의 돈 탭: 예산 대비 실제, 예산 항목, 남은 것, 정산이 끝난 모습, 완료한 행사의 배지와 안내.
export function SettlementSection() {
  return (
    <Section title="행사 정산(돈 탭)">
      <div className="flex w-80 flex-col gap-4">
        <EventCard
          event={{
            id: '1',
            name: '신입생 환영회',
            startsAt: '2026-10-24T14:00',
            endsAt: '2026-10-24T18:00',
            place: '대강당',
            owner: { id: 'p1', name: '김새내', current: true },
            status: 'completed',
          }}
          onOpen={noop}
        />
        <Alert tone="info">{EVENT_COMPLETED_NOTICE}</Alert>
        <SettlementNumbers settlement={settlement} />
        <SettlementItems items={settlement.budget.items} />
        <SettlementRemaining settlement={settlement} onOpenRequest={noop} onOpenExpense={noop} />
        <SettlementRemaining
          settlement={{ ...settlement, remaining: [], settled: true }}
          onOpenRequest={noop}
          onOpenExpense={noop}
        />
        <div className="flex gap-2">
          <Button>완료</Button>
          <Button variant="outline">완료 취소</Button>
        </div>
      </div>
    </Section>
  )
}
