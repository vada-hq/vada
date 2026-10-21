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
  title: string
  description: string
  submitLabel: string
  // 보내는 동안은 닫히지 않고 입력과 버튼이 막힌다.
  saving: boolean
  valid: boolean
  problem: string | null
  onSubmit: () => void
  onClose: () => void
  children: ReactNode
}

// 예산 탭의 입력 대화상자 껍데기(제목, 오류, [취소], 제출 버튼). 입력칸은 부모가 채운다.
export function BudgetFormDialog({
  title,
  description,
  submitLabel,
  saving,
  valid,
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
      <DialogContent aria-describedby="budget-form-description">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription id="budget-form-description">{description}</DialogDescription>
        </DialogHeader>
        <form
          aria-label={title}
          className="flex flex-col gap-4"
          onSubmit={event => {
            event.preventDefault()
            onSubmit()
          }}
        >
          {children}
          {problem && <StateMessage kind="error">{problem}</StateMessage>}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={saving} onClick={onClose}>
              취소
            </Button>
            <Button type="submit" disabled={!valid || saving}>
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
