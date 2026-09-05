import { and, eq, isNotNull, ne, notInArray } from 'drizzle-orm'
import optionSources from '../../../../specs/figma/vada-wireframe/option-sources.json' with { type: 'json' }
import type { Db } from '../db/client.ts'
import { events, meetings, tasks } from '../db/schema.ts'
import { Blocked } from '../routes.ts'
import { daysBetween, moment, momentOf } from '../time.ts'

// 운영 캘린더(OPS-CAL-01).
//
// **달력은 원본이 아니라 비친 것이다.** `db/schema.ts` 머리가 그렇게 적어 두었다 —
// 그려지는 것은 행사의 일시·회의의 일시·업무의 기한이고, 달력 자신의 표는 없다.
// 그래서 여기 있는 일은 **셋을 모아 한 흐름으로 세우는 것**뿐이다.
//
// 홈(HOME-01K)도 같은 흐름을 읽는다 — '다가오는 주요 일정'의 딱지가 마감·회의·행사고
// '캘린더 보기'가 이 화면으로 간다. 그래서 흐름을 만드는 자리를 한 곳에 두고
// `home/`이 가져다 쓴다. 두 벌을 두면 같은 날의 같은 일정이 두 화면에서 갈린다.
//
// ── 정하지 않은 것 ──────────────────────────────────────────────────────────
//
// **달을 앞뒤로 옮기는 인자가 없다.** 명세가 그 조작을 담을 어휘를 아직 갖지 않아
// 화면이 넘길 값이 없다(`ops.calendarMonth`의 설명). 그래서 보고 있는 달은 오늘이
// 정한다 — 어휘가 생기면 여기에 month 인자가 붙는다.

/**
 * 일정의 유형. **명세가 갖고 있다**(`ops.calendarTypes`).
 *
 * 여기 목록을 다시 적으면 그림이 늘 때 두 벌이 갈린다 — 행사 기본정보가 같은 길이다
 * (`events/basics.ts`의 `optionsOf`).
 *
 * `all`은 유형이 아니라 **거르지 않는다는 뜻**이다(거르개의 첫 선택지). 그것을
 * 유형으로 읽으면 아무것도 안 걸려 격자가 통째로 빈다.
 */
const ALL = 'all'

function calendarTypes(): Array<{ value: string; label: string }> {
  const sources = optionSources.sources as Array<{
    key: string
    options?: Array<{ value: string; label: string }>
  }>
  const found = sources.find((one) => one.key === 'ops.calendarTypes')
  if (found?.options === undefined) {
    throw new Error("선택지 'ops.calendarTypes'가 명세에 없습니다.")
  }
  return found.options.filter((option) => option.value !== ALL)
}

const TYPES = calendarTypes()

/** 유형의 이름이 곧 색 이름이다 — 유형이 하나 늘면 색도 하나 는다(명세가 그렇게 적었다). */
export type ScheduleType = string

/** 유형 딱지의 글. **범례가 부르는 그 말이다.** */
const LABEL = new Map(TYPES.map((one) => [one.value, one.label]))

/** 같은 날에 여럿이 걸리면 어느 것이 먼저인가. 범례가 그린 차례다(행사·회의·마감). */
const RANK = new Map(TYPES.map((one, at) => [one.value, at]))

/**
 * 걸러 달라는 유형이 명세가 든 것인가. 아니면 던진다.
 *
 * **안 넘긴 것은 좁히지 않는다는 뜻으로 읽는다** — 거르개의 첫 선택지가 '전체'이고
 * 그 값이 곧 `all`이다. 틀리게 넘긴 것은 막는다: 그대로 넘기면 아무것도 안 걸러진
 * 격자가 그려지고, 그것은 조용하다.
 */
export function readCalendarType(asked: string | undefined): ScheduleType | null {
  const wanted = (asked ?? '').trim()
  if (wanted === '' || wanted === ALL) return null
  if (LABEL.has(wanted)) return wanted
  throw new Blocked('명세에 없는 일정 유형입니다')
}

