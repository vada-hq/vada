import type { FinanceOverview } from '@vada/contracts'
import { OverviewView, type OverviewOpeners } from '@/finance/OverviewTab'
import { NoPeriod } from '@/finance/NoPeriod'
import { useSplit } from '@/lib/use-split'
import { Section } from './GallerySection'
import { longName } from './sample-text'

const COUNCIL_ID = '00000000-0000-4000-8000-0000000000c1'
const noop = () => {}
const openers: OverviewOpeners = {
  onBudget: noop,
  budgetLabel: '편성',
  onSpent: noop,
  onCommitted: noop,
  onEvent: noop,
  onExpense: noop,
}

const event = (id: string, name: string) => ({ id, name })

// 와이어프레임 FIN-00의 숫자 그대로(체육대회 54%, 신입생 환영 행사 67%, 가을 축제 0%)에 긴 이름과 넘게 쓴 행사를 더했다.
const overview: FinanceOverview = {
  period: { id: 'p1', name: '2026년 1학기', startsOn: '2026-01-01', endsOn: '2026-06-30' },
  total: 30_000_000,
  sources: ['학생회비', '단과대학 지원비'],
  actual: 12_400_000,
  committed: 3_100_000,
  available: 14_500_000,
  paidCount: 9,
  committedCount: 3,
  events: [
    {
      event: event('e1', '체육대회'),
      amount: 5_000_000,
      actual: 2_100_000,
      committed: 600_000,
      available: 2_300_000,
    },
    {
      event: event('e2', '신입생 환영 행사'),
      amount: 3_000_000,
      actual: 1_800_000,
      committed: 200_000,
      available: 1_000_000,
    },
    {
      event: event('e3', '가을 축제'),
      amount: 8_000_000,
      actual: 0,
      committed: 0,
      available: 8_000_000,
    },
    {
      event: event('e4', longName),
      amount: 300_000,
      actual: 336_000,
      committed: 24_000,
      available: -60_000,
    },
  ],
  items: [
    {
      id: 'b1',
      type: 'expense',
      purpose: '식비',
      amount: 5_000_000,
      actual: 2_100_000,
      committed: 600_000,
      available: 2_300_000,
      event: event('e1', '체육대회'),
    },
    {
      id: 'b2',
      type: 'expense',
      purpose: '간식',
      amount: 300_000,
      actual: 336_000,
      committed: 24_000,
      available: -60_000,
      event: event('e4', longName),
    },
  ],
  noItem: 75_000,
  recent: [
    {
      id: 'x1',
      paidOn: '2026-06-17',
      description: '현수막 제작',
      vendor: '인쇄소',
      amount: 180_000,
      event: event('e1', '체육대회'),
    },
    {
      id: 'x2',
      paidOn: '2026-06-16',
      description: '생수 구매',
      vendor: '편의점',
      amount: 120_000,
      event: event('e1', '체육대회'),
    },
    {
      id: 'x3',
      paidOn: '2026-06-15',
      description: longName,
      vendor: '문구점',
      amount: 75_000,
      event: null,
    },
  ],
}

const empty: FinanceOverview = {
  ...overview,
  total: 0,
  sources: [],
  actual: 0,
  committed: 0,
  available: 0,
  paidCount: 0,
  committedCount: 0,
  events: [],
  items: [],
  noItem: 0,
  recent: [],
}

// 재정 첫 화면(개요): 카드 넷, 두 겹 집행률, 행사별(넓으면 표, 좁으면 카드 줄), 최근 지출, 예산 항목별 현황.
// 실제 탭과 같은 조건(lg)으로 표와 카드 줄을 가른다. 아래는 사용 가능이 음수인 카드와 예산이 빈 기간이다.
export function OverviewSection() {
  const wide = useSplit()
  return (
    <Section title="재정 개요 탭">
      <div className="flex w-full flex-col gap-6">
        <OverviewView overview={overview} wide={wide} openers={openers} />
        <OverviewView
          overview={{
            ...empty,
            total: 100_000,
            sources: ['학생회비'],
            actual: 130_000,
            available: -30_000,
            paidCount: 1,
          }}
          wide={wide}
          openers={{ ...openers, budgetLabel: '내역' }}
        />
        <OverviewView overview={empty} wide={wide} openers={openers} />
        <NoPeriod councilId={COUNCIL_ID} canManage />
        <NoPeriod councilId={COUNCIL_ID} canManage={false} />
      </div>
    </Section>
  )
}
