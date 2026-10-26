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
import { requiredText, useFormCheck, withContract } from '@/lib/use-form-check'
import { BudgetFormDialog } from './BudgetFormDialog'
import { FeePaymentUploadFields, type FeePaymentValues } from './FeePaymentUploadFields'
import { FeePaymentReplaceConfirm } from './FeePaymentReplaceConfirm'
import { feePaymentsPath } from './finance-api'
import { useFeePaymentPeriod } from './useFeePaymentPeriod'
import { useFeePaymentPost, type FeePaymentHandlers } from './useFeePaymentPost'

type Props = FeePaymentHandlers & {
  councilId: string
  onClose: (changed: boolean) => void
}

const linesText = (lines: number[]) =>
  `학번 형식이 맞지 않는 줄이 있어요. ${lines.join(', ')}번째 줄${lines.length >= INVALID_LINES_MAX ? ' 등' : ''}을 고치면 다시 올릴 수 있어요. 아무것도 올라가지 않았어요.`

function Done({ result, onClose }: { result: AddFeePaymentsResponse; onClose: () => void }) {
  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent
        aria-describedby="fee-payment-done"
        className="[&_button]:max-sm:min-h-11 [&>button]:max-sm:min-w-11"
      >
        <DialogHeader>
          <DialogTitle>명단 올리기 완료</DialogTitle>
          <DialogDescription id="fee-payment-done">{`추가 ${result.added}개 · 이미 있음 ${result.skipped}개`}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button onClick={onClose}>닫기</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

const uploadErrors = (values: FeePaymentValues) =>
  withContract(
    {
      paidFrom: requiredText(values.paidFrom, '납부 시작일을'),
      paidUntil:
        requiredText(values.paidUntil, '납부 끝일을') ??
        (values.paidFrom !== '' && values.paidUntil < values.paidFrom
          ? '시작일과 같거나 뒤의 날짜를 입력해 주세요'
          : undefined),
      students: requiredText(values.students, '학번을'),
    },
    AddFeePaymentsSchema.safeParse(values),
  )

export function FeePaymentUploadDialog({ councilId, onClose, ...handlers }: Props) {
  const [manual, setValues] = useState({ paidFrom: '', paidUntil: '', students: '' })
  const {
    periods,
    selected: periodId,
    period,
    select: setSelected,
  } = useFeePaymentPeriod(councilId, handlers.onForbidden)
  const values = period
    ? { ...manual, paidFrom: period.startsOn, paidUntil: period.endsOn }
    : manual
  const [reading, setReading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [pending, setPending] = useState<FeePaymentValues | null>(null)
  const [result, setResult] = useState<AddFeePaymentsResponse | null>(null)
  const post = useFeePaymentPost<AddFeePaymentsResponse>(
    feePaymentsPath(councilId),
    values,
    AddFeePaymentsSchema,
    { ...handlers, setSaving, onDone: setResult, onReplaceRequired: () => setPending(values) },
  )
  const { formRef, errors: fieldErrors, attempt } = useFormCheck(() => uploadErrors(values))
  if (pending && !result)
    return (
      <FeePaymentReplaceConfirm
        busy={saving}
        error={post.problem}
        onClose={() => setPending(null)}
        onConfirm={() => void post.submit({ ...pending, replace: true })}
      />
    )
  if (result) return <Done result={result} onClose={() => onClose(true)} />
  return (
    <BudgetFormDialog
      touch
      title="납부자 명단 올리기"
      submitLabel="올리기"
      saving={saving || reading}
      formRef={formRef}
      attempt={attempt}
      problem={post.lines.length > 0 ? linesText(post.lines) : post.problem}
      onSubmit={() => {
        if (!reading) void post.submit()
      }}
      onClose={() => onClose(false)}
    >
      <FeePaymentUploadFields
        values={values}
        periods={periods}
        selected={periodId}
        saving={saving || reading}
        errors={fieldErrors}
        onSelect={setSelected}
        onChange={next => {
          if (periodId === 'manual') setSelected('manual')
          setValues(next)
        }}
        onReading={setReading}
      />
    </BudgetFormDialog>
  )
}