/**
 * 달력에 걸리는 일정 하나.
 *
 * **원본이 어디에 있는지를 함께 든다**(`eventId`). 행사에 딸린 줄만 그 행사의
 * 일정으로 갈 수 있고, 상시 업무의 마감과 운영 회의는 열 행사가 없다.
 */
export interface Schedule {
  id: string
  type: ScheduleType
  at: Date
  title: string
  eventId: string | null
}

/** 그 시간대에서 본 날짜. **시간대를 아는 자리는 `time.ts` 하나다** — 그 글에서 뗀다. */
function dayKey(when: Date): string {
  return moment(when).slice(0, 10)
}

/** `07.20` — 좁은 자리가 쓰는 꼴. */
export function shortDay(when: Date): string {
  return moment(when).slice(5, 10).replace('-', '.')
}

/** 하루씩 옮긴 때. 셈에만 쓰므로 낮 12시 언저리를 그대로 민다. */
function plusDays(when: Date, days: number): Date {
  return new Date(when.getTime() + days * 86_400_000)
}

/**
 * 어느 주의 일요일부터 세는가.
 *
 * 달력이 일요일에서 시작한다(OPS-CAL-01의 머리가 '일 월 화 수 목 금 토'이고 이번
 * 주 패널이 '07.19 (일) – 07.25 (토)'라 적었다). 요일을 구하는 어휘가 `time.ts`에
 * 없어 **아는 일요일 하나**에서 센다 — 날 수를 세는 일은 시간대를 아는 그 파일이
 * 하고, 여기서는 나머지만 본다.
 *
 * **운영 허브도 이것을 쓴다**(`space.ts`의 이번 주 마감). 두 벌을 두면 한쪽만
 * 고쳐지는 날 같은 주가 두 주가 된다.
 */
const A_SUNDAY = new Date('2026-01-04T12:00:00+09:00')

/** 오늘이 이번 주의 몇째 날인가(일요일이 0). */
export function sinceSunday(now: Date): number {
  return ((daysBetween(A_SUNDAY, now) % 7) + 7) % 7
}

/** 이번 주의 첫날(일)과 끝날(토). **'이번 주'는 보고 있는 달과 무관하다** — 오늘이 정한다. */
export function thisWeek(now: Date): { start: Date; end: Date } {
  const start = plusDays(now, -sinceSunday(now))
  return { start, end: plusDays(start, 6) }
}

/**
 * 이 학생회의 일정 전부.
 *
 * **세 표에서 모은다.** 행사는 일시가 잡힌 것, 회의는 일시가 잡히고 알려진 것,
 * 마감은 **완료되지 않은 업무의 기한**이다(그림이 격자 곁에 그 규칙을 적었다).
 *
 * 회의에서 초안과 취소를 빼는 것은 이 저장소가 이미 든 규칙이다 — 임시 저장한
 * 회의는 아직 아무에게도 알리지 않은 것이고 취소한 회의는 예정이 아니다
 * (`space.ts`의 '오늘 회의'와 `meeting.groups`가 같은 길이다).
 *
 * 행사와 회의에는 단계로 거르는 규칙이 그림에 없다. **마감에만 그 규칙이 적혀
 * 있다는 것이 곧 나머지에는 없다는 뜻**이므로 지어내지 않는다 — 지난 행사도 그날에
 * 있었고, 격자는 '언제 무엇이 있었나'를 그린다.
 */
