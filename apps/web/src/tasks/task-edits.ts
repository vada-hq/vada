import type { TaskStatus } from '@vada/contracts'
import type { TaskWhere } from './useTaskDetail'

// 업무 상세에서 값 하나를 바꾸는 일. 저장 버튼 없이 고르거나 칸을 떠나면 바로 보낸다(Linear·Jira·GitHub Projects 상세의 관례).
export type TaskEdit =
  | { field: 'status'; status: TaskStatus }
  | { field: 'title'; title: string }
  | { field: 'body'; body: string | null }
  | { field: 'dueDate'; dueDate: string | null }
  | { field: 'event'; eventId: string | null }
  | { field: 'department'; departmentId: string | null }
  | { field: 'assignee'; assigneeId: string | null }

export type EditRequest = { where: TaskWhere; path: string; body: Record<string, unknown> }

// 바꾸는 일 → 있는 업무 API 하나. 제목·내용·마감·행사는 고치기(POST 업무, JSON Merge Patch)에 그 칸 하나만 보낸다.
// 행사는 바꿨을 때만 보내므로 다른 칸을 고칠 때 서버가 행사 권한을 다시 묻지 않는다(DEC-94).
export function editRequest(edit: TaskEdit): EditRequest {
  switch (edit.field) {
    case 'status':
      return { where: 'status', path: '/status', body: { status: edit.status } }
    case 'title':
      return { where: 'title', path: '', body: { title: edit.title } }
    case 'body':
      return { where: 'body', path: '', body: { body: edit.body } }
    case 'dueDate':
      return { where: 'dueDate', path: '', body: { dueDate: edit.dueDate } }
    case 'event':
      return { where: 'event', path: '', body: { eventId: edit.eventId } }
    case 'department':
      return { where: 'department', path: '/department', body: { departmentId: edit.departmentId } }
    case 'assignee':
      return { where: 'assignee', path: '/assignee', body: { assigneeId: edit.assigneeId } }
  }
}
