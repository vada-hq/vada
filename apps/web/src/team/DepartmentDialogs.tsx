import { ConfirmDialog } from '@/components/ConfirmDialog'
import type { DepartmentsState } from './useDepartments'

type Props = { state: DepartmentsState; saving: boolean }

// 쓰인 적 없는 부서 없애기의 확인 창. 대상이 없으면(사라졌거나 권한을 잃으면) 닫혀 있다.
// 이름 바꾸기는 묶음 머리의 제자리 편집이다(DepartmentRename).
export function DepartmentDialogs({ state, saving }: Props) {
  const { removingDepartment, menuFocus, problemIn } = state
  return (
    <ConfirmDialog
      open={removingDepartment !== null}
      destructive
      busy={saving}
      error={problemIn('remove')}
      title={`${removingDepartment?.name ?? ''} 부서를 없앨까요?`}
      description="없앤 부서는 되돌릴 수 없어요."
      confirmLabel="없애기"
      onCloseAutoFocus={menuFocus.onCloseAutoFocus}
      onClose={state.closeRemove}
      onConfirm={() => {
        void state.remove()
      }}
    />
  )
}
