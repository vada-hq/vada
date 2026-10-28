import { z } from 'zod'
import { EmptyRequestSchema, text } from './input.js'
import { koreanDate } from './korean-time.js'
import { recordIdInput } from './team.js'

// 업무(DEC-22, DEC-39). 상태는 셋이고 새 업무는 할 일이다. 값은 DB CHECK와 같다.
export const TASK_STATUSES = ['todo', 'in_progress', 'done'] as const
export type TaskStatus = (typeof TASK_STATUSES)[number]
export const TASK_TITLE_MAX = 100
export const TASK_BODY_MAX = 1000
// 목록 상한: 끝나지 않은 것은 300개, 끝남은 50개. 넘치면 truncated다.
export const TASK_OPEN_LIMIT = 300
export const TASK_DONE_LIMIT = 50

// department는 내가 지금 속한 부서(들)가 맡은 업무다.
export const TASK_VIEWS = ['mine', 'department', 'all', 'unassigned'] as const
export type TaskView = (typeof TASK_VIEWS)[number]
export const TASK_FILTERS = ['open', 'done'] as const
export type TaskFilter = (typeof TASK_FILTERS)[number]

// 업무 목록의 쿼리. 모르는 키와 틀린 값은 400이다. 같은 키를 두 번 주는 것은 서버가 먼저 막는다.
export const TaskListQuerySchema = z.strictObject({
  view: z.enum(TASK_VIEWS),
  status: z.enum(TASK_FILTERS).default('open'),
  // none은 행사 없는 업무만, 식별자는 그 행사의 업무만. 다른 학생회 행사는 서버가 404로 답한다.
  event: z.union([recordIdInput, z.literal('none')]).optional(),
})
export type TaskListQuery = z.infer<typeof TaskListQuerySchema>

// 만들기 선택지의 쿼리. event는 그 행사의 업무를 만들 때의 선택지다(책임자는 어느 부서로든 만든다).
export const TaskOptionsQuerySchema = z.strictObject({ event: recordIdInput.optional() })
export type TaskOptionsQuery = z.infer<typeof TaskOptionsQuerySchema>

// 업무마다 서버가 주는 할 수 있는 동작. 이름은 권한 키(permissions.ts)와 떼어 동작 하나에 이름 하나로 둔다(기능 012 원칙): 서버가 권한 키와 짝짓는다(tasks/policy.ts).
// 화면은 이것으로 버튼을 보이거나 숨기고 권한을 다시 계산하지 않는다(DEC-38).
export const TASK_ACTIONS = [
  'task.edit',
  'task.remove',
  'task.change_department',
  'task.change_assignee',
  'task.change_status',
] as const
export type TaskAction = (typeof TASK_ACTIONS)[number]

// 업무에 이어지는 결과물의 종류(DEC-82, DB CHECK와 같다)와 진행 단계(RULE-41). 단계: 없음(살아 있고 일 없음), 진행 중, 끝남, 빠짐(목표 셈에서 뺀다).
const TASK_RESULT_KINDS = ['request', 'registration_form', 'message', 'event'] as const
export type TaskResultKind = (typeof TASK_RESULT_KINDS)[number]
const TASK_RESULT_STAGES = ['none', 'in_progress', 'finished', 'excluded'] as const
export type TaskResultStage = (typeof TASK_RESULT_STAGES)[number]
// 업무 상태가 저절로 바뀐 까닭 코드. 글이 아니라 코드라 문구를 나중에 바꿔도 옛 판이 따라간다. 판의 reason 칸에 남는다.
export const TASK_CAUSES = [
  'request_submitted',
  'request_finished',
  'form_created',
  'notice_posted',
  'event_completed',
] as const
export type TaskCause = (typeof TASK_CAUSES)[number]

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
  // 카드의 다음 단계(할 일 → 진행 중 → 끝남). 끝남이면 null이다. 서버가 정하고 화면은 다시 세지 않는다(DEC-38).
  next: TaskStatus | null
  // 마감일(한국 날짜 YYYY-MM-DD). 마감이 없으면 null이다.
  dueDate: string | null
  // 끝나지 않았고 오늘(한국)이 마감일 뒤일 때만 참이다. 서버가 센다.
  overdue: boolean
  department: { id: string; name: string } | null
  // 이어진 행사. 이름은 지금 이름이다.
  event: { id: string; name: string } | null
  assignee: TaskPerson | null
  actions: TaskAction[]
  // 업무 목록·상세의 결과물 요약(DEC-94). 홈 등 별도 요약 응답과 이전 응답에는 없을 수 있다.
  // 취소한 결과물은 세지 않고, 가장 최근에 바뀐 결과물 한 개만 싣는다.
  latestResult?: { kind: TaskResultKind; stage: TaskResultStage; changedAt: string } | null
  resultCount?: number
}

