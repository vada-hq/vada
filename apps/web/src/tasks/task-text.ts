import type { TaskCause, TaskChange, TaskStatus, TaskVersion, TaskView } from '@vada/contracts'
import { monthDay, monthDayTime } from '@/lib/korean-date-text'
import { COUNCIL_TASK_LABEL, STATUS_LABEL } from './task-view'

const NONE = '없음'
export const TASK_ORIGIN_LABEL = '나온 곳'
const UNKNOWN_PERSON = '알 수 없는 사람'
const UNKNOWN_EVENT = '알 수 없는 행사'
const REMOVED_DEPARTMENT = '없앤 부서'

export const TASK_CREATE_TEXT = {
  title: '업무 추가',
  definition: '업무 정의',
  assignment: '담당·일정',
  context: '연결 맥락',
  taskTitle: '제목',
  body: '설명',
  department: '담당 부서',
  assignee: '담당자',
  dueDate: '마감',
  event: '행사',
  details: '자세히',
  close: '닫기',
  currentEvent: '현재 행사',
} as const

// 거르기 전에도 업무가 없으면 useBoardEmpty가 보드의 빈 상태 문구를 고른다.
const VIEW_EMPTY: Record<TaskView, string> = {
  mine: '내 업무 없음',
  department: '내 부서 업무 없음',
  all: '업무 없음',
  unassigned: '담당자 없는 업무 없음',
}
export const viewEmptyText = (view: TaskView, dept: string | null) =>
  dept === null ? VIEW_EMPTY[view] : '이 부서 업무 없음'

// 휴대폰 상태 탭 하나가 비었을 때(TaskStatusTabs).
export const STATUS_EMPTY: Record<TaskStatus, string> = {
  todo: '할 일 없음',
  in_progress: '진행 중인 업무 없음',
  done: '끝난 업무 없음',
}

const dueText = (value: string | null) => (value === null ? NONE : monthDay(value))
type Side = { id: string; name: string | null } | null
const departmentText = (side: Side) =>
  side === null ? COUNCIL_TASK_LABEL : (side.name ?? REMOVED_DEPARTMENT)
const eventText = (side: Side) => (side === null ? NONE : (side.name ?? UNKNOWN_EVENT))
const personText = (side: Side) => (side === null ? NONE : (side.name ?? UNKNOWN_PERSON))

function changeText(change: TaskChange) {
  switch (change.field) {
    case 'created':
      return '만듦'
    case 'title':
      return `제목 ${change.from} → ${change.to}`
    case 'body':
      return '내용 고침'
    case 'dueDate':
      return `마감 ${dueText(change.from)} → ${dueText(change.to)}`
    case 'status':
      return `상태 ${STATUS_LABEL[change.from]} → ${STATUS_LABEL[change.to]}`
    case 'department':
      return `담당 부서 ${departmentText(change.from)} → ${departmentText(change.to)}`
    case 'assignee':
      return `담당자 ${personText(change.from)} → ${personText(change.to)}`
    case 'event':
      return `행사 ${eventText(change.from)} → ${eventText(change.to)}`
  }
}

// 저절로 바뀐 판의 까닭. 코드로 남아 있어 문구를 나중에 바꿔도 옛 판이 따라간다(기능 015).
const CAUSE_TEXT: Record<TaskCause, string> = {
  request_submitted: '구매 요청 냄',
  request_finished: '구매 요청 끝남',
  form_created: '신청 양식 만듦',
  notice_posted: '공지 올림',
  event_completed: '행사 완료',
}

const actorText = (version: TaskVersion) =>
  version.by?.name ??
  (version.cause === null ? UNKNOWN_PERSON : `저절로: ${CAUSE_TEXT[version.cause]}`)

// 이력 한 줄: '이름 · 10월 20일 14:03 · 상태 할 일 → 진행 중'. 바꾼 사람이 없는 판은 이름 자리에 '저절로: 까닭'이 온다.
export function versionLine(version: TaskVersion) {
  return [
    actorText(version),
    monthDayTime(version.at),
    version.changes.map(changeText).join(', '),
  ].join(' · ')
}
