import { z } from 'zod'
import { text, token } from './input.js'
import { PURCHASE_INTEGER_MAX, purchaseDate } from './purchases.js'

// 업무 칸의 상한. DB CHECK(0024)와 같은 값이다.
export const TASK_TITLE_MAX = 100
export const TASK_DESCRIPTION_MAX = 1000
// 행사마다 업무 수 상한. 보드를 한 번에 그린다.
export const TASKS_PER_EVENT_MAX = 300
// 내 업무가 한 번에 보이는 수. 할 일이 더 많으면 truncated다.
export const MY_TASKS_OPEN_LIMIT = 300
export const MY_TASKS_DONE_LIMIT = 50
export const TASK_STATUSES = ['todo', 'doing', 'done'] as const
export type TaskStatus = typeof TASK_STATUSES[number]
export const TASK_STATUS_LABELS: Record<TaskStatus, string> = { todo: '예정', doing: '진행 중', done: '완료' }
export type TaskAction = 'created' | 'updated' | 'status_changed'

const id = token(64)
const version = z.number().int().min(1).max(PURCHASE_INTEGER_MAX)
// 마감일. 달력에 있는 날짜이고, DB 검사와 같은 범위만 받는다.
const taskDate = purchaseDate.refine(value => value >= '2000-01-01' && value <= '2999-12-31')
const fields = {
  title: text(TASK_TITLE_MAX),
  description: text(TASK_DESCRIPTION_MAX).nullable(),
  departmentId: id.nullable(),
  // 같은 학생회에서 부서가 있는 구성원(memberships.id)만 받는다. 서버가 사용자로 바꿔 저장한다.
  assigneeMembershipId: id.nullable(),
  dueOn: taskDate.nullable(),
}
// 새 업무는 늘 예정이다.
export const CreateTaskSchema = z.strictObject(fields)
// 수정은 모든 칸을 다시 보낸다.
export const UpdateTaskSchema = z.strictObject({ version, ...fields })
export const ChangeTaskStatusSchema = z.strictObject({ version, status: z.enum(TASK_STATUSES) })
export const DeleteTaskSchema = z.strictObject({ version })

export type CreateTaskRequest = z.infer<typeof CreateTaskSchema>
export type UpdateTaskRequest = z.infer<typeof UpdateTaskSchema>
export type ChangeTaskStatusRequest = z.infer<typeof ChangeTaskStatusSchema>
export type DeleteTaskRequest = z.infer<typeof DeleteTaskSchema>

export interface TaskPerson { id: string; name: string }
export interface TaskSummary {
  id: string
  event: { id: string; name: string }
  title: string
  description: string | null
  status: TaskStatus
  department: { id: string; name: string } | null
  // 담당자의 소속 ID와 이름. 화면은 소속 ID로 내 담당을 가린다.
  assignee: { membershipId: string; name: string } | null
  // 한국 날짜 YYYY-MM-DD
  dueOn: string | null
  completedAt: string | null
  createdBy: TaskPerson
  createdAt: string
  version: number
}
export interface TaskHistoryEntry {
  id: string
  action: TaskAction
  actor: TaskPerson
  changes: Record<string, unknown>
  createdAt: string
}
export interface TaskDetail extends TaskSummary { history: TaskHistoryEntry[] }
export interface TaskResponse { task: TaskDetail }
export interface EventTasksResponse {
  // 마감일 순(없으면 뒤), 그다음 만든 순
  tasks: TaskSummary[]
  // 참가 신청 마감(한국 시각 YYYY-MM-DDTHH:mm). 참가 신청이 없으면 null이다.
  registrationClosesAt: string | null
}
export interface MyTasksResponse {
  // 예정·진행 중. 마감일 순(없으면 뒤)
  open: TaskSummary[]
  // 최근 완료 순
  done: TaskSummary[]
  // 할 일이 MY_TASKS_OPEN_LIMIT보다 많은지
  truncated: boolean
}
