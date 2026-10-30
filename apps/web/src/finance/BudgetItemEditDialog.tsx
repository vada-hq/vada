import { useState } from 'react'
import { UpdateBudgetItemSchema, type BudgetItemView } from '@vada/contracts'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useUnsavedInput, useWindowLeave } from '@/lib/leave-guard'
import { sameJson } from '@/lib/same-json'
import { requiredText, useFormCheck, withContract } from '@/lib/use-form-check'
import { wonOf } from '@/lib/won-input'
import { BudgetFormDialog } from './BudgetFormDialog'
import { BudgetOverConfirm } from './BudgetOverConfirm'
import { DepartmentField } from './DepartmentField'
import { budgetItemPath } from './finance-api'
import { useBudgetChange, type BudgetChangeHandlers } from './useBudgetChange'

type Props = BudgetChangeHandlers & {
  councilId: string
  item: BudgetItemView
  onClose: () => void
}

type Values = { purpose: string; amount: string; departmentId: string | null; reason: string }

const editErrors = (values: Values) => ({
  purpose: requiredText(values.purpose, '항목 이름을'),
  amount:
    requiredText(values.amount, '금액을') ??
    (Number.isNaN(wonOf(values.amount)) ? '숫자만 입력해 주세요' : undefined),
  reason: requiredText(values.reason, '사유를'),
})

// 줄여서 사용 가능이 음수가 되면 한 번 묻는다(DEC-92). 늘리거나 수입 항목이면 묻지 않는다. 음수가 아니면 null이다.
function overspentAfter(item: BudgetItemView, amount: number) {
  if (item.type !== 'expense' || Number.isNaN(amount) || amount >= item.amount) return null
  const available = amount - item.actual - item.committed
  return available < 0 ? available : null
}

// 예산 항목 고치기(DEC-92): 이름, 금액, 담당 부서를 바로 고치고 사유(필수)를 판에 남긴다. 종류와 행사는 바꾸지 않는다.
export function BudgetItemEditDialog({ councilId, item, onClose, ...handlers }: Props) {
  const [initial] = useState<Values>(() => ({
    purpose: item.purpose,
    amount: item.amount.toLocaleString('ko-KR'),
    departmentId: item.department?.id ?? null,
    reason: '',
  }))
  const [values, setValues] = useState(initial)
  const [saving, setSaving] = useState(false)
  const leave = useWindowLeave(onClose)
  // 보내는 동안은 풀어 둔다. 저장되면 그대로 닫히고, 실패하면 다시 지킨다.
  useUnsavedInput(!sameJson(values, initial) && !saving, leave.holder)
  const [confirming, setConfirming] = useState(false)
  const body = {
    purpose: values.purpose,
    amount: wonOf(values.amount),
    departmentId: values.departmentId,
    reason: values.reason,
  }
  const change = useBudgetChange(budgetItemPath(councilId, item.id), body, UpdateBudgetItemSchema, {
    ...handlers,
    setSaving,
    onRejected: () => setConfirming(false),
  })
  const { formRef, errors, attempt } = useFormCheck(() =>
    withContract(editErrors(values), change.parsed),
  )
  const set = (patch: Partial<Values>) => setValues({ ...values, ...patch })
  const over = overspentAfter(item, body.amount)
  return (
    <>
      <BudgetFormDialog
        title="예산 항목 고치기"
        submitLabel="저장"
        saving={saving}
        formRef={formRef}
        attempt={attempt}
        problem={confirming ? null : change.problem}
        onSubmit={() => (over === null ? void change.submit() : setConfirming(true))}
        onClose={leave.close}
      >
        <Field label="항목 이름" required error={errors.purpose}>
          <Input
            value={values.purpose}
            disabled={saving}
            onChange={event => set({ purpose: event.target.value })}
          />
        </Field>
        <Field label="금액(원)" required error={errors.amount}>
          <Input
            inputMode="numeric"
            className="text-right tabular-nums"
            value={values.amount}
            disabled={saving}
            onChange={event => set({ amount: event.target.value })}
          />
        </Field>
        <DepartmentField
          councilId={councilId}
          value={values.departmentId}
          current={item.department}
          disabled={saving}
          onChange={departmentId => set({ departmentId })}
          onForbidden={handlers.onForbidden}
        />
        <Field label="사유" required error={errors.reason}>
          <Textarea
            value={values.reason}
            disabled={saving}
            onChange={event => set({ reason: event.target.value })}
          />
        </Field>
      </BudgetFormDialog>
      <BudgetOverConfirm
        open={confirming && over !== null}
        lines={[
          { id: item.id, purpose: values.purpose.trim() || item.purpose, available: over ?? 0 },
        ]}
        when="저장하면"
        confirmLabel="그래도 저장"
        busy={saving}
        error={null}
        onConfirm={() => void change.submit()}
        onClose={() => setConfirming(false)}
      />
    </>
  )
}
