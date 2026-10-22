import { useState } from 'react'
import { CreateBudgetItemSchema } from '@vada/contracts'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import { budgetItemOf, emptyBudgetItem, type BudgetItemValues } from './budget-form'
import { BudgetFormDialog } from './BudgetFormDialog'
import { EventField } from './EventField'
import { budgetItemsPath } from './finance-api'
import { useBudgetChange, type BudgetChangeHandlers } from './useBudgetChange'

type Props = BudgetChangeHandlers & {
  councilId: string
  // 행사 화면에서 열면 그 행사로 채운다.
  eventId?: string | null
  onClose: () => void
}

type FieldsProps = {
  councilId: string
  values: BudgetItemValues
  saving: boolean
  onChange: (patch: Partial<BudgetItemValues>) => void
  onForbidden: () => void
}

// 목적, 금액, 종류(지출이 기본), 행사(선택).
function BudgetItemFields({ councilId, values, saving, onChange, onForbidden }: FieldsProps) {
  return (
    <>
      <Label className="flex flex-col gap-2">
        목적
        <Input
          value={values.purpose}
          disabled={saving}
          onChange={event => onChange({ purpose: event.target.value })}
        />
      </Label>
      <Label className="flex flex-col gap-2">
        금액(원)
        <Input
          inputMode="numeric"
          value={values.amount}
          disabled={saving}
          onChange={event => onChange({ amount: event.target.value })}
        />
      </Label>
      <Label className="flex flex-col gap-2">
        종류
        <NativeSelect
          value={values.type}
          disabled={saving}
          onChange={event =>
            onChange({ type: event.target.value === 'income' ? 'income' : 'expense' })
          }
        >
          <option value="expense">지출</option>
          <option value="income">수입</option>
        </NativeSelect>
      </Label>
      <EventField
        councilId={councilId}
        value={values.eventId}
        disabled={saving}
        onChange={eventId => onChange({ eventId })}
        onForbidden={onForbidden}
      />
    </>
  )
}

// 예산 항목 더하기. 종류와 행사는 더한 뒤에 바꾸지 않는다.
export function BudgetItemDialog({ councilId, eventId, onClose, ...handlers }: Props) {
  const [values, setValues] = useState(() => emptyBudgetItem(eventId ?? null))
  const [saving, setSaving] = useState(false)
  const change = useBudgetChange(
    budgetItemsPath(councilId),
    budgetItemOf(values),
    CreateBudgetItemSchema,
    { ...handlers, setSaving },
  )
  return (
    <BudgetFormDialog
      title="예산 항목 더하기"
      description="지금 회계 기간의 예산 항목이에요. 지출 항목은 구매 요청을 결재할 때 이 목록에서 골라요. 종류와 행사는 더한 뒤에 바꿀 수 없어요."
      submitLabel="더하기"
      saving={saving}
      valid={change.valid}
      problem={change.problem}
      onSubmit={() => void change.submit()}
      onClose={onClose}
    >
      <BudgetItemFields
        councilId={councilId}
        values={values}
        saving={saving}
        onChange={patch => setValues({ ...values, ...patch })}
        onForbidden={handlers.onForbidden}
      />
    </BudgetFormDialog>
  )
}
