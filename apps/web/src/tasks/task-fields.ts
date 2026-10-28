import { DATE_CHECK } from '@/lib/messages'
import { requiredText } from '@/lib/use-form-check'
import type { TaskCreateOptionsResponse } from '@vada/contracts'
import {
  defaultPlacement,
  selectAssignee,
  type Placement,
  type QuickAddContext,
} from './task-defaults'

// 만들기 폼의 세 칸. 입력칸 값은 글자라 비운 칸은 빈 글이고, 요청으로 바꿀 때 null이 된다.
export type TaskFieldValues = { title: string; body: string; dueDate: string }

export const emptyFields: TaskFieldValues = { title: '', body: '', dueDate: '' }

export type TaskCreateValues = TaskFieldValues & Placement & { eventId: string | null }
export type TaskCreateInitial = Partial<TaskCreateValues>

// 행사 탭의 행사는 그 행사로 읽은 선택지이므로 목록 상한에서 빠져도 남긴다.
export function allowedCreateEvent(
  options: TaskCreateOptionsResponse,
  departmentId: string | null,
  eventId: string | null,
  contextEvent: string | undefined,
) {
  if (eventId === contextEvent) return eventId
  const ids = options.linkableEvents.find(item => item.departmentId === departmentId)?.eventIds
  return eventId !== null && ids?.includes(eventId) ? eventId : null
}

function initialPlacement(
  options: TaskCreateOptionsResponse,
  context: QuickAddContext,
  initial: TaskCreateInitial,
): Placement {
  const placement = defaultPlacement(options, context)
  const departmentId =
    initial.departmentId === undefined ? placement?.departmentId : initial.departmentId
  const department =
    options.departments.find(item => item.id === departmentId) ??
    options.departments.find(item => item.id === placement?.departmentId)
  if (!department) return { departmentId: null, assigneeId: null }
  const wanted = context.taskView === 'mine' ? context.view.me.memberId : null
  const assignee = department.assignees.find(item => item.id === initial.assigneeId)
  return {
    departmentId: department.id,
    assigneeId: assignee
      ? assignee.id
      : selectAssignee(department.assignees, wanted, context.view.me.memberId),
  }
}

// 기본값과 미리 채운 값도 서버의 만들기 선택지 안에서만 고른다.
export function initialCreateValues(
  options: TaskCreateOptionsResponse,
  context: QuickAddContext,
  initial: TaskCreateInitial,
): TaskCreateValues {
  const placement = initialPlacement(options, context, initial)
  const eventId = initial.eventId === undefined ? (context.eventId ?? null) : initial.eventId
  return {
    ...emptyFields,
    ...initial,
    ...placement,
    eventId: allowedCreateEvent(options, placement.departmentId, eventId, context.eventId),
  }
}

// 공백뿐인 내용은 비운 것으로 본다(계약은 내용이 있으면 공백뿐인 글을 받지 않는다).
const fieldsRequest = (values: TaskFieldValues) => ({
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

// 누를 때 확인하는 필수 칸. 제목만 필수다.
export const taskErrors = (values: TaskFieldValues) => ({
  title: requiredText(values.title, '제목을'),
})

// 계약이 막은 마감(기수 밖 등)은 길이 문제가 아니므로 글을 따로 준다.
export const TASK_CONTRACT_MESSAGES = { dueDate: DATE_CHECK }
