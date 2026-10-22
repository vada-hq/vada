import type { ReactNode } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

type Props = {
  title: string
  // 보내는 동안에는 닫지 못한다.
  saving: boolean
  onClose: () => void
  children: ReactNode
}

// 행사 대화상자 셋(만들기, 고치기, 책임자 바꾸기)의 겉. 열림 상태는 부모가 가진다.
export function EventDialogShell({ title, saving, onClose, children }: Props) {
  return (
    <Dialog
      open
      onOpenChange={open => {
        if (!open && !saving) onClose()
      }}
    >
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  )
}
