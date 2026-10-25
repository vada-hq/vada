import type { TeamResponse } from '@vada/contracts'
import { Field } from '@/components/ui/field'
import { Textarea } from '@/components/ui/textarea'
import type { FieldErrors } from '@/lib/use-form-check'
import { ChoiceSelect } from '@/tasks/ChoiceSelect'
import type { ExpenseValues } from './expense-form'

// 먼저 낸 사람: 학생회 돈, 나, 다른 운영진.
function paidByChoices(team: TeamResponse, memberId: string) {
  return [
    { id: null, label: '학생회 돈' },
    { id: memberId, label: '나' },
    ...team.members.filter(m => m.id !== memberId).map(m => ({ id: m.id, label: m.name })),
  ]
}

// 먼저 낸 사람(학생회 돈, 나, 다른 운영진)과 사유(아래쪽 칸).
export function ExpensePayerFields({
  team,
  memberId,
  values,
  disabled,
  onChange,
  errors,
}: {
  values: ExpenseValues
  disabled: boolean
  onChange: (values: ExpenseValues) => void
  errors: FieldErrors
  team: TeamResponse
  memberId: string
}) {
  return (
    <>
      <ChoiceSelect
        label="먼저 낸 사람"
        required
        choices={paidByChoices(team, memberId)}
        value={values.paidBy}
        disabled={disabled}
        onChange={paidBy => onChange({ ...values, paidBy })}
      />
      <Field label="사유" optional error={errors.reason}>
        <Textarea
          value={values.reason}
          disabled={disabled}
          onChange={event => onChange({ ...values, reason: event.target.value })}
        />
      </Field>
    </>
  )
}
