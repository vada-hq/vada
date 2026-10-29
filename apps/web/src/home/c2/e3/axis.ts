import { useLayoutEffect, useState, type RefObject } from 'react'
import { C2_TODAY } from '../c2-data'
import {
  AXIS_DAYS_NARROW,
  AXIS_DAYS_WIDE,
  AXIS_WIDE_MIN,
  GUTTER_NARROW,
  GUTTER_WIDE,
} from './tokens'

// 가로 시간 축의 기하. 묶음 안쪽 폭 W를 재서 오늘(0일)부터 days-1일까지의 x를 낸다.
// 오늘 선은 왼쪽 머리글자 칸(gutter) 끝에 서고, 마지막 날은 반 칸을 남겨 날짜 글이 묶음 밖으로 나가지 않게 한다.
export type Axis = {
  width: number
  days: number
  gutter: number
  step: number
  x: (day: number) => number
}

const HALF = 0.5

export function axisOf(width: number): Axis {
  const wide = width >= AXIS_WIDE_MIN
  const days = wide ? AXIS_DAYS_WIDE : AXIS_DAYS_NARROW
  const gutter = wide ? GUTTER_WIDE : GUTTER_NARROW
  const step = Math.max(0, (width - gutter) / (days - HALF))
  return { width, days, gutter, step, x: day => gutter + day * step }
}

// 폭을 재고 바뀌면 다시 잰다(그리기 전에 한 번 재서 깜박임이 없다).
export function useAxis(ref: RefObject<HTMLElement | null>): Axis {
  const [width, setWidth] = useState(0)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    setWidth(el.clientWidth)
    const observer = new ResizeObserver(() => setWidth(el.clientWidth))
    observer.observe(el)
    return () => observer.disconnect()
  }, [ref])
  return axisOf(width)
}

// 축 머리 날짜: 오늘부터 days일
const WEEK = ['일', '월', '화', '수', '목', '금', '토']
const DAY_MS = 86_400_000
export type AxisDay = { day: number; date: number; month: number; weekday: string }

export function axisDays(days: number): AxisDay[] {
  const start = new Date(`${C2_TODAY}T00:00:00Z`).getTime()
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
