// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { CALENDAR_KIND_LABELS, SCHEDULE_TYPES, type HomeUpcomingItem } from '@vada/contracts'
import UpcomingCard from './UpcomingCard'

afterEach(() => {
  cleanup()
  window.history.replaceState(null, '', '/')
})
const councilId = '019e0000-0000-7000-8000-000000000001'
const id = '019e0000-0000-7000-8000-000000000002'

test.each([0, 1, 3, 4, 12])('일정 전체 %i건 중 3건을 넘을 때만 캘린더 전체 보기가 있다', total => {
  const item: HomeUpcomingItem = {
    kind: 'schedule_item',
    date: '2026-10-28',
    time: null,
    item: { id, title: '시험 기간', type: 'academic' },
  }
  render(
    <UpcomingCard
      councilId={councilId}
      title="가까운 일정"
      upcoming={{ total, items: total === 0 ? [] : [item] }}
      onOpenTask={vi.fn()}
      onOpenEvent={vi.fn()}
    />,
  )
  if (total <= 3) {
    expect(screen.queryByRole('button', { name: /전체/ })).toBeNull()
    expect(screen.getByText(`${total}건`)).toBeTruthy()
    return
  }
  fireEvent.click(screen.getByRole('button', { name: `전체 ${total}건 보기` }))
  expect(window.location.pathname + window.location.search).toBe(`/calendar/${councilId}`)
})

test.each(SCHEDULE_TYPES)('가까운 %s 일정의 종류·제목을 보이고 일정 주소로 연다', type => {
  const opens = { onOpenTask: vi.fn(), onOpenEvent: vi.fn() }
  render(
    <UpcomingCard
      councilId={councilId}
      title="가까운 일정"
      {...opens}
      upcoming={{
        total: 1,
        items: [
          {
            kind: 'schedule_item',
            date: '2026-10-28',
            time: null,
            item: { id, title: '시험 기간', type },
          },
        ],
      }}
    />,
  )
  expect(screen.getByText(CALENDAR_KIND_LABELS[type])).toBeTruthy()
  expect(screen.getByText('종일')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '시험 기간' }))
  expect(window.location.pathname).toBe(`/schedule/${councilId}/${id}`)
  expect(opens.onOpenTask).not.toHaveBeenCalled()
  expect(opens.onOpenEvent).not.toHaveBeenCalled()
})
