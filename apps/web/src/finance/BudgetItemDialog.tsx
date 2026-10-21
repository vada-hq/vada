import { useState } from 'react'
import { CreateBudgetItemSchema } from '@vada/contracts'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { budgetItemOf, emptyBudgetItem } from './budget-form'
import { BudgetFormDialog } from './BudgetFormDialog'
import { budgetItemsPath } from './finance-api'
import { useBudgetChange, type BudgetChangeHandlers } from './useBudgetChange'

type Props = BudgetChangeHandlers & { councilId: string; onClose: () => void }

// 지출 예산 항목 더하기. 목적과 금액만 받는다.
export function BudgetItemDialog({ councilId, onClose, ...handlers }: Props) {
  const [values, setValues] = useState(emptyBudgetItem)
  const [saving, setSaving] = useState(false)
  const change = useBudgetChange(
    budgetItemsPath(councilId),
    budgetItemOf(values),
    CreateBudgetItemSchema,
    { ...handlers, setSaving },
  )
  const set = (patch: Partial<typeof values>) => setValues({ ...values, ...patch })
  return (
    <BudgetFormDialog
      title="예산 항목 더하기"
      description="지금 회계 기간의 지출 예산 항목이에요. 구매 요청을 결재할 때 이 목록에서 골라요."
      submitLabel="더하기"
      saving={saving}
      valid={change.valid}
      problem={change.problem}
      onSubmit={() => void change.submit()}
      onClose={onClose}
    >
      <Label className="flex flex-col gap-2">
        목적
        <Input
          value={values.purpose}
          disabled={saving}
          onChange={event => set({ purpose: event.target.value })}
        />
      </Label>
      <Label className="flex flex-col gap-2">
        금액(원)
        <Input
          inputMode="numeric"
          value={values.amount}
          disabled={saving}
          onChange={event => set({ amount: event.target.value })}
        />
      </Label>
    </BudgetFormDialog>
  )
}
