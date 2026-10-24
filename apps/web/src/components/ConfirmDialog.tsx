import type { ReactNode } from 'react'
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

type Props = {
  open: boolean
  title: string
  description: string
  confirmLabel: string
  // 되돌리기 어려운 동작(내보내기)은 빨간 버튼이다.
  destructive?: boolean
  busy?: boolean
  error?: string
  onConfirm: () => void
  onCancel: () => void
  // 닫을 때 포커스를 어디로 돌릴지. 메뉴 항목으로 연 대화상자는 연 버튼으로 직접 돌려줘야 한다.
  onCloseAutoFocus?: (event: Event) => void
  children?: ReactNode
}

// 확인 대화상자: 되돌리기 어려운 동작(내보내기, 회장 넘기기) 앞에 한 번 묻는다. 보내는 동안에는 닫지 않는다.
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  destructive = false,
  busy = false,
  error,
  onConfirm,
  onCancel,
  onCloseAutoFocus,
  children,
}: Props) {
  return (
    <Dialog
      open={open}
      onOpenChange={next => {
        if (!next && !busy) onCancel()
      }}
    >
      <DialogContent onCloseAutoFocus={onCloseAutoFocus}>
        <DialogHeader>
          <DialogTitle className="wrap-anywhere">{title}</DialogTitle>
          <DialogDescription className="wrap-anywhere">{description}</DialogDescription>
        </DialogHeader>
        {children}
        {error && <StateMessage kind="error">{error}</StateMessage>}
        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={onCancel}>
            취소
          </Button>
          <Button
            variant={destructive ? 'destructive' : 'default'}
            disabled={busy}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
