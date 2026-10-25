import {
  TASK_STATUSES,
  UpdateTaskSchema,
  type EventSummary,
  type TaskAction,
  type TaskSummary,
  type TeamResponse,
} from '@vada/contracts'
import {
  choiceValue,
  detailAssigneeChoices,
  detailDepartmentChoices,
  eventChoices,
  linkableEventsOf,
  type Choice,
  type LinkableEvents,
} from './task-form-options'
import { TASK_CONTRACT_MESSAGES } from './task-fields'
import { requiredText, withContract } from '@/lib/use-form-check'
import { STATUS_LABEL } from './task-view'

export type Column = 'title' | 'status' | 'assignee' | 'due' | 'department' | 'event'
// 칸에서 고르는 것 넷. 제목과 마감은 글 칸이라 따로 다룬다(TextField).
export type CellField = 'status' | 'assignee' | 'department' | 'event'

export type TextField = 'title' | 'dueDate'

export const COLUMN_LABEL: Record<Column, string> = {
  title: '제목',
  status: '상태',
  assignee: '담당자',
  due: '마감',
  department: '부서',
  event: '행사',
}

// 열 너비. 제목이 남는 폭을 쓰되 하한을 두고, 나머지는 내용 폭만큼이다(w-px는 표가 내용만큼만 넓히게 한다).
export const columnWidth = (column: Column): string =>
  column === 'title' ? 'min-w-40' : 'w-px whitespace-nowrap'

// 행사의 업무 탭은 행사 열이 없다.
export const columnsOf = (inEvent: boolean): Column[] => [
  'title',
  'status',
  'assignee',
  'due',
  'department',
  ...(inEvent ? [] : (['event'] as const)),
]

// 서버가 준 actions대로만 고를 수 있다(DEC-38). 행사는 제목·마감과 같은 task.edit다.
const ACTION: Record<CellField, TaskAction> = {
  status: 'task.change_status',
  assignee: 'task.change_assignee',
  department: 'task.change_department',
  event: 'task.edit',
}

export const isCellField = (column: Column): column is CellField =>
  column === 'status' || column === 'assignee' || column === 'department' || column === 'event'

// linkable은 부서마다 이을 수 있는 행사다(만들기 선택지 응답, DEC-94). 행사 칸은 이것과 행사 목록을 다 읽은 뒤 고른다.
export type Lookups = {
  team: TeamResponse | null
  events: EventSummary[] | null
  linkable: LinkableEvents | null
}

// 지금 값이 선택지에 없으면(떠난 담당자, 지운 부서, 목록이 넘친 행사) 그 값을 맨 앞에 더해 보이게 한다.
function withCurrent(choices: Choice[], current: Choice | null): Choice[] {
  if (current === null || choices.some(item => item.id === current.id)) return choices
  return [current, ...choices]
}

function choicesOfField(task: TaskSummary, field: CellField, lookups: Lookups): Choice[] | null {
  const { team, events, linkable } = lookups
  if (field === 'status')
    return TASK_STATUSES.map(status => ({ id: status, label: STATUS_LABEL[status] }))
  if (field === 'assignee') {
    if (!team) return null
    const gone = task.assignee && {
      id: task.assignee.id,
      label: task.assignee.current ? task.assignee.name : `떠난 사람: ${task.assignee.name}`,
    }
    return withCurrent(detailAssigneeChoices(team, task), gone)
  }
  if (field === 'department') {
    if (!team) return null
    const current = task.department && { id: task.department.id, label: task.department.name }
    return withCurrent(detailDepartmentChoices(team), current)
  }
  return eventCellChoices(task, events, linkable)
}

// 행사 칸: 그 업무의 부서로 이을 수 있는 행사만이다(DEC-94). 둘 다 읽기 전에는 null이다.
function eventCellChoices(
  task: TaskSummary,
  events: EventSummary[] | null,
  linkable: LinkableEvents | null,
) {
  if (!events || !linkable) return null
  return eventChoices(linkableEventsOf(events, linkable, task.department?.id ?? null), task.event)
}

// 고를 수 있으면 선택지, 아니면 null(글자로 보이고 aria-readonly다). 선택지를 읽기 전에도 null이다.
export function cellChoices(task: TaskSummary, field: CellField, lookups: Lookups) {
  if (!task.actions.includes(ACTION[field])) return null
  return choicesOfField(task, field, lookups)
}

export function cellValue(task: TaskSummary, field: CellField): string {
  if (field === 'status') return task.status
  if (field === 'assignee') return choiceValue(task.assignee?.id ?? null)
  if (field === 'department') return choiceValue(task.department?.id ?? null)
  return choiceValue(task.event?.id ?? null)
}

// 글 칸의 열이 고치는 요청의 키. 글 칸이 아닌 열은 null이다.
export const textFieldOf = (column: Column): TextField | null =>
  column === 'title' ? 'title' : column === 'due' ? 'dueDate' : null

// 고칠 수 있는 칸인가. 제목·마감은 task.edit, 그 밖은 서버가 준 동작과 선택지가 있을 때다.
export function isEditable(task: TaskSummary, column: Column, lookups: Lookups) {
  if (textFieldOf(column)) return task.actions.includes('task.edit')
  return isCellField(column) && cellChoices(task, column, lookups) !== null
}

// 보내기 전에 잡는 글 칸의 문제(빈 제목, 100자 넘음, 마감 형식). 문제가 없으면 null이다.
export function textProblem(field: TextField, raw: string): string | null {
  const value = field === 'dueDate' && raw === '' ? null : raw
  const required = field === 'title' ? { title: requiredText(raw, '제목을') } : {}
  const found = withContract(
    required,
    UpdateTaskSchema.safeParse({ [field]: value }),
    TASK_CONTRACT_MESSAGES,
  )
  return Object.values(found).find(Boolean) ?? null
}
