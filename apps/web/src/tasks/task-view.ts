import { TASK_STATUS_LABELS, type EventSummary, type MyTasksResponse, type TaskHistoryEntry, type TaskStatus, type TaskSummary } from '@vada/contracts'

export const statusLabels = TASK_STATUS_LABELS
// 카드의 빠른 버튼. 완료한 업무에는 없다.
export const nextStatus: Partial<Record<TaskStatus, { status: TaskStatus; label: string }>> = {
  todo: { status: 'doing', label: '시작' }, doing: { status: 'done', label: '완료' } }
export const isOpen = (task: Pick<TaskSummary, 'status'>) => task.status !== 'done'
// 지연: 완료가 아니고 마감일이 한국 날짜로 오늘보다 앞이다. 마감일 당일은 지연이 아니다.
export const isOverdue = (task: Pick<TaskSummary, 'status' | 'dueOn'>, today: string) => isOpen(task) && task.dueOn !== null && task.dueOn < today
// 2026-10-20 → 10.20
export const dueText = (day: string) => `${Number(day.slice(5, 7))}.${Number(day.slice(8, 10))}`
const dayNumber = (day: string) => Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10))) / 86_400_000
// 행사 시작일(한국 날짜)과 오늘의 차이
export function dDayText(startsAt: string | null, today: string) {
  if (startsAt === null) return null
  const diff = dayNumber(startsAt.slice(0, 10)) - dayNumber(today)
  return diff === 0 ? 'D-DAY' : diff > 0 ? `D-${diff}` : `D+${-diff}`
}
// 서버와 같은 순서: 마감일 순(없으면 뒤), 그다음 만든 순
export const sortByDue = (tasks: TaskSummary[]) => [...tasks].sort((a, b) =>
  (a.dueOn ?? '9999').localeCompare(b.dueOn ?? '9999') || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))

export type TaskFilter = 'overdue' | 'unassigned' | 'mine'
export const filterLabels: Record<TaskFilter, string> = { overdue: '지연', unassigned: '담당자 없음', mine: '내 담당' }
// 거르기는 끝나지 않은 업무만 남긴다.
export function matchesFilter(task: TaskSummary, filter: TaskFilter | null, today: string, viewerMembershipId: string) {
  if (filter === null) return true
  if (!isOpen(task)) return false
  if (filter === 'overdue') return isOverdue(task, today)
  if (filter === 'unassigned') return task.assignee === null
  return task.assignee?.membershipId === viewerMembershipId
}
// 옆 메뉴 "내 업무"의 수. 지연이 있으면 지연 수(빨강), 없으면 할 일 수, 할 일이 없으면 없다.
export function taskBadge(data: Pick<MyTasksResponse, 'open'> | null, today: string): { tone: 'danger' | 'info'; text: string } | null {
  if (!data || data.open.length === 0) return null
  const overdue = data.open.filter(task => isOverdue(task, today)).length
  return overdue ? { tone: 'danger', text: `지연 ${overdue}` } : { tone: 'info', text: String(data.open.length) }
}
export function taskCounts(tasks: TaskSummary[], today: string, viewerMembershipId: string) {
  const count = (filter: TaskFilter) => tasks.filter(task => matchesFilter(task, filter, today, viewerMembershipId)).length
  return { total: tasks.length, done: tasks.filter(task => !isOpen(task)).length, overdue: count('overdue'), unassigned: count('unassigned'),
    mine: count('mine') }
}

export type ScheduleItem = { key: string; date: string; kind: 'event' | 'deadline' | 'task'; title: string; note: string | null; task: TaskSummary | null }
const kindOrder: Record<ScheduleItem['kind'], number> = { event: 0, deadline: 1, task: 2 }
// 행사 일시, 참가 신청 마감, 마감일이 있는 업무를 날짜순으로. 같은 날은 행사 → 신청 마감 → 업무 순이다.
export function scheduleOf(tasks: TaskSummary[], event: Pick<EventSummary, 'name' | 'startsAt' | 'endsAt'>, registrationClosesAt: string | null) {
  const items: ScheduleItem[] = []
  if (event.startsAt) {
    const start = event.startsAt.slice(11)
    const sameDay = event.endsAt !== null && event.endsAt.slice(0, 10) === event.startsAt.slice(0, 10)
    const note = event.endsAt === null ? start : sameDay ? `${start}~${event.endsAt.slice(11)}`
      : `${start} ~ ${dueText(event.endsAt.slice(0, 10))} ${event.endsAt.slice(11)}`
    items.push({ key: 'event', date: event.startsAt.slice(0, 10), kind: 'event', title: event.name, note, task: null })
  }
  if (registrationClosesAt) items.push({ key: 'deadline', date: registrationClosesAt.slice(0, 10), kind: 'deadline', title: '참가 신청 마감',
    note: registrationClosesAt.slice(11), task: null })
  for (const task of tasks) if (task.dueOn) items.push({ key: task.id, date: task.dueOn, kind: 'task', title: task.title, note: null, task })
  return items.sort((a, b) => a.date.localeCompare(b.date) || kindOrder[a.kind] - kindOrder[b.kind])
}
export function groupByDate(items: ScheduleItem[]) {
  const groups: { date: string; items: ScheduleItem[] }[] = []
  for (const item of items) {
    const last = groups.at(-1)
    if (last?.date === item.date) last.items.push(item)
    else groups.push({ date: item.date, items: [item] })
  }
  return groups
}

const fieldLabels: Record<string, string> = { title: '제목', department: '담당 부서', assignee: '담당자', dueOn: '마감일' }
function valueText(key: string, value: unknown) {
  if (value === null || value === undefined) return '없음'
  if (key === 'dueOn' && typeof value === 'string') return dueText(value)
  return String(value)
}
// 처리 기록 한 줄. 설명은 길어서 바뀌었다고만 적는다.
export function taskHistoryText(entry: TaskHistoryEntry) {
  if (entry.action === 'created') return '만듦'
  if (entry.action === 'status_changed') {
    const { from, to } = entry.changes.status as { from: TaskStatus; to: TaskStatus }
    return `상태: ${statusLabels[from]} → ${statusLabels[to]}`
  }
  const parts = Object.entries(entry.changes).map(([key, change]) => {
    if (key === 'description') return '설명 고침'
    const { from, to } = change as { from: unknown; to: unknown }
    return `${fieldLabels[key] ?? key} ${valueText(key, from)} → ${valueText(key, to)}`
  })
  return `수정: ${parts.join(' · ')}`
}

export const taskErrors: Record<string, string> = {
  FORBIDDEN: '권한이 없어요. 부서가 있는 구성원만 업무를 바꿀 수 있어요.',
  NOT_FOUND: '업무를 찾을 수 없어요. 새로 불러와 주세요.',
  VERSION_CONFLICT: '다른 곳에서 먼저 바뀌었어요. 새로 불러와 주세요.',
  TASK_DEPARTMENT_INVALID: '담당 부서가 바뀌었어요. 다시 골라 주세요.',
  TASK_ASSIGNEE_INVALID: '담당자로 정할 수 없는 사람이에요. 부서가 있는 구성원을 골라 주세요.',
  TASKS_FULL: '이 행사의 업무가 너무 많아요. 끝난 업무를 지운 뒤 더해 주세요.',
  INVALID_INPUT: '입력값을 확인해 주세요.',
}
export const taskFailure = '처리하지 못했어요. 다시 시도해 주세요.'
export const taskMessage = (code: unknown) => typeof code === 'string' ? taskErrors[code] ?? taskFailure : taskFailure
