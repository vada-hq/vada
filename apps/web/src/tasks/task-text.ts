import {
  KOREAN_DATE_LENGTH,
  koreanOf,
  type TaskChange,
  type TaskStatus,
  type TaskVersion,
} from '@vada/contracts'

export const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: '할 일',
  in_progress: '진행 중',
  done: '끝남',
}

const NONE = '없음'
const UNKNOWN_PERSON = '알 수 없는 사람'
const REMOVED_DEPARTMENT = '없앤 부서'
const COUNCIL_TASK = '학생회 업무'
const MONTH_FROM = 5
const TIME_FROM = KOREAN_DATE_LENGTH + 1

// '2026-10-25' → '10월 25일'
export function monthDay(dateText: string) {
  const [month, day] = dateText.slice(MONTH_FROM).split('-')
  return `${Number(month)}월 ${Number(day)}일`
}

// ISO 시각 → '10월 20일 14:03'(한국 시각)
export function monthDayTime(iso: string) {
  const korean = koreanOf(new Date(iso))
  return `${monthDay(korean.slice(0, KOREAN_DATE_LENGTH))} ${korean.slice(TIME_FROM)}`
}

const dueText = (value: string | null) => (value === null ? NONE : monthDay(value))
type Side = { id: string; name: string | null } | null
const departmentText = (side: Side) =>
  side === null ? COUNCIL_TASK : (side.name ?? REMOVED_DEPARTMENT)
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
      return `상태 ${STATUS_LABELS[change.from]} → ${STATUS_LABELS[change.to]}`
    case 'department':
      return `담당 부서 ${departmentText(change.from)} → ${departmentText(change.to)}`
    case 'assignee':
      return `담당자 ${personText(change.from)} → ${personText(change.to)}`
  }
}

// 이력 한 줄: '이름 · 10월 20일 14:03 · 상태 할 일 → 진행 중'
export function versionLine(version: TaskVersion) {
  return [
    version.by?.name ?? UNKNOWN_PERSON,
    monthDayTime(version.at),
    version.changes.map(changeText).join(', '),
  ].join(' · ')
}
