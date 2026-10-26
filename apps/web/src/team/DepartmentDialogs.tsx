import type { TeamDepartment } from '@vada/contracts'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { isUsedDepartment } from './team-view'
import type { DepartmentsState } from './useDepartments'

type Props = { state: DepartmentsState; saving: boolean }

// 쓰인 적 없는 부서 없애기와 쓴 부서 그만 쓰기의 확인 창(DEC-91). 대상이 없으면(사라졌거나 권한을 잃으면) 닫혀 있다.
// 이름 바꾸기는 묶음 머리의 제자리 편집이다(DepartmentRename).
export function DepartmentDialogs({ state, saving }: Props) {
  const { removingDepartment, menuFocus, problemIn } = state
  return (
    <RemoveDepartmentDialog
      department={removingDepartment}
      busy={saving}
      error={problemIn('remove')}
      onCloseAutoFocus={menuFocus.onCloseAutoFocus}
      onClose={state.closeRemove}
      onConfirm={() => {
        void state.remove()
      }}
    />
  )
}

type DialogProps = {
  department: TeamDepartment | null
  busy: boolean
  error: string
  onCloseAutoFocus?: (event: Event) => void
  onClose: () => void
  onConfirm: () => void
}

// 그만 쓰기는 되돌리지 않으므로(다시 쓰기는 두지 않음) 남은 인원이 함께 빠진다는 것을 보인다.
export function RemoveDepartmentDialog({ department, ...props }: DialogProps) {
  const name = department?.name ?? ''
  const retiring = department !== null && isUsedDepartment(department)
  const left = department?.memberCount ?? 0
  return (
    <ConfirmDialog
      {...props}
      open={department !== null}
      destructive
      title={retiring ? `${name} 부서를 그만 쓸까요?` : `${name} 부서를 없앨까요?`}
      description={
        retiring
          ? `${left > 0 ? `남은 ${left}명은 이 부서에서 빠지고, ` : ''}지난 기록은 남아요. 되돌릴 수 없어요.`
          : '없앤 부서는 되돌릴 수 없어요.'
      }
      confirmLabel={retiring ? '그만 쓰기' : '없애기'}
    />
  )
}
