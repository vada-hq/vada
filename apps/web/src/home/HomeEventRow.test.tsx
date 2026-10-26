// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import type { EventStatus, HomeEventCard } from '@vada/contracts'
import { homeEvent } from '@/test-support/home-fixtures'
import { eventDetail } from '@/test-support/event-fixtures'
import { EventStatusBar } from '../events/EventStatusBar'
import HomeEventRow from './HomeEventRow'
import WeekEventsSection from './WeekEventsSection'

afterEach(cleanup)

const today = '2026-10-23'
const noTasks = { done: 0, total: 0, overdue: 0, unassigned: 0 }
// 상태마다 그 상태가 되는 일시(기준일 today)
const STARTS: Record<Exclude<EventStatus, 'completed'>, string | null> = {
  tbd: null,
  upcoming: '2026-10-26T18:00',
  ongoing: '2026-10-23T10:00',
  ended: '2026-10-20T10:00',
}
const STATUSES = Object.keys(STARTS) as (keyof typeof STARTS)[]

const card = (status: keyof typeof STARTS): HomeEventCard => ({
  event: homeEvent(status, { status, startsAt: STARTS[status], endsAt: null }),
  tasks: noTasks,
})

function rowOf(status: keyof typeof STARTS) {
  render(
    <ul>
      <HomeEventRow card={card(status)} today={today} onOpen={vi.fn()} />
    </ul>,
  )
  return screen.getByRole('listitem')
}

const chipOf = (root: HTMLElement) => root.querySelector('[data-slot="badge"]')?.textContent

test.each(STATUSES)(
  '회장단 행사 줄(%s)의 행사명 앞 상태 칩은 행사 머리 칩과 글자가 같다',
  status => {
    render(<EventStatusBar event={eventDetail({ status })} actions={null} />)
    const head = chipOf(screen.getByRole('group', { name: '행사 요약' }))
    cleanup()
    const row = rowOf(status)
    expect(chipOf(row)).toBe(head)
    expect(row.textContent?.startsWith(`${head}행사 ${status}`)).toBe(true)
  },
)

test('회장단 행사 줄의 상태는 기획 중·진행 중·후속 정리 중이고 끝남은 없다', () => {
  const chips = STATUSES.map(status => {
    const chip = chipOf(rowOf(status))
    cleanup()
    return chip
  })
  expect(chips).toEqual(['기획 중', '기획 중', '진행 중', '후속 정리 중'])
  expect(chips).not.toContain('끝남')
})

test('줄은 상태 칩, 행사명, 날짜 · 남은 날 차례이고 날짜는 10월 26일 (월) 18:00 꼴이다(왼쪽 날짜 칸 없음)', () => {
  const row = rowOf('upcoming')
  expect(row.textContent).toMatch(/^기획 중행사 upcoming10월 26일 \(월\) 18:00·D-3$/)
  expect(within(row).queryByText('26')).toBeNull()
})

test('날짜 미정 행사는 날짜 자리에 일시 미정이 보이고 화면 읽기에도 읽힌다', () => {
  const row = rowOf('tbd')
  expect(within(row).getByText('일시 미정')).toBeTruthy()
  expect(within(row).queryByText('미정', { exact: true })).toBeNull()
})

test('이번 주 행사 줄도 행사명 앞에 같은 상태 칩이고 남은 날(오늘·내일·D-n)은 날짜 뒤에 있다', () => {
  render(
    <WeekEventsSection
      events={[
        homeEvent('now', { status: 'ongoing' }),
        homeEvent('tomorrow', { status: 'upcoming', startsAt: '2026-10-24T18:00', endsAt: null }),
        homeEvent('soon', { status: 'upcoming', startsAt: '2026-10-25T18:00', endsAt: null }),
      ]}
      today={today}
      noOpenEvents={false}
      onOpenEvent={vi.fn()}
      onSeeAll={vi.fn()}
    />,
  )
  const rows = within(screen.getByRole('region', { name: '이번 주 행사' })).getAllByRole('listitem')
  expect(rows.map(chipOf)).toEqual(['진행 중', '기획 중', '기획 중'])
  expect(rows[1]?.textContent).toMatch(/^기획 중행사 tomorrow10월 24일 \(토\) 18:00·내일$/)
  expect(rows[2]?.textContent).toMatch(/^기획 중행사 soon10월 25일 \(일\) 18:00·D-2$/)
})
