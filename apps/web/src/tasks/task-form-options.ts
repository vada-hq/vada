import type {
  EventSummary,
  TaskCreateOptionsResponse,
  TaskDetail,
  TeamResponse,
} from '@vada/contracts'
import { COUNCIL_TASK_LABEL, NO_ASSIGNEE_LABEL, NO_EVENT_LABEL } from './task-view'

// 업무 상세의 선택지. 만들기의 선택지는 서버가 준다(tasks/options, DEC-38).
export type Choice = { id: string | null; label: string }

// 선택칸의 값은 글자라 '없음'(null)을 빈 글로 바꿔 오간다.
export const choiceValue = (id: string | null) => id ?? ''
export const choiceId = (value: string) => (value === '' ? null : value)

const councilTask: Choice = { id: null, label: COUNCIL_TASK_LABEL }
const noAssignee: Choice = { id: null, label: NO_ASSIGNEE_LABEL }

// 상세에서 부서를 바꿀 때: 모든 부서와 '학생회 업무'다(회장단만 이 동작을 받는다).
export const detailDepartmentChoices = (team: TeamResponse): Choice[] => [
  ...team.departments.map(item => ({ id: item.id, label: item.name })),
  councilTask,
]

// 상세에서 담당자를 바꿀 때: 그 업무 부서의 부서원을 먼저, 그다음 나머지, 마지막에 '담당자 없음'이다.
export function detailAssigneeChoices(
  team: TeamResponse,
  task: Pick<TaskDetail, 'department'>,
): Choice[] {
  const departmentId = task.department?.id
  const inDepartment = (member: TeamResponse['members'][number]) =>
    departmentId !== undefined && member.departments.some(item => item.id === departmentId)
  const toChoice = (member: TeamResponse['members'][number]): Choice => ({
    id: member.id,
    label: member.name,
  })
  return [
    ...team.members.filter(inDepartment).map(toChoice),
    ...team.members.filter(member => !inDepartment(member)).map(toChoice),
    noAssignee,
  ]
}

export type LinkableEvents = TaskCreateOptionsResponse['linkableEvents']

// 고치기에서 고를 행사: 그 업무의 부서로 이을 수 있는 행사만이다(서버가 만들기·행사 바꾸기와 같은 판정으로 셌다, DEC-94).
// 선택지에 없는 부서는 이을 행사가 없다. 지금 이은 행사는 eventChoices가 남긴다.
export function linkableEventsOf(
  events: EventSummary[],
  linkable: LinkableEvents,
  departmentId: string | null,
) {
  const ids = new Set(linkable.find(item => item.departmentId === departmentId)?.eventIds)
  return events.filter(item => ids.has(item.id))
}

// 행사 고르기: '행사 없음'과 행사들. 지금 이은 행사가 목록에 없으면(목록이 넘쳤거나 읽기 전) 맨 뒤에 더한다.
export function eventChoices(
  events: Pick<EventSummary, 'id' | 'name'>[],
  current: { id: string; name: string } | null,
) {
  const listed = events.map((item): Choice => ({ id: item.id, label: item.name }))
  const missing = current !== null && !events.some(item => item.id === current.id)
  return [
    { id: null, label: NO_EVENT_LABEL },
    ...listed,
    ...(missing ? [{ id: current.id, label: current.name }] : []),
  ]
}
