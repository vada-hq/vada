import { ClipboardCheck, type LucideIcon, NotebookPen } from 'lucide-react'
import {
  HOME_TODO_KINDS,
  type HomeTodo,
  type HomeTodoKind,
  type HomeTodoRow,
} from '@vada/contracts'
import { endedLabel } from '../events/event-header-view'
import { EVENT_SETTLED_LABEL } from '../events/event-view'
import { OPS_ICON } from './ops-view'

// ③ 내가 할 일(c35)의 글. 갈래·차례·셈은 서버가 정했고 여기는 글만 만든다.
export const TODO_TITLE = '내가 할 일'

// 확인할 것은 새 그림, 업무 줄은 ①과 같은 그림(지남·오늘)
export const TODO_ICON: Record<HomeTodoKind, LucideIcon> = {
  minutes: NotebookPen,
  event_tidy: ClipboardCheck,
  task_late: OPS_ICON.late,
  task_today: OPS_ICON.today,
}

// 접힌 줄을 '전체 보기' 옆에 셀 때의 이름
const TODO_KIND_NAME: Record<HomeTodoKind, string> = {
  minutes: '회의록',
  event_tidy: '행사 정리',
  task_late: '지남',
  task_today: '오늘 마감',
}

// 줄의 원래 기록 번호(회의 / 행사 / 업무)
export function todoTargetId(row: HomeTodoRow) {
  if (row.kind === 'minutes') return row.meeting.id
  return row.kind === 'event_tidy' ? row.event.id : row.task.id
}

export function todoTitle(row: HomeTodoRow) {
  if (row.kind === 'minutes') return row.meeting.title
  return row.kind === 'event_tidy' ? row.event.name : row.task.title
}

// 행사 정리: 다 0이면 '완료 가능', 아니면 남은 것과 7일째부터 '끝난 지 n일'(행사 머리와 같은 날수)
function tidyFact({ remaining, endedDays }: Extract<HomeTodoRow, { kind: 'event_tidy' }>) {
  const ended = endedLabel(endedDays)
  if (remaining.tasks === 0 && remaining.settlement === 0)
    return [EVENT_SETTLED_LABEL, ended].filter(Boolean).join(' · ')
  return [
    remaining.tasks > 0 && `업무 남음 ${remaining.tasks}`,
    remaining.settlement > 0 && `정산 남음 ${remaining.settlement}`,
    ended,
  ]
    .filter(Boolean)
    .join(' · ')
}

// 사실 글. 회의록은 지금 데이터(확정 전 · 결정 수 · 후속 업무 수)이고 AI 초안 문구를 흉내 내지 않는다(c235 7.1).
export function todoFact(row: HomeTodoRow) {
  if (row.kind === 'minutes') return `확정 전 · 결정 ${row.decisions} · 후속 업무 ${row.followUps}`
  if (row.kind === 'event_tidy') return tidyFact(row)
  return row.kind === 'task_late' ? `${row.days}일 지남` : '오늘 마감'
}

// 위험 색은 업무의 지남·오늘만(c35 K5)
export const isTodoDanger = (row: HomeTodoRow) =>
  row.kind === 'task_late' || row.kind === 'task_today'

// 접힌 줄을 갈래별로 센 글: '외 1건 · 오늘 마감 1'. 서버가 상한으로 자른 줄도 갈래별 수로 센다.
export function todoHiddenText(counts: HomeTodo['counts'], shown: HomeTodoRow[]) {
  const parts = HOME_TODO_KINDS.map(kind => ({
    kind,
    n: counts[kind] - shown.filter(row => row.kind === kind).length,
  })).filter(part => part.n > 0)
  if (!parts.length) return null
  const total = parts.reduce((sum, part) => sum + part.n, 0)
  return `외 ${total}건 · ${parts.map(part => `${TODO_KIND_NAME[part.kind]} ${part.n}`).join(', ')}`
}
