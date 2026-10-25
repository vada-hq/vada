import type { EventSettlement, EventSettlementRow, EventSummary } from '@vada/contracts'
import EventRow from '@/events/EventRow'
import { EventSettlementList } from '@/finance/EventSettlementList'
import { EventSettlementTable } from '@/finance/EventSettlementTable'
import { SettlementRemaining } from '@/events/SettlementRemaining'
import { SettlementItems, SettlementNumbers } from '@/events/SettlementSummary'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { EVENT_COMPLETED_NOTICE } from '@/lib/messages'
import StateMessage from '@/components/StateMessage'
import { ApprovalNote } from '@/events/ApprovalNote'
import { COMPLETION_ERRORS } from '@/lib/messages'
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

// 행사의 예산·정산 탭: 예산 대비 실제, 예산 항목, 남은 것, 정산이 끝난 모습, 완료한 행사의 배지와 안내.
export function SettlementSection() {
  return (
    <Section title="행사 예산·정산 탭">
      <div className="flex w-80 flex-col gap-4">
        <EventRow
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
        <ApprovalNote
          now={new Date('2026-10-25T03:00:00.000Z')}
          approvals={[
            {
              outcome: 'completion_cancelled',
              by: { id: 'p1', name: '김새내' },
              at: '2026-10-25T03:00:00.000Z',
              reason: longName,
            },
          ]}
        />
        <StateMessage kind="notice">{COMPLETION_ERRORS.EVENT_NOT_ENDED}</StateMessage>
        <div className="flex gap-2">
          <Button>완료</Button>
          <Button variant="outline">완료 취소</Button>
        </div>
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
// 넓은 화면(sm 이상)은 표, 휴대폰은 카드 줄이다. 둘 다 폭에 맞춰 줄어 가로로 넘치지 않는다.
export function EventSettlementsSection() {
  return (
    <Section title="재정 행사 정산 탭">
      <div className="flex w-full flex-col gap-4">
        <EventSettlementTable rows={settlingRows} onOpen={noop} />
        <div className="w-full max-w-sm">
          <EventSettlementList rows={settlingRows} onOpen={noop} />
        </div>
        <StateMessage kind="empty">행사 없음</StateMessage>
      </div>
    </Section>
  )
}
