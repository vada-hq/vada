import { useTeam } from '@/team/useTeam'
import { ChoiceSelect } from '@/tasks/ChoiceSelect'
import { NO_DEPARTMENT } from '@/tasks/task-chip-text'
import type { Choice } from '@/tasks/task-form-options'

type Props = {
  councilId: string
  value: string | null
  // 고치기에서 지금 맡은 부서. 목록을 읽기 전에도 이름이 보이게 한다.
  current?: { id: string; name: string } | null
  disabled: boolean
  onChange: (departmentId: string | null) => void
  onForbidden: () => void
}

// 지금 고른 부서가 목록에 없으면(목록을 읽기 전) 맨 뒤에 더해 선택이 비지 않게 한다.
function departmentChoices(
  departments: readonly { id: string; name: string }[],
  current: { id: string; name: string } | null,
): Choice[] {
  const missing = current !== null && !departments.some(item => item.id === current.id)
  return [
    { id: null, label: NO_DEPARTMENT },
    ...departments.map(item => ({ id: item.id, label: item.name })),
    ...(missing ? [{ id: current.id, label: current.name }] : []),
  ]
}

// 예산 항목의 담당 부서 칸(선택). 맡긴 부서의 부장 홈에 그 항목의 한도가 보인다(대표 10/30).
export function DepartmentField({
  councilId,
  value,
  disabled,
  current = null,
  onChange,
  onForbidden,
}: Props) {
  const team = useTeam(councilId, onForbidden)
  return (
    <ChoiceSelect
      label="담당 부서"
      optional
      choices={departmentChoices(team.data?.departments ?? [], current)}
      value={value}
      disabled={disabled || !team.data}
      onChange={onChange}
    />
  )
}
