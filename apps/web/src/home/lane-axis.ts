import { useLayoutEffect, useState, type RefObject } from 'react'
import { DAY_MS } from '@vada/contracts'

// ② 행사의 가로 시간 축 기하(e6 확정 시안). 묶음 안쪽 폭 W를 재서 오늘(0일)부터 days-1일까지의 x를 낸다.
// 오늘 선은 왼쪽 행사 네모 칸(gutter) 끝에 서고, 마지막 날은 반 칸을 남겨 날짜 글이 묶음 밖으로 나가지 않게 한다.
// 막대의 자리·폭·그라데이션은 잰 폭으로 정하는 기하라 클래스로 줄 수 없어 style로 준다.

// 축 길이: 넓은 폭 14일, 좁은 폭(358) 7일
const AXIS_WIDE_MIN = 560
const AXIS_DAYS_WIDE = 14
const AXIS_DAYS_NARROW = 7
// 왼쪽 행사 네모 칸 폭(= 오늘 선의 x)
const GUTTER_WIDE = 32
const GUTTER_NARROW = 28
// 오늘 선과 이름·일정 글 사이(이름과 일정 글이 같은 x에서 시작한다)
export const NAME_GAP = 10
// 행사 네모 크기와 오늘 선 사이
export const EVENT_MARK_SIZE = 10
export const EVENT_MARK_GAP = 8
// 오늘 선: 날짜 원 가운데(위에서 30px)부터 마지막 줄 막대 가운데까지
export const TODAY_LINE_TOP = 30
export const TODAY_LINE_HALF = 1
const TODAY_LINE_BOTTOM_NARROW = 11
const TODAY_LINE_BOTTOM_WIDE = 8
export const TICK_HALF = 0.5

export type Axis = {
  width: number
  days: number
  gutter: number
  step: number
  x: (day: number) => number
  todayLineBottom: number
}

const HALF = 0.5

export function axisOf(width: number): Axis {
  const wide = width >= AXIS_WIDE_MIN
  const days = wide ? AXIS_DAYS_WIDE : AXIS_DAYS_NARROW
  const gutter = wide ? GUTTER_WIDE : GUTTER_NARROW
  const step = Math.max(0, (width - gutter) / (days - HALF))
  return {
    width,
    days,
    gutter,
    step,
    x: day => gutter + day * step,
    todayLineBottom: wide ? TODAY_LINE_BOTTOM_WIDE : TODAY_LINE_BOTTOM_NARROW,
  }
}

// 폭을 재고 바뀌면 다시 잰다(그리기 전에 한 번 재서 깜박임이 없다). ResizeObserver가 없는 환경(시험)은 첫 폭만 쓴다.
export function useAxis(ref: RefObject<HTMLElement | null>): Axis {
  const [width, setWidth] = useState(0)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    setWidth(el.clientWidth)
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => setWidth(el.clientWidth))
    observer.observe(el)
    return () => observer.disconnect()
  }, [ref])
  return axisOf(width)
}

// 축 머리 날짜: 홈의 오늘(서버가 준 한국 날짜)부터 days일. 브라우저 시계를 쓰지 않는다.
const WEEK = ['일', '월', '화', '수', '목', '금', '토']
export type AxisDay = { day: number; date: number; month: number; weekday: string }

export function axisDays(today: string, days: number): AxisDay[] {
  const start = Date.parse(`${today}T00:00:00Z`)
  return Array.from({ length: days }, (_, day) => {
    const d = new Date(start + day * DAY_MS)
    return {
      day,
      date: d.getUTCDate(),
      month: d.getUTCMonth() + 1,
      weekday: WEEK[d.getUTCDay()] ?? '',
    }
  })
}

// 막대 진하기: 오늘 쪽 진하고 축 끝으로 갈수록 옅다(행사마다가 아니라 날짜 자리마다 같은 진하기).
// [축 위 자리(오늘 0 → 축 끝 1), 진하기]. 처음 4분의 1까지 진하고 그 뒤 빨리 옅어진다.
const BAR_AT_TODAY = 0.85
const BAR_KNEE_1 = 0.25
const BAR_AT_KNEE_1 = 0.6
const BAR_KNEE_2 = 0.55
const BAR_AT_KNEE_2 = 0.22
const BAR_AT_END = 0.06
export const BAR_STOPS: readonly (readonly [number, number])[] = [
  [0, BAR_AT_TODAY],
  [BAR_KNEE_1, BAR_AT_KNEE_1],
  [BAR_KNEE_2, BAR_AT_KNEE_2],
  [1, BAR_AT_END],
]
// 마름모는 막대보다 이만큼 진하게(작아서)
export const DIAMOND_LIFT = 0.3
export const DIAMOND_MIN = 0.55
// 진행 중: 오늘 선 앞(네모 칸)의 이 비율 자리부터 옅게 번져 들어온다
export const ONGOING_FROM = 0.3

// 날짜 자리 x의 막대 진하기(모든 줄이 같은 자를 쓴다): BAR_STOPS 사이를 곧게 잇는다
export function alphaAt(axis: Axis, x: number) {
  const t = (x - axis.x(0)) / Math.max(1, axis.width - axis.x(0))
  const after = BAR_STOPS.findIndex(([at]) => at >= t)
  if (after <= 0) return BAR_STOPS[0]?.[1] ?? 1
  const [t0, a0] = BAR_STOPS[after - 1] ?? [0, 1]
  const [t1, a1] = BAR_STOPS[after] ?? [1, 1]
  return a0 + ((a1 - a0) * (t - t0)) / Math.max(Number.EPSILON, t1 - t0)
}
