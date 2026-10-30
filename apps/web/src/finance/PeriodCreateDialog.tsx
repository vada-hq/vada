import { useState } from 'react'
import { CreateFiscalPeriodSchema, koreanDateOf, semesterOf } from '@vada/contracts'
import { Field } from '@/components/ui/field'
import { DateField } from '@/components/ui/date-field'
import { Input } from '@/components/ui/input'
import { DATE_CHECK } from '@/lib/messages'
import { requiredText, useFormCheck, withContract } from '@/lib/use-form-check'
import { BudgetFormDialog } from './BudgetFormDialog'
import { fiscalPeriodsPath } from './finance-api'
import { useBudgetChange, type BudgetChangeHandlers } from './useBudgetChange'

type Props = BudgetChangeHandlers & {
  councilId: string
  onClose: () => void
}

// 세 칸 모두 필수이고 끝일은 시작일보다 뒤다(계약과 같은 규칙).
const periodErrors = (values: { name: string; startsOn: string; endsOn: string }) => ({
  name: requiredText(values.name, '이름을'),
  startsOn: requiredText(values.startsOn, '시작일을'),
  endsOn:
    requiredText(values.endsOn, '끝일을') ??
    (values.startsOn !== '' && values.endsOn <= values.startsOn
      ? '시작일보다 뒤의 날짜를 입력해 주세요'
      : undefined),
})

// 회계 기간 만들기. 오늘(한국)이 든 학기의 이름과 날짜로 채워 두고 고칠 수 있다(DEC-92, 024 정한 것 11).
export function PeriodCreateDialog({ councilId, onClose, ...handlers }: Props) {
  const [values, setValues] = useState(() => semesterOf(koreanDateOf(new Date())))
  const [saving, setSaving] = useState(false)
  const change = useBudgetChange(fiscalPeriodsPath(councilId), values, CreateFiscalPeriodSchema, {
    ...handlers,
    setSaving,
  })
  const set = (patch: Partial<typeof values>) => setValues({ ...values, ...patch })
  const {
    formRef,
    errors: fieldErrors,
    attempt,
  } = useFormCheck(() =>
    withContract(periodErrors(values), change.parsed, {
      startsOn: DATE_CHECK,
      endsOn: DATE_CHECK,
    }),
  )
  return (
    <BudgetFormDialog
      title="회계 기간 만들기"
      submitLabel="만들기"
      saving={saving}
      formRef={formRef}
      attempt={attempt}
      problem={change.problem}
      onSubmit={() => void change.submit()}
      onClose={onClose}
    >
      <Field label="이름" required error={fieldErrors.name}>
        <Input
          value={values.name}
          disabled={saving}
          onChange={event => set({ name: event.target.value })}
        />
      </Field>
      <Field label="시작일" required error={fieldErrors.startsOn}>
        <DateField
          value={values.startsOn}
          disabled={saving}
          onChange={startsOn => set({ startsOn })}
        />
      </Field>
      <Field label="끝일" required error={fieldErrors.endsOn}>
        <DateField value={values.endsOn} disabled={saving} onChange={endsOn => set({ endsOn })} />
      </Field>
    </BudgetFormDialog>
  )
}
