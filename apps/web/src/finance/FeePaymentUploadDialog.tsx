import { useState } from 'react'
import {
  AddFeePaymentsSchema,
  INVALID_LINES_MAX,
  type AddFeePaymentsResponse,
} from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
          <DialogTitle>명단을 올렸어요</DialogTitle>
          <DialogDescription id="fee-payment-done">
            {result.added}개를 더했고, 이미 있는 {result.skipped}개는 건너뛰었어요.
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

function UploadFields({
  values,
  saving,
  onChange,
}: {
  values: Values
  saving: boolean
  onChange: (values: Values) => void
}) {
  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Label className="flex flex-col gap-2">
          납부 시작일
          <Input
            type="date"
            value={values.paidFrom}
            disabled={saving}
            onChange={event => onChange({ ...values, paidFrom: event.target.value })}
          />
        </Label>
        <Label className="flex flex-col gap-2">
          납부 끝일
          <Input
            type="date"
            value={values.paidUntil}
            disabled={saving}
            onChange={event => onChange({ ...values, paidUntil: event.target.value })}
          />
        </Label>
      </div>
      <Label className="flex flex-col gap-2">
        학번
        <Textarea
          rows={8}
          value={values.students}
          disabled={saving}
          onChange={event => onChange({ ...values, students: event.target.value })}
        />
      </Label>
      <StateMessage kind="notice">
        같은 학번과 시작일이 이미 있으면 건너뛰어요. 끝일은 시작일과 같거나 뒤여야 해요.
      </StateMessage>
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
  if (result) return <Done result={result} onClose={() => onClose(true)} />
  return (
    <BudgetFormDialog
      title="납부자 명단 올리기"
      description="학생회비를 낸 학번을 줄바꿈이나 쉼표로 나누어 붙여 넣어요. 신청할 때 이 명단에서 학번을 찾아 참가비가 정해져요."
      submitLabel="올리기"
      saving={saving}
      valid={post.valid}
      problem={post.lines.length > 0 ? linesText(post.lines) : post.problem}
      onSubmit={() => void post.submit()}
      onClose={() => onClose(false)}
    >
      <UploadFields values={values} saving={saving} onChange={setValues} />
    </BudgetFormDialog>
  )
}
