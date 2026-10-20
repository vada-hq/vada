import type { CouncilView, TeamDepartment } from '@vada/contracts'
import { useDepartmentRequests } from './useDepartmentRequests'
import { useDepartmentDialogs } from './useDepartmentDialogs'
import { departmentPath, useDepartmentSubmits } from './useDepartmentSubmits'
import { useMenuFocus } from './use-menu-focus'
import type { Team } from './useTeam'

// 운영진 > 부서 화면의 상태와 동작: 오류 문구, 대화상자, 서버 변경. 화면(Departments)은 이것을 그리기만 한다.
export function useDepartments(view: CouncilView, team: Team) {
  const manage = view.permissions.includes('department.manage')
  const menuFocus = useMenuFocus()
  const requests = useDepartmentRequests(team.change)
  const dialogs = useDepartmentDialogs(team.data, manage)
  const submits = useDepartmentSubmits(team.saving, requests, dialogs)

  // 닫을 때 포커스를 그 줄의 ⋯ 버튼으로 돌려주려고 어느 줄인지 기억한다.
  const open = (department: TeamDepartment, show: () => void) => {
    requests.clear()
    menuFocus.remember(department.id)
    show()
  }
  return {
    ...submits,
    manage,
    menuFocus,
    problemIn: requests.problemIn,
    clearCreateProblem: () => requests.clearIn('create'),
    renamingDepartment: dialogs.renamingDepartment,
    removingDepartment: dialogs.removingDepartment,
    name: dialogs.name,
    setName: dialogs.setName,
    openRename: (department: TeamDepartment) =>
      open(department, () => dialogs.openRename(department)),
    openRemove: (department: TeamDepartment) =>
      open(department, () => dialogs.openRemove(department)),
    toggleFinance: (department: TeamDepartment) => {
      void requests.run(
        departmentPath(department),
        { name: department.name, role: department.role === 'finance' ? null : 'finance' },
        'list',
      )
    },
    closeRename: () => {
      dialogs.closeRename()
      requests.clear()
    },
    closeRemove: () => {
      dialogs.closeRemove()
      requests.clear()
    },
  }
}
export type DepartmentsState = ReturnType<typeof useDepartments>
