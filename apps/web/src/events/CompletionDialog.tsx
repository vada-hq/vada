import { CancelCompletionSchema, CompleteEventSchema } from '@vada/contracts'
import { CancelReasonDialog } from '@/components/CancelReasonDialog'
import StateMessage from '@/components/StateMessage'

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
      {complete && openTasks > 0 && (
        <StateMessage kind="notice">{`끝나지 않은 업무 ${openTasks}개`}</StateMessage>
      )}
    </CancelReasonDialog>
  )
}
