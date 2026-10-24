import { useState } from 'react'
import { CreateBudgetItemSchema } from '@vada/contracts'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { requiredText, useFormCheck, withContract, type FieldErrors } from '@/lib/use-form-check'
import { budgetItemOf, emptyBudgetItem, wonOf, type BudgetItemValues } from './budget-form'
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
  errors: FieldErrors
}

// 목적과 금액은 필수다. 금액은 0 이상의 정수(계약과 같은 규칙)이고, 보낼 때처럼 쉼표는 받는다.
const budgetItemErrors = (values: BudgetItemValues) => ({
  purpose: requiredText(values.purpose, '목적을'),
  amount:
    requiredText(values.amount, '금액을') ??
    (Number.isNaN(wonOf(values.amount)) ? '숫자만 입력해 주세요' : undefined),
})

// 목적, 금액, 종류(지출이 기본), 행사(선택).
function BudgetItemFields(props: FieldsProps) {
  const { councilId, values, saving, onChange, onForbidden, errors } = props
  return (
    <>
      <Field label="목적" required error={errors.purpose}>
        <Input
          value={values.purpose}
          disabled={saving}
          onChange={event => onChange({ purpose: event.target.value })}
        />
      </Field>
      <Field label="금액(원)" required error={errors.amount}>
        <Input
          inputMode="numeric"
          value={values.amount}
          disabled={saving}
          onChange={event => onChange({ amount: event.target.value })}
        />
      </Field>
      <Field label="종류" required>
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
      </Field>
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
  const {
    formRef,
    errors: fieldErrors,
    attempt,
  } = useFormCheck(() => withContract(budgetItemErrors(values), change.parsed))
  return (
    <BudgetFormDialog
      title="예산 항목 더하기"
      submitLabel="더하기"
      saving={saving}
      formRef={formRef}
      attempt={attempt}
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
        errors={fieldErrors}
      />
    </BudgetFormDialog>
  )
}
