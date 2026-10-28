// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { CALENDAR_KIND_LABELS, SCHEDULE_TYPES } from '@vada/contracts'
import UpcomingCard from './UpcomingCard'

afterEach(() => {
  cleanup()
  window.history.replaceState(null, '', '/')
})
const councilId = '019e0000-0000-7000-8000-000000000001'
const id = '019e0000-0000-7000-8000-000000000002'

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
