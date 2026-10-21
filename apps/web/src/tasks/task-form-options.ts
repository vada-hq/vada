import type { CouncilView, TaskDetail, TeamResponse } from '@vada/contracts'
import { COUNCIL_TASK_LABEL, NO_ASSIGNEE_LABEL } from './task-view'

// 업무 폼의 선택지. 서버가 준 권한 목록과 내 부서 직급으로만 좁히고, 권한표를 다시 만들지 않는다(DEC-38).
// 서버가 마지막에 다시 검사하므로 여기서 놓친 경우도 403·409로 막힌다.
export type Choice = { id: string | null; label: string }

const ME_LABEL = '나'

// 선택칸의 값은 글자라 '없음'(null)을 빈 글로 바꿔 오간다.
export const choiceValue = (id: string | null) => id ?? ''
export const choiceId = (value: string) => (value === '' ? null : value)

const councilTask: Choice = { id: null, label: COUNCIL_TASK_LABEL }
const noAssignee: Choice = { id: null, label: NO_ASSIGNEE_LABEL }

// 회장단은 부서를 정할 수 있는 칸(task.set_department)을 받는다.
const isLeadership = (view: CouncilView) => view.permissions.includes('task.set_department')

const headsDepartment = (view: CouncilView, departmentId: string | null) =>
  departmentId !== null &&
  view.me.departments.some(item => item.id === departmentId && item.rank !== null)

// 만들 때 고를 수 있는 부서. '학생회 업무'(부서 없음)는 맨 뒤다.
export function departmentChoices(view: CouncilView, team: TeamResponse): Choice[] {
  const departments = isLeadership(view)
    ? team.departments.map(item => ({ id: item.id, label: item.name }))
    : view.me.departments.map(item => ({ id: item.id, label: item.name }))
  return [...departments, councilTask]
}

// 만들 때 고를 수 있는 담당자. 회장단과 고른 부서의 부장은 모든 지금 운영진과 '담당자 없음', 그 밖은 '나'만이다.
export function assigneeChoices(
  view: CouncilView,
  team: TeamResponse,
  departmentId: string | null,
): Choice[] {
  if (isLeadership(view) || headsDepartment(view, departmentId))
    return [noAssignee, ...team.members.map(item => ({ id: item.id, label: item.name }))]
  return [{ id: view.me.memberId, label: ME_LABEL }]
}

// 처음 고른 부서. 회장단은 부서 없이, 그 밖은 내 첫 부서(없으면 부서 없음)다.
export function defaultDepartmentId(view: CouncilView): string | null {
  if (isLeadership(view)) return null
  return view.me.departments[0]?.id ?? null
}

// 부서를 바꾸면 담당자 선택지도 바뀐다. 고르던 사람이 선택지에 없으면 첫 선택지로 돌린다.
export function keepAssignee(choices: Choice[], assigneeId: string | null): string | null {
  return choices.some(item => item.id === assigneeId) ? assigneeId : (choices[0]?.id ?? null)
}

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
