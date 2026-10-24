import { DAY_MS, KOREAN_DATE_LENGTH, type EventSummary, type TaskSummary } from '@vada/contracts'

// 달력 계산. 날짜는 모두 한국 날짜 글('YYYY-MM-DD'), 달은 'YYYY-MM'이다.
const WEEK_DAYS = 7
const MONTH_LENGTH = 7
export const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'] as const

const utc = (date: string) => new Date(`${date}T00:00:00Z`)
const dateText = (date: Date) => date.toISOString().slice(0, KOREAN_DATE_LENGTH)

const addDays = (date: string, days: number) =>
  dateText(new Date(utc(date).getTime() + days * DAY_MS))
export const monthOf = (date: string) => date.slice(0, MONTH_LENGTH)
export const weekdayOf = (date: string) => utc(date).getUTCDay()

export function shiftMonth(month: string, by: number) {
  const [year = 0, number = 1] = month.split('-').map(Number)
  return dateText(new Date(Date.UTC(year, number - 1 + by, 1))).slice(0, MONTH_LENGTH)
}

export function monthLabel(month: string) {
  const [year, number] = month.split('-').map(Number)
  return `${year}년 ${number}월`
}

// '10월 24일 (토)'
export function dayLabel(date: string) {
  const [, month, day] = date.split('-').map(Number)
  return `${month}월 ${day}일 (${WEEKDAYS[weekdayOf(date)]})`
}

// 그 달을 덮는 주들. 한국 달력처럼 일요일에 시작한다.
export function weeksOf(month: string): string[][] {
  const first = `${month}-01`
  const next = `${shiftMonth(month, 1)}-01`
  const weeks: string[][] = []
  for (
    let start = addDays(first, -weekdayOf(first));
    start < next;
    start = addDays(start, WEEK_DAYS)
  )
    weeks.push(Array.from({ length: WEEK_DAYS }, (_, index) => addDays(start, index)))
  return weeks
}

// 행사가 걸친 날(시작일부터 끝일까지). 일시를 정하지 않은 행사는 달력에 없다.
function eventRange(event: EventSummary) {
  if (!event.startsAt) return null
  const from = event.startsAt.slice(0, KOREAN_DATE_LENGTH)
  const to = (event.endsAt ?? event.startsAt).slice(0, KOREAN_DATE_LENGTH)
  return { from, to: to < from ? from : to }
}

export const eventsOn = (events: EventSummary[], day: string) =>
  events.filter(event => {
    const range = eventRange(event)
    return range !== null && range.from <= day && day <= range.to
  })

// 한 주 안의 행사 막대. 주를 넘는 행사는 주 끝에서 잘리고(before, after), 겹치면 아래 줄(lane)로 내려간다.
export type EventBar = {
  event: EventSummary
  start: number
  span: number
  lane: number
  before: boolean
  after: boolean
}

export function eventBarsOf(events: EventSummary[], week: string[]): EventBar[] {
  const first = week[0] ?? ''
  const last = week[WEEK_DAYS - 1] ?? ''
  const bars = events
    .flatMap(event => {
      const range = eventRange(event)
      if (!range || range.to < first || range.from > last) return []
      const start = range.from < first ? 0 : week.indexOf(range.from)
      const end = range.to > last ? WEEK_DAYS - 1 : week.indexOf(range.to)
      return [
        { event, start, span: end - start + 1, before: range.from < first, after: range.to > last },
      ]
    })
    .sort((a, b) => a.start - b.start || b.span - a.span)
  const laneEnds: number[] = []
  return bars.map(bar => {
    const free = laneEnds.findIndex(end => end < bar.start)
    const lane = free === -1 ? laneEnds.length : free
    laneEnds[lane] = bar.start + bar.span - 1
    return { ...bar, lane }
  })
}

// 달력에서 보이는 업무의 상태. 지남은 끝나지 않았고 마감이 지난 것이다.
export type MarkKind = 'overdue' | 'in_progress' | 'todo' | 'done'

export function markOf(task: TaskSummary): MarkKind {
  if (task.status === 'done') return 'done'
  return task.overdue ? 'overdue' : task.status
}

// 끝나지 않은 업무를 먼저(지남 → 진행 중 → 할 일), 끝난 업무를 뒤에 둔다.
const MARK_ORDER: MarkKind[] = ['overdue', 'in_progress', 'todo', 'done']
const rank = (task: TaskSummary) => MARK_ORDER.indexOf(markOf(task))

export function tasksByDay(tasks: TaskSummary[]) {
  const days = new Map<string, TaskSummary[]>()
  for (const task of tasks) {
    if (task.dueDate === null) continue
    days.set(task.dueDate, [...(days.get(task.dueDate) ?? []), task])
  }
  for (const [day, list] of days)
    days.set(
      day,
      list.sort((a, b) => rank(a) - rank(b) || a.title.localeCompare(b.title, 'ko')),
    )
  return days
}
