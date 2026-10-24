import { useState } from 'react'
import {
  AddFeePaymentsSchema,
  INVALID_LINES_MAX,
  type AddFeePaymentsResponse,
} from '@vada/contracts'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { requiredText, useFormCheck, type FieldErrors } from '@/lib/use-form-check'
import { BudgetFormDialog } from './BudgetFormDialog'
import { feePaymentsPath } from './finance-api'
import { useFeePaymentPost, type FeePaymentHandlers } from './useFeePaymentPost'

type Props = FeePaymentHandlers & {
  councilId: string
  // 올린 뒤 닫을 때 부모가 명단을 다시 읽는다.
  onClose: (changed: boolean) => void
}

const linesText = (lines: number[]) =>
  `학번 형식이 맞지 않는 줄이 있어요. ${lines.join(', ')}번째 줄${lines.length >= INVALID_LINES_MAX ? ' 등' : ''}을 고치면 다시 올릴 수 있어요. 아무것도 올라가지 않았어요.`

function Done({ result, onClose }: { result: AddFeePaymentsResponse; onClose: () => void }) {
  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent aria-describedby="fee-payment-done">
        <DialogHeader>
          <DialogTitle>명단 올리기 완료</DialogTitle>
          <DialogDescription id="fee-payment-done">
            {`추가 ${result.added}개 · 이미 있음 ${result.skipped}개`}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button onClick={onClose}>닫기</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

type Values = { paidFrom: string; paidUntil: string; students: string }

// 세 칸 모두 필수이고 끝일은 시작일과 같거나 뒤다(계약과 같은 규칙).
const uploadErrors = (values: Values) => ({
  paidFrom: requiredText(values.paidFrom, '납부 시작일을'),
  paidUntil:
    requiredText(values.paidUntil, '납부 끝일을') ??
    (values.paidFrom !== '' && values.paidUntil < values.paidFrom
      ? '시작일과 같거나 뒤의 날짜를 입력해 주세요'
      : undefined),
  students: requiredText(values.students, '학번을'),
})

function UploadFields({
  values,
  saving,
  errors,
  onChange,
}: {
  values: Values
  saving: boolean
  errors: FieldErrors
  onChange: (values: Values) => void
}) {
  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="납부 시작일" required error={errors.paidFrom}>
          <Input
            type="date"
            value={values.paidFrom}
            disabled={saving}
            onChange={event => onChange({ ...values, paidFrom: event.target.value })}
          />
        </Field>
        <Field label="납부 끝일" required error={errors.paidUntil}>
          <Input
            type="date"
            value={values.paidUntil}
            disabled={saving}
            onChange={event => onChange({ ...values, paidUntil: event.target.value })}
          />
        </Field>
      </div>
      <Field label="학번" required hint="줄바꿈이나 쉼표로 구분" error={errors.students}>
        <Textarea
          rows={8}
          value={values.students}
          disabled={saving}
          onChange={event => onChange({ ...values, students: event.target.value })}
        />
      </Field>
    </>
  )
}

// 납부자 올리기: 납부 기간과 학번을 붙여 넣는다. 형식이 틀린 학번이 하나라도 있으면 아무것도 올라가지 않고 그 줄 번호를 보인다.
export function FeePaymentUploadDialog({ councilId, onClose, ...handlers }: Props) {
  const [values, setValues] = useState({ paidFrom: '', paidUntil: '', students: '' })
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState<AddFeePaymentsResponse | null>(null)
  const post = useFeePaymentPost<AddFeePaymentsResponse>(
    feePaymentsPath(councilId),
    values,
    AddFeePaymentsSchema,
    { ...handlers, setSaving, onDone: setResult },
  )
  const { formRef, errors: fieldErrors, attempt } = useFormCheck(() => uploadErrors(values))
  if (result) return <Done result={result} onClose={() => onClose(true)} />
  return (
    <BudgetFormDialog
      title="납부자 명단 올리기"
      submitLabel="올리기"
      saving={saving}
      formRef={formRef}
      attempt={attempt}
      problem={post.lines.length > 0 ? linesText(post.lines) : post.problem}
      onSubmit={() => void post.submit()}
      onClose={() => onClose(false)}
    >
      <UploadFields values={values} saving={saving} errors={fieldErrors} onChange={setValues} />
    </BudgetFormDialog>
  )
}
