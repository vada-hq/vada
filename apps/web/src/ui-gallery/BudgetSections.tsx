import { WON_MAX, type BudgetItemView } from '@vada/contracts'
import { BudgetItemList } from '@/finance/BudgetItemList'
import { Section } from './GallerySection'
import { longName } from './sample-text'

type Spend = { amount: number; actual: number; committed: number }

const spend = (id: string, purpose: string, money: Spend): BudgetItemView => ({
  id,
  purpose,
  type: 'expense',
  event: null,
  selectable: true,
  ...money,
  available: money.amount - money.actual - money.committed,
})

// 넉넉함, 넘게 승인함(빨강), 0원 항목, 큰 금액, 긴 이름과 행사, 수입 항목
const items: BudgetItemView[] = [
  spend('a', '행사 홍보', { amount: 300000, actual: 120000, committed: 30000 }),
  spend('b', '간식', { amount: 50000, actual: 20000, committed: 40000 }),
  spend('c', '예비비', { amount: 0, actual: 0, committed: 30000 }),
  spend('d', '축제 무대', { amount: WON_MAX, actual: 400_000_000, committed: 350_000_000 }),
  {
    ...spend('e', longName, { amount: 80000, actual: 0, committed: 0 }),
    event: { id: 'ev', name: longName },
  },
  {
    id: 'f',
    purpose: '후원',
    type: 'income',
    event: null,
    selectable: true,
    amount: 100000,
    actual: 40000,
    committed: null,
    available: null,
  },
]

// 예산 탭과 행사 '예산·정산'의 항목 칸(024 조각 5, 와이어프레임 EVT-FIN-01B '예산 항목별 현황'). 휴대폰 폭(390px)과 재정 화면 폭으로 본다.
export function BudgetItemLineSection() {
  return (
    <Section title="예산 항목 칸: 지출 예정과 사용 가능">
      {['w-97.5 max-w-full', 'w-full'].map(width => (
        <div key={width} className={width}>
          <BudgetItemList items={items} />
        </div>
      ))}
    </Section>
  )
}
