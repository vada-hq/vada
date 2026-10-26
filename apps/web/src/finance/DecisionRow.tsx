import { purchaseEstimateOf, type BudgetItemView, type PurchaseLineItem } from '@vada/contracts'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Field } from '@/components/ui/field'
import { NativeSelect } from '@/components/ui/native-select'
import { cn } from '@/lib/utils'
import type { FieldErrors } from '@/lib/use-form-check'
import { usageLineOf, type Overage } from './decision-budget'
import type { Choice, RowValues } from './decision-form'
import { ItemLink } from './RequestItems'

type Props = {
  item: PurchaseLineItem
  values: RowValues
  // 화면에 보일 예산 항목(고르지 않았으면 마지막에 승인한 항목, 목록에 없으면 빈 값)
  chosen: string
  budgetItems: readonly BudgetItemView[]
  // 이번에 고른 승인 전체로 사용 가능을 넘는 항목
  overages: readonly Overage[]
  disabled: boolean
  // 누를 때 확인한 문제(choice, amount, budgetItemId, reason)
  errors: FieldErrors
  onChange: (patch: Partial<RowValues>) => void
}

// 예산 항목 칸 아래 줄: 사용 가능(예산 탭과 같은 값)과, 이번 승인으로 넘으면 승인한 뒤의 사용 가능(빨강).
// 같은 항목을 여러 줄이 쓰면 줄마다 같은 값(그 항목의 승인 합 기준)이라, 확인 창과 같은 말 '승인하면'으로 부른다.
function UsageLine({ item, overages }: { item: BudgetItemView; overages: readonly Overage[] }) {
  const line = usageLineOf(item, overages)
  return (
    <p className="text-xs text-gray-500 tabular-nums">
      사용 가능 <span className="font-medium text-blue-700">{line.available}</span>
      {line.after && (
        <>
          {' · '}
          <span className="font-medium text-red-600">승인하면 {line.after}</span>
        </>
      )}
    </p>
  )
}

// 금액과 예산 항목. 금액은 13자면 되어 좁게, 예산 항목 이름에 폭을 더 준다(행사 이름이 앞에 붙어 길다).
function BudgetFields({
  item,
  values,
  chosen,
  budgetItems,
  overages,
  disabled,
  errors,
  onChange,
}: Props) {
  const picked = budgetItems.find(budgetItem => budgetItem.id === chosen)
  const shippingHint =
    purchaseEstimateOf(item).subtotal !== null && item.estimatedShippingFee == null
      ? { hint: '배송비 미확인 · 상품 합계만 채웠어요. 승인 전 확인해 주세요.' }
      : {}
  return (
    <div className="grid gap-3 @sm:grid-cols-3">
      <Field label="금액(합계, 원)" required error={errors.amount} {...shippingHint}>
        <Input
          inputMode="numeric"
          aria-label={`${item.name} 금액`}
          className="text-right tabular-nums"
          disabled={disabled}
          value={values.amount}
          onChange={event => onChange({ amount: event.target.value })}
        />
      </Field>
      <div className="flex flex-col gap-1.5 @sm:col-span-2">
        <Field label="예산 항목" required error={errors.budgetItemId}>
          <NativeSelect
            aria-label={`${item.name} 예산 항목`}
            disabled={disabled}
            value={chosen}
            onChange={event => onChange({ budgetItemId: event.target.value })}
          >
            <option value="">항목 고르기</option>
            {budgetItems.map(budgetItem => (
              <option key={budgetItem.id} value={budgetItem.id}>
                {budgetItem.purpose}
              </option>
            ))}
          </NativeSelect>
        </Field>
        {picked && <UsageLine item={picked} overages={overages} />}
      </div>
    </div>
  )
}

const CHOICES = [
  { value: 'approve', label: '승인', on: 'bg-green-600 text-white hover:bg-green-700' },
  { value: 'reject', label: '반려', on: 'bg-destructive text-white hover:bg-red-700' },
] as const

