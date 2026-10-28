import { useState } from 'react'
import {
  purchaseStageOf,
  type PurchaseRequestSummary,
  type PurchaseStage,
  type PurchaseView,
} from '@vada/contracts'
import { Button } from '@/components/ui/button'
import { PurchaseScopeChips } from '@/purchases/PurchaseScope'
import { PurchaseStages } from '@/purchases/PurchaseStages'
import { RequestFilter } from '@/purchases/RequestFilter'
import RequestCard from '@/finance/RequestCard'
import { Section } from './GallerySection'
import { longName } from './sample-text'

const EVENT = '0199d1a0-0000-7000-8000-0000000000e1'
const samples: PurchaseRequestSummary[] = [
  {
    id: '0199d1a0-0000-7000-8000-000000000001',
    title: longName,
    status: 'pending',
    requestedBy: { id: '0199d1a0-0000-7000-8000-0000000000a1', name: '김새내' },
    neededBy: '2026-10-30',
    itemCount: 2,
    createdAt: '2026-10-28T03:00:00Z',
    payable: false,
    event: { id: EVENT, name: '신입생 환영회' },
    progress: { decided: false, paid: false, partlyPaid: false, hasShipment: false },
  },
  {
    id: '0199d1a0-0000-7000-8000-000000000002',
    title: '행사 포스터 인쇄',
    status: 'approved',
    requestedBy: { id: '0199d1a0-0000-7000-8000-0000000000a2', name: '박운영' },
    neededBy: '2026-10-30',
    itemCount: 3,
    createdAt: '2026-10-27T03:00:00Z',
    payable: true,
    event: null,
    progress: { decided: true, paid: false, partlyPaid: true, hasShipment: true },
  },
]

export function PurchasesSection() {
  const [view, setView] = useState<PurchaseView>('all')
  const [scope, setScope] = useState<string | undefined>()
  const [stage, setStage] = useState<PurchaseStage | undefined>()
  const requests = samples.filter(row =>
    scope === 'none' ? row.event === null : !scope || row.event?.id === scope,
  )
  return (
    <Section title="구매 범위·단계 목록">
      <div className="flex w-full flex-col gap-4">
        <Button touch className="self-start">
          구매 요청 내기
        </Button>
        <PurchaseScopeChips
          scope={scope}
          eventScope={scope === EVENT}
          onScope={value => setScope(value ?? undefined)}
          onEvent={() => setScope(EVENT)}
        />
        <Button touch variant="link" className="self-start">
          예산 현황
        </Button>
        <RequestFilter view={view} onView={setView} hasHeads canDecide />
        <PurchaseStages
          requests={requests}
          stage={stage}
          onStage={value => setStage(value ?? undefined)}
        />
        {requests
          .filter(row => !stage || purchaseStageOf(row) === stage)
          .map(row => (
            <RequestCard key={row.id} request={row} onOpen={() => {}} />
          ))}
      </div>
    </Section>
  )
}
