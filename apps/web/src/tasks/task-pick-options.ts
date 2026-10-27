import type { EventSummary, TaskDetail, TeamResponse } from '@vada/contracts'
import type { Option } from '@/components/ui/option-list'
import { departmentColorOf } from './department-color'
import { eventChoices } from './task-form-options'
import { COUNCIL_TASK_LABEL, NO_ASSIGNEE_LABEL } from './task-view'

// 업무 상세의 고르기 창 선택지. 권한은 서버가 준 actions로 이미 갈랐고, 여기서는 고를 목록만 만든다(DEC-38).
const OTHER_MEMBERS = '다른 운영진'

// 담당 부서: 모든 부서(부서 색 점)와 맨 뒤 '학생회 업무'다(지금 [바꾸기]와 같은 목록).
export function departmentOptions(team: TeamResponse): Option[] {
  return [
    ...team.departments.map(item => ({
      id: item.id,
      label: item.name,
      dot: departmentColorOf(item.id, team.departments).dot,
    })),
    { id: null, label: COUNCIL_TASK_LABEL, dot: departmentColorOf(null, []).dot },
  ]
}

// 담당자: 업무 부서의 부서원을 먼저(그 부서 이름으로 묶음), 그다음 다른 운영진, 맨 뒤 '담당자 없음'이다.
// 사람 이름 옆에는 첫 부서 이름을 흐리게 둬 같은 이름을 가른다.
export function assigneeOptions(
  team: TeamResponse,
  task: Pick<TaskDetail, 'department'>,
): Option[] {
  const departmentId = task.department?.id
  const nameOf = new Map(team.departments.map(item => [item.id, item.name]))
  const inDepartment = (member: TeamResponse['members'][number]) =>
    departmentId !== undefined && member.departments.some(item => item.id === departmentId)
  const toOption = (member: TeamResponse['members'][number], group: string): Option => ({
    id: member.id,
    label: member.name,
    hint: nameOf.get(member.departments[0]?.id ?? ''),
    group,
  })
  const own = team.members.filter(inDepartment)
  return [
    ...own.map(member => toOption(member, task.department?.name ?? '')),
    ...team.members
      .filter(member => !inDepartment(member))
      .map(member => toOption(member, own.length > 0 ? OTHER_MEMBERS : '')),
    { id: null, label: NO_ASSIGNEE_LABEL },
  ].map(option => (option.group === '' ? { ...option, group: undefined } : option))
}

// 행사: '행사 없음'과 이 업무의 부서로 이을 수 있는 행사(지금 [고치기]의 선택칸과 같은 목록, DEC-94).
export const eventOptions = (
  events: Pick<EventSummary, 'id' | 'name'>[],
  current: TaskDetail['event'],
): Option[] => eventChoices(events, current)
