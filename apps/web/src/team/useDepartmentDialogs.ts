import { useEffect, useState } from 'react'
import type { TeamDepartment, TeamResponse } from '@vada/contracts'

// 부서 화면의 대화상자 둘(이름 바꾸기, 없애기)의 대상. id만 기억하고 매번 다시 읽은 목록에서 부서를 찾으므로,
// 부서가 사라졌거나 권한을 잃으면 대화상자는 닫힌다(DEC-38).
export function useDepartmentDialogs(data: TeamResponse | null, manage: boolean) {
  const [renaming, setRenaming] = useState<string | null>(null)
  const [removing, setRemoving] = useState<string | null>(null)
  const [name, setName] = useState('')
  const find = (id: string | null): TeamDepartment | null =>
    manage && id !== null
      ? (data?.departments.find(department => department.id === id) ?? null)
      : null
  const renamingDepartment = find(renaming)
  const removingDepartment = find(removing)
  const renamingGone = data !== null && renaming !== null && !renamingDepartment
  const removingGone = data !== null && removing !== null && !removingDepartment
  // 닫힌 대화상자의 대상을 지운다. 나중에 같은 부서가 다시 목록에 나타나도 대화상자가 저절로 열리지 않게 한다.
  useEffect(() => {
    if (renamingGone) setRenaming(null)
  }, [renamingGone])
  useEffect(() => {
    if (removingGone) setRemoving(null)
  }, [removingGone])
  return {
    renamingDepartment,
    removingDepartment,
    name,
    setName,
    openRename: (department: TeamDepartment) => {
      setName(department.name)
      setRenaming(department.id)
    },
    openRemove: (department: TeamDepartment) => setRemoving(department.id),
    closeRename: () => setRenaming(null),
    closeRemove: () => setRemoving(null),
  }
}
