import type { CouncilTitles, DepartmentRank, TeamDepartment, TeamMember } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { MemberDepartmentAdd, useAddDepartment } from './MemberDepartmentAdd'
import { MemberDepartmentList } from './MemberDepartmentList'

type Props = {
  member: TeamMember
  departments: TeamDepartment[]
  titles: CouncilTitles
  saving: boolean
  // 부서 직급(부장·부부장)을 바꿀 수 있는가(rank.manage). 부서에 직급 없이 넣는 일은 member.manage만으로 된다(P19).
  // 직급이 붙은 소속을 빼는 일은 그 직급을 거두는 일이기도 해서 서버는 rank.manage도 본다.
  canRank: boolean
  error: string
  onAssign: (departmentId: string, rank: DepartmentRank | null) => void
  onRemove: (departmentId: string) => void
  onClose: () => void
  onCloseAutoFocus?: (event: Event) => void
}

// 부서 배정(회장단): 지금 부서마다 부서 직급을 바꾸거나 빼고, 다른 부서에 더한다. 한 사람이 여러 부서에 있을 수 있다(DEC-16).
export default function MemberDepartmentsDialog(props: Props) {
  const { member, departments, saving, error, onClose, onCloseAutoFocus } = props
  const others = departments.filter(
    department => !member.departments.some(item => item.id === department.id),
  )
  const add = useAddDepartment(others)
  return (
    <Dialog
      open
      onOpenChange={open => {
        if (!open && !saving) onClose()
      }}
    >
      <DialogContent onCloseAutoFocus={onCloseAutoFocus}>
        <DialogHeader>
          <DialogTitle className="wrap-anywhere">{member.name}의 부서</DialogTitle>
          <DialogDescription>부서와 부서 직급을 정해요. 바꾸면 바로 저장돼요.</DialogDescription>
        </DialogHeader>
        <MemberDepartmentList {...props} />
        {others.length > 0 ? (
          <MemberDepartmentAdd {...props} others={others} add={add} />
        ) : (
          // 부서는 조직 화면의 [부서 추가]로 만든다(기능 023 정한 것 10의 빈 상태).
          departments.length === 0 && <p className="text-sm text-gray-500">부서 없음</p>
        )}
        {error && <StateMessage kind="error">{error}</StateMessage>}
      </DialogContent>
    </Dialog>
  )
}
