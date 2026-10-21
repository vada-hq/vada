import { useState } from 'react'
import { CreateFiscalPeriodSchema, type BudgetResponse } from '@vada/contracts'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { periodDefaults } from './budget-form'
import { BudgetFormDialog } from './BudgetFormDialog'
import { fiscalPeriodsPath } from './finance-api'
import { useBudgetChange, type BudgetChangeHandlers } from './useBudgetChange'

type Props = BudgetChangeHandlers & {
  councilId: string
  suggested: BudgetResponse['suggested']
  onClose: () => void
}

// 회계 기간 만들기. 지금 기수의 이름과 날짜로 채워 두고 고칠 수 있다.
export function PeriodCreateDialog({ councilId, suggested, onClose, ...handlers }: Props) {
  const [values, setValues] = useState(() => periodDefaults(suggested))
  const [saving, setSaving] = useState(false)
  const change = useBudgetChange(fiscalPeriodsPath(councilId), values, CreateFiscalPeriodSchema, {
    ...handlers,
    setSaving,
  })
  const set = (patch: Partial<typeof values>) => setValues({ ...values, ...patch })
  return (
    <BudgetFormDialog
      title="회계 기간 만들기"
      description="예산은 회계 기간과 함께 생겨요. 결재는 오늘이 든 기간의 예산 항목에서 골라요."
      submitLabel="만들기"
      saving={saving}
      valid={change.valid}
      problem={change.problem}
      onSubmit={() => void change.submit()}
      onClose={onClose}
    >
      <Label className="flex flex-col gap-2">
        이름
        <Input
          value={values.name}
          disabled={saving}
          onChange={event => set({ name: event.target.value })}
        />
      </Label>
      <Label className="flex flex-col gap-2">
        시작일
        <Input
          type="date"
          value={values.startsOn}
          disabled={saving}
          onChange={event => set({ startsOn: event.target.value })}
        />
      </Label>
      <Label className="flex flex-col gap-2">
        끝일
        <Input
          type="date"
          value={values.endsOn}
          disabled={saving}
          onChange={event => set({ endsOn: event.target.value })}
        />
      </Label>
    </BudgetFormDialog>
  )
}
