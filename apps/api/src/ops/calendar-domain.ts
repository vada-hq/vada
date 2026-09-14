import optionSources from '../../../../specs/figma/vada-wireframe/option-sources.json' with { type: 'json' }
import { Blocked } from '../errors.ts'
import { daysBetween, moment } from '../time.ts'

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
export const LABEL = new Map(TYPES.map((one) => [one.value, one.label]))

/** 같은 날에 여럿이 걸리면 어느 것이 먼저인가. 범례가 그린 차례다(행사·회의·마감). */
export const RANK = new Map(TYPES.map((one, at) => [one.value, at]))

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
export function dayKey(when: Date): string {
  return moment(when).slice(0, 10)
}

/** `07.20` — 좁은 자리가 쓰는 꼴. */
export function shortDay(when: Date): string {
  return moment(when).slice(5, 10).replace('-', '.')
}

/** 하루씩 옮긴 때. 셈에만 쓰므로 낮 12시 언저리를 그대로 민다. */
export function plusDays(when: Date, days: number): Date {
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
/** 유형 딱지의 글. 홈의 '다가오는 주요 일정'이 같은 말을 딱지로 쓴다. */
export function labelOf(type: ScheduleType): string {
  return LABEL.get(type) ?? type
}
