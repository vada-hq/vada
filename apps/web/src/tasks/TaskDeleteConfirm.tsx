import { ConfirmDialog } from '@/components/ConfirmDialog'

type Props = {
  open: boolean
  busy: boolean
  error: string
  onClose: () => void
  onConfirm: () => void
}

// 업무 지우기 확인. 상세 머리의 '⋯'와 보드 카드의 '⋯'가 같은 창을 쓴다(같은 동작은 같은 이름·같은 확인).
export function TaskDeleteConfirm(props: Props) {
  return (
    <ConfirmDialog
      destructive
      title="이 업무를 지울까요?"
      description="지운 업무는 목록에서 사라지고 되살릴 수 없어요."
      confirmLabel="지우기"
      {...props}
    />
  )
}
