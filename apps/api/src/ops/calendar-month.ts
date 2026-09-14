import type { Db } from '../db/client.ts'
import { momentOf } from '../time.ts'
import {
  dayKey,
  plusDays,
  shortDay,
  sinceSunday,
  thisWeek,
  type Schedule,
  type ScheduleType,
} from './calendar-domain.ts'
import { orgSchedules } from './calendar-schedules.ts'

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
