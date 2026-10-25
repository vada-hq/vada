import { WON_MAX, type BudgetItemView } from '@vada/contracts'
import { Card } from '@/components/ui/card'
import { BudgetItemLine } from '@/finance/BudgetItemLine'
import { Section } from './GallerySection'
import { longName } from './sample-text'

const item = (
  id: string,
  extra: Partial<BudgetItemView> & Pick<BudgetItemView, 'amount' | 'actual'>,
): BudgetItemView => ({
  id,
  purpose: '행사 홍보',
  type: 'expense',
  event: null,
  selectable: true,
  committed: 0,
  available: extra.amount - extra.actual,
  ...extra,
})

// 넉넉함, 넘게 승인함(빨강), 0원 항목, 큰 금액, 긴 이름과 행사, 수입 항목
const items: BudgetItemView[] = [
  item('a', { amount: 300000, actual: 120000, committed: 30000, available: 150000 }),
  item('b', { purpose: '간식', amount: 50000, actual: 20000, committed: 40000, available: -10000 }),
  item('c', { purpose: '예비비', amount: 0, actual: 0, committed: 30000, available: -30000 }),
  item('d', {
    purpose: '축제 무대',
    amount: WON_MAX,
    actual: 400_000_000,
    committed: 350_000_000,
    available: 250_000_000,
  }),
  item('e', {
    purpose: longName,
    amount: 80000,
    actual: 0,
    event: { id: 'ev', name: longName },
  }),
  item('f', {
    purpose: '후원',
    type: 'income',
    amount: 100000,
    actual: 40000,
    committed: null,
    available: null,
  }),
]

// 예산 탭과 행사 '예산·정산'의 항목 줄(024 조각 5, 와이어프레임 FIN-00 재정 데이터 목록). 휴대폰 폭(390px)과 재정 화면 폭으로 본다.
export function BudgetItemLineSection() {
  return (
    <Section title="예산 항목 줄: 지출 예정과 사용 가능">
      {['w-97.5 max-w-full', 'w-full'].map(width => (
        <ul key={width} className={`flex flex-col gap-2 ${width}`}>
          {items.map(entry => (
            <li key={entry.id}>
              <Card className="p-3">
                <BudgetItemLine item={entry} eventName={entry.event?.name ?? null} />
              </Card>
            </li>
          ))}
        </ul>
      ))}
    </Section>
  )
}
