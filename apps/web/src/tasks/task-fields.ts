import type { TaskDetail } from '@vada/contracts'
import { DATE_CHECK } from '@/lib/messages'
import { requiredText } from '@/lib/use-form-check'

// 만들기와 고치기 폼이 같이 쓰는 세 칸. 입력칸 값은 글자라 비운 칸은 빈 글이고, 요청으로 바꿀 때 null이 된다.
export type TaskFieldValues = { title: string; body: string; dueDate: string }

export const emptyFields: TaskFieldValues = { title: '', body: '', dueDate: '' }

export const fieldsOf = (
  task: Pick<TaskDetail, 'title' | 'body' | 'dueDate'>,
): TaskFieldValues => ({
  title: task.title,
  body: task.body ?? '',
  dueDate: task.dueDate ?? '',
})

// 공백뿐인 내용은 비운 것으로 본다(계약은 내용이 있으면 공백뿐인 글을 받지 않는다).
export const fieldsRequest = (values: TaskFieldValues) => ({
  title: values.title,
  body: values.body.trim() === '' ? null : values.body,
  dueDate: values.dueDate === '' ? null : values.dueDate,
})

// 만들기 요청. 부서·담당자·행사는 폼의 다른 칸에서 온다.
export const createRequest = (
  values: TaskFieldValues,
  departmentId: string | null,
  assigneeId: string | null,
  eventId: string | null,
) => ({ ...fieldsRequest(values), departmentId, assigneeId, eventId })

// 값이 빈 필수 칸(꺼진 버튼의 이유). 만들기와 고치기 모두 제목만 필수다.
export const taskErrors = (values: TaskFieldValues) => ({
  title: requiredText(values.title, '제목을'),
})

// 계약이 막은 마감(기수 밖 등)은 길이 문제가 아니므로 글을 따로 준다.
export const TASK_CONTRACT_MESSAGES = { dueDate: DATE_CHECK }