export async function orgSchedules(
  db: Db,
  orgId: string,
  type: ScheduleType | null,
): Promise<Schedule[]> {
  const wants = (one: ScheduleType) => type === null || type === one

  const found: Schedule[] = []

  if (wants('event')) {
    const rows = await db
      .select({ id: events.id, title: events.title, startAt: events.startAt })
      .from(events)
      .where(and(eq(events.orgId, orgId), isNotNull(events.startAt)))
    for (const row of rows) {
      found.push({
        id: `event:${row.id}`,
        type: 'event',
        at: row.startAt!,
        title: row.title,
        // 행사 줄의 원본이 그 행사 자신이다.
        eventId: row.id,
      })
    }
  }

  if (wants('meeting')) {
    const rows = await db
      .select({
        id: meetings.id,
        title: meetings.title,
        scheduledAt: meetings.scheduledAt,
        eventId: meetings.eventId,
      })
      .from(meetings)
      .where(
        and(
          eq(meetings.orgId, orgId),
          isNotNull(meetings.scheduledAt),
          notInArray(meetings.status, ['draft', 'cancelled']),
        ),
      )
    for (const row of rows) {
      found.push({
        id: `meeting:${row.id}`,
        type: 'meeting',
        at: row.scheduledAt!,
        title: row.title,
        eventId: row.eventId,
      })
    }
  }

  if (wants('deadline')) {
    const rows = await db
      .select({
        id: tasks.id,
        title: tasks.title,
        dueDate: tasks.dueDate,
        eventId: tasks.eventId,
      })
      .from(tasks)
      .where(
        and(eq(tasks.orgId, orgId), isNotNull(tasks.dueDate), ne(tasks.status, 'done')),
      )
    for (const row of rows) {
      found.push({
        id: `deadline:${row.id}`,
        type: 'deadline',
        at: row.dueDate!,
        title: row.title,
        eventId: row.eventId,
      })
    }
  }

  // **차례를 명세도 그림도 말하지 않는다.** 안 정하면 저장소가 주는 대로 그려져
  // 새로고침마다 줄이 자리를 바꾼다 — 업무 보드가 같은 자리에서 같은 것을 정했다.
  return found.sort((left, right) => order(left).localeCompare(order(right)))
}

function order(one: Schedule): string {
  return `${one.at.toISOString()}${RANK.get(one.type) ?? 9}${one.title}${one.id}`
}

export interface CalendarMonth {
  monthLabel: string
}

/**
 * 지금 보고 있는 달(`ops.calendarMonth`).
 *
 * **어느 달인지는 서버가 정한다** — 위의 '정하지 않은 것'을 보라.
 */
export function opsCalendarMonth(now: Date): CalendarMonth {
  const [year, month] = dayKey(now).split('-')
  return { monthLabel: `${year}년 ${Number(month)}월` }
}

export interface CalendarWeekRange {
  rangeNote: string
}

/**
 * 이번 주 패널의 머리(`ops.calendarWeekRange`).
 *
 * **서버가 완성한 문장으로 준다.** 화면이 날짜를 셈해 문장을 만들면 그 셈이 화면에
 * 적힌다(`finance.ledgerScope`의 rangeNote와 같은 자리).
 *
 * 요일이 글자로 박혀 있는 까닭: 이 주는 **일요일에서 시작해 토요일에 끝나게 만들어진
 * 것**이라 두 끝의 요일이 셈이 아니라 정의다. 요일을 구하는 어휘는 `time.ts`에 없고
 * 시간대 이름은 그 파일 밖으로 나가지 않는다.
 */
export function opsCalendarWeekRange(now: Date): CalendarWeekRange {
  const { start, end } = thisWeek(now)
  return {
    rangeNote: `${shortDay(start)} (일) – ${shortDay(end)} (토) · 오늘 ${shortDay(now)}`,
  }
}

export interface CalendarDay {
  id: string
  dayLabel: string
  dayTone: string
  schedules: Array<{ id: string; title: string; typeTone: string }>
}

/**
 * 월 격자의 칸들(`ops.calendarDays`).
 *
 * **항목 하나가 하루다.** 달에 들지 않는 앞의 빈칸도 항목으로 온다 — 몇 칸이 비는지는
 * 그 달 1일의 요일이 정하고, 그것을 화면이 셈하면 달력의 규칙이 화면에 적힌다
 * (명세가 그렇게 적었다).
 *
 * **오늘이 언제인지는 서버만 안다**(`dayTone`의 설명). 토·일이 갈리고 오늘이 따로 있다.
 */
