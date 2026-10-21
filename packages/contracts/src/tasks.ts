import { z } from 'zod'
import { EmptyRequestSchema, text } from './input.js'
import { koreanDate } from './korean-time.js'
import type { Action } from './permissions.js'
import { recordIdInput } from './team.js'

// 업무(DEC-22, DEC-39). 상태는 셋이고 새 업무는 할 일이다. 값은 DB CHECK와 같다.
export const TASK_STATUSES = ['todo', 'in_progress', 'done'] as const
export type TaskStatus = (typeof TASK_STATUSES)[number]
export const TASK_TITLE_MAX = 100
export const TASK_BODY_MAX = 1000
// 목록 상한: 끝나지 않은 것은 300개, 끝남은 50개. 넘치면 truncated다.
export const TASK_OPEN_LIMIT = 300
export const TASK_DONE_LIMIT = 50

export const TASK_VIEWS = ['mine', 'all', 'unassigned'] as const
export type TaskView = (typeof TASK_VIEWS)[number]
export const TASK_FILTERS = ['open', 'done'] as const
export type TaskFilter = (typeof TASK_FILTERS)[number]

// 업무 목록의 쿼리. 모르는 키와 틀린 값은 400이다. 같은 키를 두 번 주는 것은 서버가 먼저 막는다.
export const TaskListQuerySchema = z.strictObject({
  view: z.enum(TASK_VIEWS),
  status: z.enum(TASK_FILTERS).default('open'),
})
export type TaskListQuery = z.infer<typeof TaskListQuerySchema>

// 업무마다 서버가 주는 할 수 있는 동작. 화면은 이것으로 버튼을 보이거나 숨기고 권한을 다시 계산하지 않는다(DEC-38).
export const TASK_ACTIONS = [
  'task.manage',
  'task.set_department',
  'task.assign',
  'task.status',
] as const satisfies readonly Action[]
export type TaskAction = (typeof TASK_ACTIONS)[number]

export interface TaskPerson {
  id: string
  name: string
  // 지금 이 학생회의 운영진인가. false이면 떠난 사람이다.
  current: boolean
}

export interface TaskSummary {
  id: string
  title: string
  status: TaskStatus
  // 마감일(한국 날짜 YYYY-MM-DD). 마감이 없으면 null이다.
  dueDate: string | null
  // 끝나지 않았고 오늘(한국)이 마감일 뒤일 때만 참이다. 서버가 센다.
  overdue: boolean
  department: { id: string; name: string } | null
  assignee: TaskPerson | null
  actions: TaskAction[]
}

// 판 사이에 바뀐 칸 하나. 내용은 값 없이 '고침'만 알리고, 부서와 사람은 지금 이름이다(name이 null이면 없앤 부서이거나 없는 사람).
export type TaskChange =
  | { field: 'created' }
  | { field: 'title'; from: string; to: string }
  | { field: 'body' }
  | { field: 'dueDate'; from: string | null; to: string | null }
  | { field: 'status'; from: TaskStatus; to: TaskStatus }
  | {
      field: 'department' | 'assignee'
      from: { id: string; name: string | null } | null
      to: { id: string; name: string | null } | null
    }

export interface TaskVersion {
  versionNo: number
  // 이 판이 열린 시각(ISO)
  at: string
  by: { id: string; name: string } | null
  changes: TaskChange[]
}

export interface TaskDetail extends TaskSummary {
  body: string | null
  createdBy: { id: string; name: string } | null
  createdAt: string
  // 오래된 판부터 모두
  history: TaskVersion[]
}

export interface TasksResponse {
  tasks: TaskSummary[]
  truncated: boolean
}
export interface TaskResponse {
  task: TaskDetail
}

const dueDate = koreanDate

// 업무 만들기. 부서와 담당자와 마감과 내용은 비울 수 있고 비우면 null이다.
export const CreateTaskSchema = z.strictObject({
  title: text(TASK_TITLE_MAX),
  body: text(TASK_BODY_MAX).nullable().default(null),
  dueDate: dueDate.nullable().default(null),
  departmentId: recordIdInput.nullable().default(null),
  assigneeId: recordIdInput.nullable().default(null),
})
export type CreateTaskRequest = z.infer<typeof CreateTaskSchema>
// 제목, 내용, 마감 고치기. 세 칸을 모두 받아 그대로 바꾼다(비운 칸은 null).
export const UpdateTaskSchema = z.strictObject({
  title: text(TASK_TITLE_MAX),
  body: text(TASK_BODY_MAX).nullable(),
  dueDate: dueDate.nullable(),
})
export type UpdateTaskRequest = z.infer<typeof UpdateTaskSchema>
export const ChangeTaskStatusSchema = z.strictObject({ status: z.enum(TASK_STATUSES) })
export type ChangeTaskStatusRequest = z.infer<typeof ChangeTaskStatusSchema>
// 업무 지우기는 본문이 없다.
export const DeleteTaskSchema = EmptyRequestSchema
// 맡기기와 부서 정하기. 비우려면 null을 보낸다(키를 빼면 400).
export const AssignTaskSchema = z.strictObject({ assigneeId: recordIdInput.nullable() })
export type AssignTaskRequest = z.infer<typeof AssignTaskSchema>
export const SetTaskDepartmentSchema = z.strictObject({ departmentId: recordIdInput.nullable() })
export type SetTaskDepartmentRequest = z.infer<typeof SetTaskDepartmentSchema>