// 검토 결과: 승인·반려 중 하나를 고른다(와이어프레임 FIN-REV-01의 버튼 묶음). 보내기는 아래 버튼 하나다.
// 휴대폰에서 줄마다 누르는 주된 동작이라 640px 미만에서 44px로 키운다(touch).
function ChoiceField({
  item,
  choice,
  disabled,
  error,
  onChoose,
}: {
  item: PurchaseLineItem
  choice: Choice
  disabled: boolean
  error: string | undefined
  onChoose: (choice: Choice) => void
}) {
  return (
    <Field label="검토 결과" required error={error}>
      <div
        role="radiogroup"
        aria-label={`${item.name} 검토 결과`}
        tabIndex={-1}
        className="flex gap-2 outline-none"
      >
        {CHOICES.map(option => (
          <Button
            key={option.value}
            size="sm"
            touch
            variant="outline"
            role="radio"
            aria-checked={choice === option.value}
            aria-label={`${item.name} ${option.label}`}
            busy={disabled}
            className={cn('min-w-16', choice === option.value && `border-transparent ${option.on}`)}
            onClick={() => onChoose(option.value)}
          >
            {option.label}
          </Button>
        ))}
      </div>
    </Field>
  )
}

// 카드 머리: 이름과 수량(품목 목록과 같은 '× 3'), 아래 줄에 옵션과 링크(가격 근거). 와이어프레임 FIN-REV-01의 구매 정보 자리다.
function RowHead({ item }: { item: PurchaseLineItem }) {
  return (
    <div className="flex flex-col gap-1 rounded-t-lg border-b bg-gray-50 px-4 py-3">
      <span className="text-sm font-semibold wrap-anywhere text-gray-900">
        {item.name} × {item.quantity}
      </span>
      {(item.options || item.link) && (
        <div className="flex flex-col gap-1 text-xs text-gray-500">
          {item.options && <span className="wrap-anywhere">{item.options}</span>}
          {item.link && <ItemLink href={item.link} />}
        </div>
      )}
    </div>
  )
}

// 결재할 수 없는 동안(예산을 읽는 중, 예산 없음) 대기 품목을 머리만으로 보인다. 품목 목록에서 빠져 있어서다.
export function PendingItemCard({ item }: { item: PurchaseLineItem }) {
  return (
    <Card className="flex flex-col">
      <RowHead item={item} />
    </Card>
  )
}

// 결재 줄 하나: 머리(이름, 수량, 옵션, 링크), 금액(그 줄 합계)·예산 항목과 사용 가능, 검토 결과, 반려면 사유.
// 반려를 고르면 쓰이지 않는 금액·예산 항목 칸을 숨긴다(점진 공개). 값은 남아 승인으로 바꾸면 돌아온다.
// 버튼은 끄지 않는다. 누를 때 확인한 문제는 칸 아래에 보인다(errors). 칸 배치는 창 폭이 아니라 카드 폭(@container)을 본다.
export function DecisionRow(props: Props) {
  const { item, values, disabled, errors, onChange } = props
  return (
    <Card role="group" aria-label={`결재 ${item.name}`} className="flex flex-col">
      <RowHead item={item} />
      <div className="@container flex flex-col gap-4 px-4 py-3">
        {values.choice !== 'reject' && <BudgetFields {...props} />}
        <div className={cn('flex flex-col gap-2', values.choice !== 'reject' && 'border-t pt-3')}>
          <ChoiceField
            item={item}
            choice={values.choice}
            disabled={disabled}
            error={errors.choice}
            onChoose={choice => onChange({ choice })}
          />
          {values.choice === 'reject' && (
            <Field label="반려 사유" required error={errors.reason}>
              <Input
                aria-label={`${item.name} 반려 사유`}
                disabled={disabled}
                value={values.reason}
                onChange={event => onChange({ reason: event.target.value })}
              />
            </Field>
          )}
        </div>
      </div>
    </Card>
  )
}
