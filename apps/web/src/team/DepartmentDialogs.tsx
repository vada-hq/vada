import { ConfirmDialog } from '@/components/ConfirmDialog'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Field } from '@/components/ui/field'
import { requiredText, useFormCheck } from '@/lib/use-form-check'
import type { DepartmentsState } from './useDepartments'

type Props = { state: DepartmentsState; saving: boolean }

// 부서 화면의 대화상자 둘: 이름 바꾸기와 없애기. 대상이 없으면(사라졌거나 권한을 잃으면) 닫혀 있다.
export function DepartmentDialogs({ state, saving }: Props) {
  const { removingDepartment, menuFocus, problemIn } = state
  return (
    <>
      <RenameDialog state={state} saving={saving} />
      <ConfirmDialog
        open={removingDepartment !== null}
        destructive
        busy={saving}
        error={problemIn('remove')}
        title={`${removingDepartment?.name ?? ''} 부서를 없앨까요?`}
        description="없앤 부서는 되돌릴 수 없어요."
        confirmLabel="없애기"
        onCloseAutoFocus={menuFocus.onCloseAutoFocus}
        onCancel={state.closeRemove}
        onConfirm={() => {
          void state.remove()
        }}
      />
    </>
  )
}

function RenameDialog({ state, saving }: Props) {
  const rename = state.problemIn('rename')
  const check = useFormCheck(() => ({ name: requiredText(state.name, '부서 이름을') }))
  return (
    <Dialog
      open={state.renamingDepartment !== null}
      onOpenChange={open => {
        if (!open && !saving) state.closeRename()
      }}
    >
      <DialogContent onCloseAutoFocus={state.menuFocus.onCloseAutoFocus}>
        <DialogHeader>
          <DialogTitle>부서 이름 바꾸기</DialogTitle>
        </DialogHeader>
        <form
          ref={check.formRef}
          noValidate
          aria-label="부서 이름 바꾸기"
          className="flex flex-col gap-4"
          onSubmit={event => {
            if (check.attempt()) void state.rename(event)
            else event.preventDefault()
          }}
        >
          <Field label="부서 이름" error={check.errors.name}>
            <Input value={state.name} onChange={event => state.setName(event.target.value)} />
          </Field>
          {rename && <StateMessage kind="error">{rename}</StateMessage>}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={saving} onClick={state.closeRename}>
              닫기
            </Button>
            <Button type="submit" disabled={saving}>
              바꾸기
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
