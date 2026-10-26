import type { BudgetItemView, PurchaseLineItem } from '@vada/contracts'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Field } from '@/components/ui/field'
import { NativeSelect } from '@/components/ui/native-select'
import { cn } from '@/lib/utils'
import type { FieldErrors } from '@/lib/use-form-check'
import { usageLineOf, type Overage } from './decision-budget'
import type { Choice, RowValues } from './decision-form'

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

// 예산 항목 칸 아래 줄: 사용 가능(예산 탭과 같은 값)과, 이번 승인 뒤 넘으면 초과액(빨강).
function UsageLine({ item, overages }: { item: BudgetItemView; overages: readonly Overage[] }) {
  const line = usageLineOf(item, overages)
  return (
    <p className="text-xs text-gray-500 tabular-nums">
      사용 가능 <span className="font-medium text-blue-700">{line.available}</span>
      {line.over && (
        <>
          {' · '}
          <span className="font-medium text-red-600">초과 {line.over}</span>
        </>
      )}
    </p>
  )
}

function BudgetFields({
  item,
  values,
  chosen,
  budgetItems,
  overages,
  disabled,
  errors,
  onChange,
}: Omit<Props, 'item'> & { item: PurchaseLineItem }) {
  const picked = budgetItems.find(budgetItem => budgetItem.id === chosen)
  return (
    <div className="grid gap-3 @sm:grid-cols-2">
      <Field label="금액(합계, 원)" required error={errors.amount}>
        <Input
          inputMode="numeric"
          aria-label={`${item.name} 금액`}
          disabled={disabled}
          value={values.amount}
          onChange={event => onChange({ amount: event.target.value })}
        />
      </Field>
      <div className="flex flex-col gap-1.5">
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
            variant="outline"
            role="radio"
            aria-checked={choice === option.value}
            aria-label={`${item.name} ${option.label}`}
            busy={disabled}
            className={cn(choice === option.value && `border-transparent ${option.on}`)}
            onClick={() => onChoose(option.value)}
          >
            {option.label}
          </Button>
        ))}
      </div>
    </Field>
  )
}

// 결재 줄 하나: 머리(이름, 수량), 금액(그 줄 합계)·예산 항목과 사용 가능, 검토 결과, 반려면 사유.
// 버튼은 끄지 않는다. 누를 때 확인한 문제는 칸 아래에 보인다(errors).
export function DecisionRow(props: Props) {
  const { item, values, disabled, errors, onChange } = props
  return (
    <Card role="group" aria-label={`결재 ${item.name}`} className="flex flex-col">
      <div className="flex items-baseline justify-between gap-3 rounded-t-lg border-b bg-gray-50 px-4 py-3">
        <span className="text-sm font-semibold wrap-anywhere text-gray-900">{item.name}</span>
        <span className="shrink-0 text-xs text-gray-500">{item.quantity}개</span>
      </div>
      <div className="@container flex flex-col gap-4 px-4 py-3">
        <BudgetFields {...props} />
        <div className="flex flex-col gap-2 border-t pt-3">
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
