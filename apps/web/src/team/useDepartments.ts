import { useEffect, useRef, useState } from 'react'
import type { CouncilView, TeamDepartment } from '@vada/contracts'
import { DEPARTMENT_IN_USE, PERMISSION_CHANGED } from '@/lib/messages'
import { useLost, type Reading } from '@/lib/use-lost'
import { useDepartmentRequests } from './useDepartmentRequests'
import { useDepartmentDialogs } from './useDepartmentDialogs'
import { useDepartmentSubmits } from './useDepartmentSubmits'
import { useMenuFocus } from './use-menu-focus'
import type { Team } from './useTeam'
import { useDepartmentColor } from './useDepartmentColor'

// 조직 화면의 부서 고치기 상태와 동작: 오류 문구, 제자리 이름 바꾸기, 없애기 확인, 부서 추가 칸, 서버 변경.
// 화면(Organization)은 이것을 그리기만 한다. reading은 view를 가져온 학생회 읽기다(내 변경으로 잃은 권한은 알리지 않는다).
export function useDepartments(view: CouncilView, team: Team, reading: Reading) {
  const manage = view.permissions.includes('department.manage')
  // 추가 칸은 권한에 따라 나타났다 사라지므로 적던 이름과 펼침은 여기서 들고 있는다.
  const [newName, setNewName] = useState('')
  const [adding, setAdding] = useState(false)
  const menuFocus = useMenuFocus()
  const requests = useDepartmentRequests(team.change)
  const dialogs = useDepartmentDialogs(team.data, manage, requests.report)
  const color = useDepartmentColor(manage, team, requests, menuFocus)
  // 추가 칸과 묶음 머리의 ⋯ 메뉴는 권한과 함께 사라진다.
  useLost(manage, () => requests.report(PERMISSION_CHANGED), reading)
  const submits = useDepartmentSubmits(team.saving, requests, dialogs)
  useRenameFocus(dialogs.renamingDepartment?.id ?? null, menuFocus.restore)

  // 닫을 때 포커스를 그 부서의 ⋯ 버튼으로 돌려주려고 어느 부서인지 기억한다.
  const open = (department: TeamDepartment, show: () => void) => {
    requests.clear()
    menuFocus.remember(department.id)
    show()
  }
  return {
    ...submits,
    color,
    manage,
    newName,
    setNewName,
    adding,
    setAdding,
    menuFocus,
    problemIn: requests.problemIn,
    clearCreateProblem: () => requests.clearIn('create'),
    clearRenameProblem: () => requests.clearIn('rename'),
    renamingDepartment: dialogs.renamingDepartment,
    removingDepartment: dialogs.removingDepartment,
    name: dialogs.name,
    setName: dialogs.setName,
    openRename: (department: TeamDepartment) =>
      open(department, () => dialogs.openRename(department)),
    // 지금 사람이 있는 부서는 쓴 부서라 서버가 없애지 않는다. 확인 창 없이 그 까닭을 보인다.
    openRemove: (department: TeamDepartment) =>
      department.memberCount > 0
        ? requests.report(DEPARTMENT_IN_USE)
        : open(department, () => dialogs.openRemove(department)),
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

// 제자리 이름 바꾸기를 닫으면(저장, 닫기, Esc) 포커스를 그 부서의 ⋯ 버튼으로 돌려준다. 편집 중에는 ⋯ 버튼이 없어
// 닫은 뒤 다시 그려진 버튼으로 옮겨야 해서 그린 뒤(effect)에 옮긴다.
function useRenameFocus(renamingId: string | null, restore: () => boolean) {
  const previous = useRef<string | null>(null)
  useEffect(() => {
    if (previous.current !== null && renamingId === null) restore()
    previous.current = renamingId
  })
}