// 판 사이에 바뀐 칸 하나. 내용은 값 없이 '고침'만 알리고, 부서와 사람은 지금 이름이다(name이 null이면 없앤 부서이거나 없는 사람).
export type TaskChange =
  | { field: 'created' }
  | { field: 'title'; from: string; to: string }
  | { field: 'body' }
  | { field: 'dueDate'; from: string | null; to: string | null }
  | { field: 'status'; from: TaskStatus; to: TaskStatus }
  | {
      field: 'department' | 'assignee' | 'event'
      from: { id: string; name: string | null } | null
      to: { id: string; name: string | null } | null
    }

export interface TaskVersion {
  versionNo: number
  // 이 판이 열린 시각(ISO)
  at: string
  by: { id: string; name: string } | null
  // 저절로 바뀐 판의 까닭 코드. 사람이 바꾼 판은 null이다.
  cause: TaskCause | null
  changes: TaskChange[]
}

// 업무 상세의 결과물 한 줄. 제목은 지금 제목이다. 지운 공지(DEC-54)는 null이고 화면은 '삭제된 메시지'를 보인다.
export interface TaskResult {
  kind: TaskResultKind
  id: string
  title: string | null
  stage: TaskResultStage
  // 결과물을 여는 곳. 신청 양식은 그 양식의 행사(인원 관리 탭)이고, 공지는 올린 방과 그 방의 행사(학생회 공지방이면 null)다.
  // 요청과 행사는 id로 열어 둘 다 null이다. 볼 수 없거나 지운 공지도 null이다(열 곳이 없다).
  eventId: string | null
  roomId: string | null
}

export interface TaskDetail extends TaskSummary {
  body: string | null
  origin: { meetingId: string; meetingTitle: string; agendaId: string; agendaTitle: string } | null
  createdBy: { id: string; name: string } | null
  createdAt: string
  // 이 업무에서 만든 결과물(만든 순)
  results: TaskResult[]
  // 지금 이 업무에서 만들 수 있는 결과물 종류. 서버가 권한과 업무 상태로 셈하고 화면은 다시 세지 않는다(DEC-38).
  canMake: TaskResultKind[]
  // 오래된 판부터 모두
  history: TaskVersion[]
}

export interface TasksResponse {
  tasks: TaskSummary[]
  truncated: boolean
}
// 만들 때 고를 수 있는 (부서, 담당자) 짝. 부서가 null이면 학생회 업무, 담당자가 null이면 담당자 없음이다.
// 서버가 만들기와 같은 판정(tasks/policy.ts)으로 셌으므로 화면은 권한을 다시 셈하지 않고 여기서 고르기만 한다(DEC-38).
interface TaskCreateAssignee {
  id: string | null
  name: string | null
}
interface TaskCreateDepartment {
  id: string | null
  name: string | null
  assignees: TaskCreateAssignee[]
}
// 부서마다 그 부서의 업무를 이을 수 있는 행사(DEC-94). 만들기·행사 바꾸기와 같은 판정(tasks/policy.ts decideEventLink)으로 셌다.
// 고치기의 행사 선택칸은 여기 있는 행사만 보인다. 부서가 null이면 학생회 업무다.
interface TaskLinkableEvents {
  departmentId: string | null
  eventIds: string[]
}
export interface TaskCreateOptionsResponse {
  departments: TaskCreateDepartment[]
  linkableEvents: TaskLinkableEvents[]
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
  eventId: recordIdInput.nullable().default(null),
  agendaItemId: recordIdInput.nullable().optional(),
})
export type CreateTaskRequest = z.infer<typeof CreateTaskSchema>
// 제목, 내용, 마감, 행사 고치기. 보낸 칸만 바꾸고 뺀 칸은 그대로다(JSON Merge Patch).
// 내용·마감·행사는 null이면 비운다. 제목은 비울 수 없다.
export const UpdateTaskSchema = z.strictObject({
  title: text(TASK_TITLE_MAX).optional(),
  body: text(TASK_BODY_MAX).nullable().optional(),
  dueDate: dueDate.nullable().optional(),
  eventId: recordIdInput.nullable().optional(),
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
