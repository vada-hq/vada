import type { ReactNode } from 'react'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { RefObject } from 'react'

type Props = {
  title: string
  submitLabel: string
  // 보내는 동안은 닫히지 않고 입력과 버튼이 막힌다.
  saving: boolean
  // 누를 때 확인한다(useFormCheck). 칸 아래 글은 부모가 그린다.
  formRef: RefObject<HTMLFormElement | null>
  attempt: () => boolean
  problem: string | null
  onSubmit: () => void
  onClose: () => void
  children: ReactNode
}

// 예산 탭의 입력 대화상자 껍데기(제목, 오류, [취소], 제출 버튼). 입력칸은 부모가 채운다.
// 제출 버튼은 끄지 않고 누를 때 확인한다(계약 검사는 부모의 submit이 한 번 더 한다).
export function BudgetFormDialog({
  title,
  submitLabel,
  saving,
  formRef,
  attempt,
  problem,
  onSubmit,
  onClose,
  children,
}: Props) {
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
        <form
          ref={formRef}
          noValidate
          aria-label={title}
          className="flex flex-col gap-4"
          onSubmit={event => {
            event.preventDefault()
            if (attempt()) onSubmit()
          }}
        >
          {children}
          {problem && <StateMessage kind="error">{problem}</StateMessage>}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={saving} onClick={onClose}>
              취소
            </Button>
            <Button type="submit" disabled={saving}>
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
