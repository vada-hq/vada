import { useState } from 'react'
import type { PurchaseArea } from '@vada/contracts'
import { MyPurchaseRequests } from '@/purchases/MyPurchaseRequests'
import { PurchaseBudgetSummary } from '@/purchases/PurchaseBudgetSummary'
import { PurchaseItemBoard } from '@/purchases/PurchaseItemBoard'
import { PurchaseProcessBoard } from '@/purchases/PurchaseProcessBoard'
import { PurchaseRequestTable } from '@/purchases/PurchaseRequestTable'
import { cardsOf } from '@/purchases/purchase-board'
import { Section } from './GallerySection'
import { boardSettlement, REQUESTS } from '@/test-support/purchase-board-fixtures'

const noop = () => {}

export function PurchasesSection() {
  const [area, setArea] = useState<PurchaseArea>('review')
  const cards = cardsOf(REQUESTS)
  return (
    <Section title="구매 칸반·처리 단계·요청 표">
      <div className="flex w-full min-w-0 flex-col gap-8">
        <PurchaseBudgetSummary settlement={boardSettlement.settlement} />
        <PurchaseItemBoard cards={cards} showEvent onOpen={noop} />
        <PurchaseProcessBoard cards={cards} area={area} onArea={setArea} onOpen={noop} />
        <PurchaseRequestTable requests={REQUESTS} variant="records" onOpen={noop} />
        <MyPurchaseRequests
          list={{
            state: {
              kind: 'ready',
              requests: REQUESTS.filter(row => row.requestedBy.name === '박해랑'),
              truncated: false,
            },
            reload: async () => {},
          }}
          who="박해랑 · 운영부"
          onBack={noop}
          onCreate={noop}
          onOpen={noop}
        />
      </div>
    </Section>
  )
}