export async function opsCalendarDays(
  db: Db,
  orgId: string,
  type: ScheduleType | null,
  now: Date,
): Promise<CalendarDay[]> {
  const schedules = await orgSchedules(db, orgId, type)
  const byDay = new Map<string, Schedule[]>()
  for (const one of schedules) {
    const key = dayKey(one.at)
    const already = byDay.get(key)
    if (already === undefined) byDay.set(key, [one])
    else already.push(one)
  }

  const today = dayKey(now)
  const [year, month] = today.split('-') as [string, string]
  // 달마다 1일은 있다. 없으면 오늘을 읽지 못한 것이라 조용히 넘어가지 않는다.
  const first = noonOf(year, month, 1)
  if (first === null) throw new Error(`${year}-${month}의 1일을 읽지 못했습니다.`)
  const cells: CalendarDay[] = []

  // 앞의 빈칸. **날짜는 실제로 그 앞의 날들이다** — 칸을 가리키는 값이 두 달에서
  // 같아지면 화면이 두 칸을 하나로 본다.
  const lead = sinceSunday(first)
  for (let at = lead; at > 0; at -= 1) {
    cells.push({ id: dayKey(plusDays(first, -at)), dayLabel: '', dayTone: 'gray', schedules: [] })
  }

  for (let at = 1; ; at += 1) {
    const when = noonOf(year, month, at)
    // **그 달에 없는 날은 `momentOf`가 읽지 못한다** — 2월 31일이 3월로 굴러가는
    // 대신 null이 된다. 달의 길이를 여기서 다시 셈하지 않는 까닭이다.
    if (when === null) break
    const key = dayKey(when)
    cells.push({
      id: key,
      dayLabel: String(at),
      dayTone: key === today ? 'today' : weekendTone(when),
      schedules: (byDay.get(key) ?? []).map((one) => ({
        id: one.id,
        title: one.title,
        typeTone: one.type,
      })),
    })
  }

  return cells
}

/** 그 달의 그 날 낮 열두 시. 없는 날이면 null이다. */
function noonOf(year: string, month: string, day: number): Date | null {
  return momentOf(`${year}-${month}-${String(day).padStart(2, '0')}T12:00`)
}

/** 토·일이 갈린다. 요일 머리의 색과 같은 규칙이다(일이 붉고 토가 푸르다). */
function weekendTone(when: Date): string {
  const at = sinceSunday(when)
  if (at === 0) return 'red'
  if (at === 6) return 'blue'
  return 'gray'
}

export interface CalendarWeekRow {
  id: string
  typeLabel: string
  typeTone: string
  dateLabel: string
  title: string
  actionLabel?: string
  eventId?: string
}

/** 그 줄에서 열 수 있는 것. **행사에 딸리지 않은 줄에는 오지 않는다**(명세가 그렇게 적었다). */
const OPEN_EVENT_SCHEDULE = '행사 일정 보기'

/**
 * 이번 주에 걸린 일정 줄(`ops.calendarWeek`).
 *
 * **보고 있는 달과 무관하다** — '이번 주'는 오늘이 정한다.
 */
export async function opsCalendarWeek(
  db: Db,
  orgId: string,
  type: ScheduleType | null,
  now: Date,
): Promise<CalendarWeekRow[]> {
  const schedules = await orgSchedules(db, orgId, type)
  return schedules.filter((one) => inThisWeek(one.at, now)).map(weekRow)
}

/** 그 날짜가 이번 주에 드는가. 시각이 아니라 **날짜**로 센다. */
export function inThisWeek(at: Date, now: Date): boolean {
  const start = -sinceSunday(now)
  const days = daysBetween(now, at)
  return days >= start && days <= start + 6
}

function weekRow(one: Schedule): CalendarWeekRow {
  return {
    id: one.id,
    typeLabel: LABEL.get(one.type) ?? one.type,
    typeTone: one.type,
    dateLabel: shortDay(one.at),
    title: one.title,
    // **함께 오거나 함께 오지 않는다**(명세가 그렇게 적었다).
    ...(one.eventId === null
      ? {}
      : { actionLabel: OPEN_EVENT_SCHEDULE, eventId: one.eventId }),
  }
}

/** 유형 딱지의 글. 홈의 '다가오는 주요 일정'이 같은 말을 딱지로 쓴다. */
export function labelOf(type: ScheduleType): string {
  return LABEL.get(type) ?? type
}
