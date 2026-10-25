import { useState, type ReactNode } from 'react'
import { WON_MAX, type BudgetItemView } from '@vada/contracts'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { Textarea } from '@/components/ui/textarea'
import { BudgetItemList } from '@/finance/BudgetItemList'
import { BudgetOverConfirm } from '@/finance/BudgetOverConfirm'
import { BudgetRows, BudgetRowsTotal } from '@/finance/BudgetRows'
import { blankRow, type BudgetRow } from '@/finance/budget-rows'
import { Section } from './GallerySection'
import { longName } from './sample-text'

type Spend = { amount: number; actual: number; committed: number }

const spend = (id: string, purpose: string, money: Spend): BudgetItemView => ({
  id,
  purpose,
  type: 'expense',
  event: null,
  selectable: true,
  deletable: true,
  history: [],
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
    deletable: false,
    history: [],
    amount: 100000,
    actual: 40000,
    committed: null,
    available: null,
  },
]

const menuStub = (item: BudgetItemView) => (
  <Button variant="ghost" size="icon" aria-label={`${item.purpose} 더 보기`}>
    ⋯
  </Button>
)

// 예산 탭과 행사 '예산·정산'의 항목 칸(024 조각 5, 와이어프레임 EVT-FIN-01B '예산 항목별 현황'). 휴대폰 폭(390px)과 재정 화면 폭으로 본다.
// 예산 탭은 칸마다 '⋯' 메뉴(고치기·항목 지우기·이력 보기, 024 조각 6)가 이름 줄 오른쪽에 있다.
export function BudgetItemLineSection() {
  return (
    <Section title="예산 항목 칸: 지출 예정과 사용 가능">
      {['w-97.5 max-w-full', 'w-full'].map(width => (
        <div key={width} className={width}>
          {width === 'w-full' ? (
            <BudgetItemList items={items} actions={menuStub} />
          ) : (
            <BudgetItemList items={items} />
          )}
        </div>
      ))}
    </Section>
  )
}

// 실제 창의 폭: 1280px 창에서 예산 편성 창은 넓은 창(640px), 고치기 창은 보통 창(512px)이고, 390px 창에서는 양옆 16px를 뺀 358px다.
const WIDTHS = [
  { label: '1280px 창', wide: 'w-160', normal: 'w-128' },
  { label: '390px 창', wide: 'w-89.5', normal: 'w-89.5' },
] as const

// 대화상자의 모양(dialog.tsx DialogContent와 같은 테두리·여백·간격)을 제자리에 그린다. 실제 창은 화면 가운데에 하나만 뜨기 때문이다.
function DialogFrame({
  title,
  width,
  children,
}: {
  title: string
  width: string
  children: ReactNode
}) {
  return (
    <div
      className={`@container flex ${width} max-w-full flex-col gap-6 rounded-lg border bg-white p-6 shadow-2xl`}
    >
      <h3 className="text-base font-semibold text-gray-900">{title}</h3>
      {children}
    </div>
  )
}

function Footer({ summary, submit }: { summary?: ReactNode; submit: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      {summary}
      <div className="ml-auto flex flex-wrap justify-end gap-2">
        <Button variant="outline">닫기</Button>
        <Button>{submit}</Button>
      </div>
    </div>
  )
}

const filled = (purpose: string, amount: string): BudgetRow => ({ ...blankRow(purpose), amount })

// 행사 예산 기본 행 셋에 금액을 넣은 모습과, 0원·빈 이름·같은 이름을 행 아래에 짚은 모습
const SAMPLES = {
  event: [
    filled('행사 운영비', '1,500,000'),
    filled('홍보비', '800,000'),
    filled('식비', '700,000'),
  ],
  errors: [
    filled('간식', '0'),
    filled('', '1000'),
    filled('행사 홍보', '20000'),
    filled(longName, '5000'),
  ],
}
const ERRORS = {
  'rows.0.amount': '0원보다 큰 금액을 입력해 주세요',
  'rows.1.purpose': '항목 이름을 입력해 주세요',
  'rows.2.purpose': '같은 이름의 항목이 있어요',
}

function PlanFrame({
  width,
  rows,
  errors,
}: {
  width: string
  rows: BudgetRow[]
  errors: Record<string, string>
}) {
  const [current, setCurrent] = useState(rows)
  return (
    <DialogFrame title="행사 예산 편성" width={width}>
      <div className="grid gap-4 @md:grid-cols-2">
        <Field label="종류" required>
          <NativeSelect defaultValue="expense">
            <option value="expense">지출</option>
            <option value="income">수입</option>
          </NativeSelect>
        </Field>
        <Field label="행사" optional>
          <NativeSelect defaultValue="spring">
            <option value="">행사 없음</option>
            <option value="spring">봄 축제</option>
          </NativeSelect>
        </Field>
      </div>
      <BudgetRows rows={current} errors={errors} saving={false} onChange={setCurrent} />
      <Footer submit="저장" summary={<BudgetRowsTotal rows={current} income={false} />} />
    </DialogFrame>
  )
}

function EditFrame({ width }: { width: string }) {
  return (
    <DialogFrame title="예산 항목 고치기" width={width}>
      <Field label="이름" required>
        <Input defaultValue="행사 홍보" />
      </Field>
      <Field label="금액(원)" required>
        <Input inputMode="numeric" defaultValue="250,000" />
      </Field>
      <Field label="사유" required error="사유를 입력해 주세요">
        <Textarea />
      </Field>
      <Footer submit="저장" />
    </DialogFrame>
  )
}

// 예산 편성 창(024 조각 6, 와이어프레임 EVT-FIN-01B '행사 예산 편성')과 항목 고치기 창을 실제 폭으로 본다.
// 줄여서 사용 가능이 음수가 될 때의 확인 창은 버튼으로 연다(실제처럼 화면 가운데에 뜬다).
export function BudgetPlanSection() {
  const [confirming, setConfirming] = useState(false)
  return (
    <Section title="예산 편성·항목 고치기 창">
      {WIDTHS.map(({ label, wide, normal }) => (
        <div key={label} className="flex flex-col gap-3">
          <p className="text-xs text-gray-500">{label}</p>
          <PlanFrame width={wide} rows={SAMPLES.event} errors={{}} />
          <PlanFrame width={wide} rows={SAMPLES.errors} errors={ERRORS} />
          <EditFrame width={normal} />
        </div>
      ))}
      <Button variant="outline" onClick={() => setConfirming(true)}>
        사용 가능 초과 확인 창 열기
      </Button>
      <BudgetOverConfirm
        open={confirming}
        purpose="행사 홍보"
        available={-50000}
        confirmLabel="그래도 저장"
        busy={false}
        error={null}
        onConfirm={() => setConfirming(false)}
        onClose={() => setConfirming(false)}
      />
    </Section>
  )
}
