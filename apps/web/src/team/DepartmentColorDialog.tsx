import type { DepartmentColorKey, TeamDepartment } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DepartmentColorOptions } from './DepartmentColorOptions'

export function DepartmentColorDialog({
  department,
  color,
  saving,
  error,
  onColor,
  onSave,
  onClose,
  onCloseAutoFocus,
}: {
  department: TeamDepartment
  color: DepartmentColorKey
  saving: boolean
  error: string
  onColor: (color: DepartmentColorKey) => void
  onSave: () => void
  onClose: () => void
  onCloseAutoFocus: (event: Event) => void
}) {
  return (
    <Dialog
      open
      onOpenChange={open => {
        if (!open && !saving) onClose()
      }}
    >
      <DialogContent
        aria-describedby={undefined}
        onCloseAutoFocus={onCloseAutoFocus}
        onEscapeKeyDown={event => {
          if (saving) event.preventDefault()
        }}
        onPointerDownOutside={event => {
          if (saving) event.preventDefault()
        }}
      >
        <DialogHeader>
          <DialogTitle>{department.name} 색상</DialogTitle>
        </DialogHeader>
        <form
          aria-label="부서 색상"
          className="flex flex-col gap-4"
          onSubmit={event => {
            event.preventDefault()
            onSave()
          }}
        >
          <DepartmentColorOptions color={color} busy={saving} onColor={onColor} />
          {error && <StateMessage kind="error">{error}</StateMessage>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" busy={saving} onClick={onClose}>
              닫기
            </Button>
            <Button type="submit" busy={saving}>
              저장
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
