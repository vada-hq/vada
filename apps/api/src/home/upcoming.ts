import { and, eq, gte, inArray, lt } from 'drizzle-orm'
import {
  DAY_MS,
  HOME_CARD_ROWS,
  HOME_LIST_LIMIT,
  HOME_SOON_DAYS,
  KOREAN_DATE_LENGTH,
  dateFromKorean,
  koreanDateOf,
  koreanOf,
  type HomeKind,
  type HomeParticipating,
  type HomeUpcoming,
  type HomeUpcomingItem,
  type TaskSummary,
} from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import { event, record, registrationForm } from '../db/schema.js'
import type { Db } from '../db/types.js'
import { completedEventIdsAmong } from '../events/completion.js'
import { dueAtOf, dueGroupOf } from '../tasks/due.js'
import type { OpenTask } from '../tasks/open-tasks.js'
import { myDepartmentIds } from './participating.js'

type Reader = Pick<Db, 'select'>
type Range = { from: Date; until: Date }

// 'YYYY-MM-DDTHH:mm'의 시각 부분 시작
const TIME_START = KOREAN_DATE_LENGTH + 1

// 오늘 0시(한국)부터 7일째 끝까지. 업무 마감의 '7일 안'(dueGroupOf, HOME_SOON_DAYS)과 같은 경계다.
function rangeOf(now: Date): Range {
  const from = dateFromKorean(`${koreanDateOf(now)}T00:00`)
  return { from, until: new Date(from.getTime() + (HOME_SOON_DAYS + 1) * DAY_MS) }
}

// 범위(DEC-95): 회장단은 학생회 전체, 부서가 있으면 그 부서가 담당 부서인 행사와 그 부서 업무,
// 부서가 없으면 학생회 전체 행사와 내 업무. eventIds가 null이면 학생회 전체 행사다.
type Scope = { eventIds: string[] | null; tasks: TaskSummary[] }

const timed = (value: Date) => {
  const text = koreanOf(value)
  return { date: text.slice(0, KOREAN_DATE_LENGTH), time: text.slice(TIME_START) }
}

// 시작이 범위 안인 행사. 완료 행사는 뺀다(완료 판정은 행사 화면과 같은 completedEventIdsAmong).
async function eventStartsOf(db: Reader, actor: Actor, range: Range, scope: Scope) {
  if (scope.eventIds?.length === 0) return []
  const rows = await db
    .select({ id: event.id, name: event.name, startsAt: event.startsAt })
    .from(event)
    .innerJoin(record, eq(record.id, event.id))
    .where(
      and(
        eq(record.councilId, actor.councilId),
        gte(event.startsAt, range.from),
        lt(event.startsAt, range.until),
        scope.eventIds ? inArray(event.id, scope.eventIds) : undefined,
      ),
    )
  const completed = await completedEventIdsAmong(
    db,
    rows.map(row => row.id),
  )
  return rows.flatMap(({ id, name, startsAt }) =>
    completed.has(id) || !startsAt
      ? []
      : [
          {
            at: startsAt,
            item: { kind: 'event_start' as const, ...timed(startsAt), event: { id, name } },
          },
        ],
  )
}

// 마감이 범위 안인 참가 신청 양식. 칸은 양식과 행사의 이름뿐이다(신청자 정보 없음, DEC-59).
async function formClosesOf(db: Reader, actor: Actor, range: Range, scope: Scope) {
  if (scope.eventIds?.length === 0) return []
  const rows = await db
    .select({
      id: registrationForm.id,
      name: registrationForm.name,
      closesAt: registrationForm.closesAt,
      eventId: event.id,
      eventName: event.name,
    })
    .from(registrationForm)
    .innerJoin(event, eq(event.id, registrationForm.eventId))
    .innerJoin(record, eq(record.id, event.id))
    .where(
      and(
        eq(record.councilId, actor.councilId),
        gte(registrationForm.closesAt, range.from),
        lt(registrationForm.closesAt, range.until),
        scope.eventIds ? inArray(event.id, scope.eventIds) : undefined,
      ),
    )
  const completed = await completedEventIdsAmong(
    db,
    rows.map(row => row.eventId),
  )
  return rows
    .filter(row => !completed.has(row.eventId))
    .map(row => ({
      at: row.closesAt,
      item: {
        kind: 'registration_close' as const,
        ...timed(row.closesAt),
        event: { id: row.eventId, name: row.eventName },
        form: { id: row.id, name: row.name },
      },
    }))
}

// 마감이 오늘~7일째인 끝나지 않은 업무. 업무는 마감 순으로 읽어 온 차례를 그대로 둔다.
function taskDuesOf(tasks: TaskSummary[], now: Date) {
  return tasks.flatMap(task => {
    const group = dueGroupOf(dueAtOf(task.dueDate), now, HOME_SOON_DAYS)
    if ((group !== 'today' && group !== 'soon') || !task.dueDate) return []
    return [{ at: null, item: { kind: 'task_due' as const, date: task.dueDate, time: null, task } }]
  })
}

type Entry = { at: Date | null; item: HomeUpcomingItem }
const KIND_ORDER: HomeUpcomingItem['kind'][] = ['task_due', 'event_start', 'registration_close']
// 날짜순, 같은 날은 종일(업무 마감)이 앞이고 그다음 시각순, 같은 시각이면 행사 시작 → 신청 마감이다(캘린더 앱의 종일 일정 자리).
// 정렬은 안정이라 같은 자리의 업무는 마감 순으로 읽은 차례를 지킨다.
const byWhen = (a: Entry, b: Entry) =>
  a.item.date.localeCompare(b.item.date) ||
  (a.at?.getTime() ?? 0) - (b.at?.getTime() ?? 0) ||
  KIND_ORDER.indexOf(a.item.kind) - KIND_ORDER.indexOf(b.item.kind)

function scopeOf(
  kind: HomeKind,
  actor: Actor,
  input: { open: OpenTask[]; mine: TaskSummary[]; staffed: string[] },
): Scope {
  if (kind === 'council') return { eventIds: null, tasks: input.open.map(item => item.summary) }
  const departments = myDepartmentIds(actor)
  if (!departments.length) return { eventIds: null, tasks: input.mine }
  return {
    eventIds: input.staffed,
    tasks: input.open
      .map(item => item.summary)
      .filter(task => departments.includes(task.department?.id ?? '')),
  }
}

// 가까운 일정(DEC-95). 부서장은 참여 행사 카드(앞 HOME_CARD_ROWS줄)의 다음 마감과 같은 업무를 뺀다(같은 것을 한 화면에 두 번 싣지 않는다).
export async function upcomingOf(
  db: Reader,
  actor: Actor,
  now: Date,
  input: {
    kind: HomeKind
    open: OpenTask[]
    mine: TaskSummary[]
    staffed: string[]
    participating: HomeParticipating
  },
): Promise<HomeUpcoming> {
  const range = rangeOf(now)
  const scope = scopeOf(input.kind, actor, input)
  const shownNext = new Set(
    input.kind === 'department'
      ? input.participating.events.slice(0, HOME_CARD_ROWS).flatMap(row => row.next?.taskId ?? [])
      : [],
  )
  const entries: Entry[] = [
    ...taskDuesOf(
      scope.tasks.filter(task => !shownNext.has(task.id)),
      now,
    ),
    ...(await eventStartsOf(db, actor, range, scope)),
    ...(await formClosesOf(db, actor, range, scope)),
  ].sort(byWhen)
  return {
    items: entries.slice(0, HOME_LIST_LIMIT).map(entry => entry.item),
    total: entries.length,
  }
}
