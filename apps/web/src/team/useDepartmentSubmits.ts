import type { FormEvent } from 'react'
import {
  CreateDepartmentSchema,
  UpdateDepartmentSchema,
  type TeamDepartment,
} from '@vada/contracts'
import { isFinal, type useDepartmentRequests } from './useDepartmentRequests'
import type { useDepartmentDialogs } from './useDepartmentDialogs'
import { isUsedDepartment } from './team-view'

const departmentPath = (department: TeamDepartment) =>
  `/departments/${encodeURIComponent(department.id)}`

// 부서 만들기, 이름 바꾸기, 없애기·그만 쓰기, 재정 역할 주고 거두기를 보낸다. 버튼은 서버와 같은 스키마로 판단하고, 저장 중에는 보내지 않는다.
// 성공했거나 다시 보내도 소용없는 오류면 대화상자를 닫는다.
export function useDepartmentSubmits(
  saving: boolean,
  requests: ReturnType<typeof useDepartmentRequests>,
  dialogs: ReturnType<typeof useDepartmentDialogs>,
  // 목록을 다시 읽는다. 그사이 쓰인 부서라 없애지 못했으면 다시 읽어 '그만 쓰기'를 보인다.
  reload: () => void,
) {
  const { renamingDepartment, removingDepartment, name } = dialogs
  const renamed = renamingDepartment
    ? UpdateDepartmentSchema.safeParse({ name, role: renamingDepartment.role })
    : null
  // 만들었으면 true. 이름이 스키마에 맞지 않거나 저장 중이면 보내지 않는다.
  async function create(newName: string) {
    const parsed = CreateDepartmentSchema.safeParse({ name: newName })
    if (!parsed.success || saving) return false
    return (await requests.run('/departments', parsed.data, 'create')) === null
  }
  async function rename(event: FormEvent) {
    event.preventDefault()
    if (!renamingDepartment || !renamed?.success || saving) return
    const code = await requests.run(departmentPath(renamingDepartment), renamed.data, 'rename')
    if (code === null || isFinal(code)) dialogs.closeRename()
  }
  async function remove() {
    if (!removingDepartment || saving) return
    // 쓴 부서는 그만 쓰고(기록과 지난 기간 보기는 남는다), 쓰이지 않은 부서는 지운다.
    const action = isUsedDepartment(removingDepartment) ? 'retire' : 'delete'
    const code = await requests.run(`${departmentPath(removingDepartment)}/${action}`, {}, 'remove')
    if (code === null || isFinal(code)) dialogs.closeRemove()
    if (code === 'DEPARTMENT_IN_USE') reload()
  }
  // 재정 역할 주고 거두기. 이름과 함께 보낸다(UpdateDepartmentSchema).
  function toggleFinance(department: TeamDepartment) {
    void requests.run(
      departmentPath(department),
      { name: department.name, role: department.role === 'finance' ? null : 'finance' },
      'list',
    )
  }
  return { create, rename, remove, toggleFinance }
}
