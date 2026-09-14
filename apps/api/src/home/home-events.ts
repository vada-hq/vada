import { and, eq, inArray } from 'drizzle-orm'
import type { ApiResponse } from '../../../../specs/figma/vada-wireframe/api-types.d.ts'
import type { Db } from '../db/client.ts'
import { departments, events, tasks } from '../db/schema.ts'
import { STATUS } from '../events/events.ts'
import { inThisWeek, labelOf, orgSchedules, shortDay } from '../ops/calendar.ts'
import { daysBetween, moment } from '../time.ts'

export type EventCounts = ApiResponse<'home.eventCounts'>

/**
 * 홈 머리의 건수(`home.eventCounts`).
 *
 * **'예정 행사'는 기획 중인 행사다.** 일시가 잡혔는가로 가르지 않는다 — 곁의 목록이
 * '진행 중이거나 예정된 행사'인데 거기에 일시가 '미정'인 행사가 든다(명세가 그
 * 조각에 '정해지지 않았으면 미정'이라 적었다). 단계로 가르는 것이 운영 허브의
 * 두 수와도 같은 규칙이다(`ops.spaceStats`의 eventInProgress·eventPlanning).
 *
 * **'이번 주 주요 일정'은 캘린더의 흐름이다** — 행사·회의·마감 셋을 함께 센다.
 */
export async function homeEventCounts(db: Db, orgId: string, now: Date): Promise<EventCounts> {
  const rows = await db
    .select({ status: events.status })
    .from(events)
    .where(eq(events.orgId, orgId))
  const schedules = await orgSchedules(db, orgId, null)
  return {
    activeEvents: rows.filter((row) => row.status === 'inProgress').length,
    upcomingEvents: rows.filter((row) => row.status === 'planning').length,
    weeklySchedules: schedules.filter((one) => inThisWeek(one.at, now)).length,
  }
}

/** 정해지지 않은 것은 **그 사실을 말로** 준다(명세가 이 출처에 '미정'이라 적었다). */
const UNDECIDED = '미정'

function orNote(value: string | null): string {
  return value === null || value.trim() === '' ? UNDECIDED : value
}

export type HomeEvent = ApiResponse<'home.events'>[number]

/**
 * 진행 중이거나 예정된 행사(`home.events`).
 *
 * **준비율과 지연은 그 행사의 업무에서 나온다.** 화면이 그 둘을 한 줄기에 나란히
 * 그리고(`준비 62% · 지연 업무 1건`) 행사 업무 보드가 같은 표를 본다 — 준비가
 * 얼마나 됐는가는 그 행사에 걸린 업무 중 몇이 끝났는가다.
 *
 * **업무가 하나도 없으면 0%다.** 명세가 이 조각을 수 하나로 적어 두어 '셀 것이
 * 없다'고 말할 자리가 없다 — 행사 카드(`event.summary`)에는 그 말을 담는 조각이
 * 따로 있고 여기에는 없다.
 *
 * 차례는 이른 행사가 먼저, 일시가 없으면 뒤다(행사 목록이 그린 그 차례다).
 */
export async function homeEvents(db: Db, orgId: string, now: Date): Promise<HomeEvent[]> {
  const rows = await db
    .select({
      id: events.id,
      title: events.title,
      status: events.status,
      startAt: events.startAt,
      place: events.place,
      departmentName: departments.name,
    })
    .from(events)
    // **이어 붙인 표도 자기 조직을 확인한다.** 부서만 id로 이으면 남의 조직의 이름이
    // 우리 카드에 그려진다(행사 목록이 같은 구멍을 겪었다).
    .leftJoin(
      departments,
      and(eq(events.hostDepartmentId, departments.id), eq(departments.orgId, orgId)),
    )
    .where(and(eq(events.orgId, orgId), inArray(events.status, ['planning', 'inProgress'])))

  const ordered = rows.sort((left, right) => orderOf(left).localeCompare(orderOf(right)))
  const ids = ordered.map((row) => row.id)
  const workload = await eventWorkload(db, orgId, ids, now)

  return ordered.map((row) => {
    const work = workload.get(row.id) ?? { total: 0, done: 0, delayed: 0 }
    return {
      status: STATUS[row.status].label,
      title: row.title,
      date: row.startAt === null ? UNDECIDED : moment(row.startAt).slice(0, 10),
      place: orNote(row.place),
      team: orNote(row.departmentName),
      progressPercent: work.total === 0 ? 0 : Math.round((work.done / work.total) * 100),
      // **없으면 오지 않는다**(명세가 optional로 적었다).
      ...(work.delayed === 0 ? {} : { delayedTaskCount: work.delayed }),
    }
  })
}

function orderOf(row: { startAt: Date | null; title: string }): string {
  return `${row.startAt === null ? '9' : '0'}${row.startAt?.toISOString() ?? ''}${row.title}`
}

interface Workload {
  total: number
  done: number
  delayed: number
}

/** 행사마다의 업무 셈. **한 번에 걷는다** — 행사마다 조회하면 목록이 길어질수록 는다. */
async function eventWorkload(
  db: Db,
  orgId: string,
  eventIds: readonly string[],
  now: Date,
): Promise<Map<string, Workload>> {
  const found = new Map<string, Workload>()
  if (eventIds.length === 0) return found
  const rows = await db
    .select({ eventId: tasks.eventId, status: tasks.status, dueDate: tasks.dueDate })
    .from(tasks)
    .where(and(eq(tasks.orgId, orgId), inArray(tasks.eventId, [...eventIds])))
  for (const row of rows) {
    const key = row.eventId!
    const already = found.get(key) ?? { total: 0, done: 0, delayed: 0 }
    already.total += 1
    if (row.status === 'done') already.done += 1
    // 끝난 업무는 기한이 지나도 지연이 아니다 — 이미 한 일을 다시 재촉하지 않는다.
    else if (row.dueDate !== null && daysBetween(row.dueDate, now) > 0) already.delayed += 1
    found.set(key, already)
  }
  return found
}

export type HomeSchedule = ApiResponse<'home.schedules'>[number]

/**
 * 다가오는 주요 일정(`home.schedules`).
 *
 * **캘린더와 같은 흐름을 오늘부터 잘라 온다.** 딱지(`badge`)는 그 일정의 유형이고,
 * 유형의 이름은 명세가 든다(`ops.calendarTypes`의 행사·회의·마감).
 *
 * **몇 개까지인지 명세가 말하지 않아 자르지 않는다.** 자르면 그 수가 서버가 지어낸
 * 값이 되고, 그 다음 화면은 '더 보기'가 없어 나머지를 영영 못 본다.
 */
export async function homeSchedules(db: Db, orgId: string, now: Date): Promise<HomeSchedule[]> {
  const schedules = await orgSchedules(db, orgId, null)
  return schedules
    // 오늘 걸린 것은 아직 다가오는 것이다 — 지난 것만 뺀다.
    .filter((one) => daysBetween(now, one.at) >= 0)
    .map((one) => ({ date: shortDay(one.at), title: one.title, badge: labelOf(one.type) }))
}
