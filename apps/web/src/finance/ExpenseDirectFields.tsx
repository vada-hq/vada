import { useEffect } from 'react'
import { statusOf, type BudgetResponse, type TeamResponse } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import type { FieldErrors } from '@/lib/use-form-check'
import { EXPENSE_OPTIONS_FAILED } from '@/lib/messages'
import { usePolledRead } from '@/lib/use-polled-read'
import { ChoiceSelect } from '@/tasks/ChoiceSelect'
import { expenseItems, itemsForEvent } from './budget-form'
import { budgetPath } from './finance-api'
import type { ExpenseValues } from './expense-form'
import { wonLabel } from './purchase-view'

type Props = {
  councilId: string
  team: TeamResponse
  values: ExpenseValues
  disabled: boolean
  onChange: (values: ExpenseValues) => void
  onForbidden: () => void
  errors: FieldErrors
}

// 예산 항목 고르기. 지금 회계 기간의 지출 항목이고, 고르지 않을 수도 있다. 기간이 아직 없으면 고를 항목이 없다.
function BudgetSelect({
  councilId,
  values,
  disabled,
  onChange,
  onForbidden,
}: Omit<Props, 'team' | 'errors'>) {
  const budget = usePolledRead<BudgetResponse>(budgetPath(councilId), status => {
    if (status === statusOf('FORBIDDEN')) onForbidden()
  })
  // 고른 행사가 있으면 그 행사와 맞는 항목만 보인다(서버의 직접 지출과 같은 술어).
  const items =
    budget.state.kind === 'ready'
      ? itemsForEvent(expenseItems(budget.state.data.items), values.eventId)
      : []
  const loaded = budget.state.kind === 'ready'
  const gone =
    loaded && values.budgetItemId !== null && !items.some(i => i.id === values.budgetItemId)
  // 다시 읽은 목록에서 고른 항목이 사라졌으면(기간이 바뀜) 값을 비워 몰래 나가지 않게 한다.
  useEffect(() => {
    if (gone) onChange({ ...values, budgetItemId: null })
  }, [gone, values, onChange])
  if (budget.state.kind === 'failed')
    return <StateMessage kind="error">{EXPENSE_OPTIONS_FAILED}</StateMessage>
  return (
    <ChoiceSelect
      label="예산 항목"
      optional
      choices={[
        { id: null, label: '고르지 않음' },
        ...items.map(item => ({
          id: item.id,
          label: `${item.purpose} (${wonLabel(item.amount)})`,
        })),
      ]}
      value={values.budgetItemId}
      disabled={disabled}
      onChange={budgetItemId => onChange({ ...values, budgetItemId })}
    />
  )
}

// 요청 없이 적는 지출: 금액, 예산 항목, 부탁한 사람(요청 없는 지출만 고른다).
export function ExpenseDirectFields({ team, errors, ...props }: Props) {
  const { values, disabled, onChange } = props
  return (
    <>
      <Field label="금액(원)" required error={errors.amount}>
        <Input
          inputMode="numeric"
          value={values.amount}
          disabled={disabled}
          onChange={event => onChange({ ...values, amount: event.target.value })}
        />
      </Field>
      <BudgetSelect {...props} />
      <ChoiceSelect
        label="부탁한 사람"
        optional
        choices={[
          { id: null, label: '없음' },
          ...team.members.map(member => ({ id: member.id, label: member.name })),
        ]}
        value={values.requestedBy}
        disabled={disabled}
        onChange={requestedBy => onChange({ ...values, requestedBy })}
      />
    </>
  )
}
