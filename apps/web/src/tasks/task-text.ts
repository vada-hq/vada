import { KOREAN_DATE_LENGTH, koreanOf, type TaskChange, type TaskVersion } from '@vada/contracts'
import { COUNCIL_TASK_LABEL, monthDay, STATUS_LABEL } from './task-view'

const NONE = '없음'
const UNKNOWN_PERSON = '알 수 없는 사람'
const REMOVED_DEPARTMENT = '없앤 부서'
const TIME_FROM = KOREAN_DATE_LENGTH + 1

// ISO 시각 → '10월 20일 14:03'(한국 시각)
export function monthDayTime(iso: string) {
  const korean = koreanOf(new Date(iso))
  return `${monthDay(korean.slice(0, KOREAN_DATE_LENGTH))} ${korean.slice(TIME_FROM)}`
}

const dueText = (value: string | null) => (value === null ? NONE : monthDay(value))
type Side = { id: string; name: string | null } | null
const departmentText = (side: Side) =>
  side === null ? COUNCIL_TASK_LABEL : (side.name ?? REMOVED_DEPARTMENT)
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
