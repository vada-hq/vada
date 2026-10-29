import { CircleAlert } from 'lucide-react'
import { CancelCompletionSchema, CompleteEventSchema } from '@vada/contracts'
import { CancelReasonDialog } from '@/components/CancelReasonDialog'
import { Alert } from '@/components/ui/alert'

type Props = {
  mode: 'complete' | 'cancel'
  // 끝나지 않은 업무 수. 완료는 업무를 막지 않고 알리기만 한다.
  openTasks: number
  busy: boolean
  error: string | null
  onClose: () => void
  onConfirm: (reason: string | null) => void
}

// 확인 창에는 그 행동의 결과만 적는다(NN/g, 확인 창은 결과를 구체적으로).
const COPY = {
  complete: {
    title: '이 행사를 완료할까요?',
    reasonLabel: '사유',
    confirm: '완료',
    description: '완료하면 이 행사의 지출, 요청, 참가 신청, 입금을 바꿀 수 없어요.',
  },
  cancel: {
    title: '완료를 취소할까요?',
    reasonLabel: '취소 사유',
    confirm: '완료 취소',
    description: '완료할 때 모은 참가비 수입도 취소돼요.',
  },
}

// 완료의 남은 항목(와이어프레임 EVT-02E의 잔여 항목 상자). 정산에 남은 것은 완료를 막으므로(DEC-68) 창이 열릴 때는 없고,
// 끝나지 않은 업무는 막지 않고 수만 알린다(DEC-93). 없으면 상자를 두지 않는다.
function RemainingItems({ openTasks }: { openTasks: number }) {
  if (openTasks === 0) return null
  return (
    <Alert tone="warning">
      <ul aria-label="남은 항목" className="flex flex-col gap-2">
        <li className="flex items-center gap-2 text-fg-secondary">
          <CircleAlert aria-hidden className="size-3.5 shrink-0 text-danger-mark" />
          {`끝나지 않은 업무 ${openTasks}개`}
        </li>
      </ul>
    </Alert>
  )
}

// 완료 확인(사유는 적을 수만 있다)과 완료 취소(사유가 꼭 있다). 완료는 빈 사유를 null로 보낸다.
export function CompletionDialog({ mode, openTasks, onConfirm, ...rest }: Props) {
  const copy = COPY[mode]
  const complete = mode === 'complete'
  return (
    <CancelReasonDialog
      {...rest}
      title={copy.title}
      description={copy.description}
      reasonLabel={copy.reasonLabel}
      confirmLabel={copy.confirm}
      optional={complete}
      destructive={!complete}
      parse={reason =>
        complete
          ? CompleteEventSchema.safeParse({ reason: reason.trim() === '' ? null : reason })
          : CancelCompletionSchema.safeParse({ reason })
      }
      onConfirm={reason => onConfirm(complete && reason.trim() === '' ? null : reason)}
    >
      {complete && <RemainingItems openTasks={openTasks} />}
    </CancelReasonDialog>
  )
}
