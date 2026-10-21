import type { BudgetItemView, PurchaseLineItem } from '@vada/contracts'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import { Textarea } from '@/components/ui/textarea'
import type { RowValues } from './decision-form'

type Props = {
  item: PurchaseLineItem
  values: RowValues
  // 화면에 보일 예산 항목(고르지 않았으면 마지막에 승인한 항목, 목록에 없으면 빈 값)
  chosen: string
  budgetItems: readonly BudgetItemView[]
  disabled: boolean
  canApprove: boolean
  canReject: boolean
  onChange: (patch: Partial<RowValues>) => void
  onApprove: () => void
  onReject: () => void
}

function Fields({
  item,
  values,
  chosen,
  budgetItems,
  disabled,
  onChange,
}: Pick<Props, 'item' | 'values' | 'chosen' | 'budgetItems' | 'disabled' | 'onChange'>) {
  return (
    <>
      <Label className="flex flex-col gap-2">
        금액(합계, 원)
        <Input
          inputMode="numeric"
          aria-label={`${item.name} 금액`}
          disabled={disabled}
          value={values.amount}
          onChange={event => onChange({ amount: event.target.value })}
        />
      </Label>
      <Label className="flex flex-col gap-2">
        예산 항목
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
      </Label>
      {values.rejecting && (
        <Label className="flex flex-col gap-2">
          반려 사유
          <Textarea
            aria-label={`${item.name} 반려 사유`}
            disabled={disabled}
            value={values.reason}
            onChange={event => onChange({ reason: event.target.value })}
          />
        </Label>
      )}
    </>
  )
}

function Buttons({
  item,
  values,
  disabled,
  canApprove,
  canReject,
  onChange,
  onApprove,
  onReject,
}: Omit<Props, 'chosen' | 'budgetItems'>) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        size="sm"
        disabled={disabled || !canApprove}
        aria-label={`${item.name} 승인`}
        onClick={onApprove}
      >
        승인
      </Button>
      {values.rejecting ? (
        <Button
          size="sm"
          variant="destructive"
          disabled={disabled || !canReject}
          aria-label={`${item.name} 반려 보내기`}
          onClick={onReject}
        >
          반려 보내기
        </Button>
      ) : (
        <Button
          size="sm"
          variant="outline"
          disabled={disabled}
          aria-label={`${item.name} 반려`}
          onClick={() => onChange({ rejecting: true })}
        >
          반려
        </Button>
      )}
    </div>
  )
}

// 결재 줄 하나: 금액(그 줄 합계), 예산 항목, [승인], [반려](사유 칸이 열린다).
// 버튼은 계약의 safeParse 결과(canApprove, canReject)로 켠다. 길이 숫자를 여기에 적지 않는다.
export function DecisionRow(props: Props) {
  const { item } = props
  return (
    <Card role="group" aria-label={`결재 ${item.name}`} className="flex flex-col gap-3 p-3">
      <span className="text-sm font-medium wrap-anywhere text-gray-900">
        {item.name} × {item.quantity}
      </span>
      <Fields {...props} />
      <Buttons {...props} />
    </Card>
  )
}
