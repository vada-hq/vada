import { ConfirmDialog } from '@/components/ConfirmDialog'

type Props = {
  open: boolean
  busy: boolean
  // 바꾸지 못했으면 창을 닫지 않고 그 자리에 보인다(기능 023 정한 것 6).
  error?: string | null
  onConfirm: () => void
  onClose: () => void
}

// 코드 바꾸기 전 확인 창(기능 020 정한 것 14). 옛 링크가 곧바로 막혀 되돌릴 수 없으므로 빨간 버튼이다.
export function RotateInviteDialog({ open, busy, error, onConfirm, onClose }: Props) {
  return (
    <ConfirmDialog
      open={open}
      destructive
      busy={busy}
      error={error}
      title="초대 코드를 바꿀까요?"
      description="옛 링크와 코드로는 들어올 수 없어요. 이미 들어온 운영진은 그대로예요."
      confirmLabel="코드 바꾸기"
      onConfirm={onConfirm}
      onClose={onClose}
    />
  )
}
