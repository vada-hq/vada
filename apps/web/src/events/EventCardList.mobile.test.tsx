// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { eventSummary } from '@/test-support/event-fixtures'
import { navigationWidth } from '@/test-support/navigation-width'
import { EventCardList } from './EventCardList'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

test.each([390, 768, 1024])(
  '%i 폭: 휴대폰은 옆 메뉴와 같은 행사를 먼저, 넓은 화면은 기존 순서다',
  width => {
    navigationWidth(width)
    const events = [
      eventSummary({ id: 'ended', name: '끝난 행사', status: 'ended' }),
      eventSummary({ id: 'ongoing', name: '진행 행사', status: 'ongoing' }),
      eventSummary({ id: 'tbd', name: '기획 행사', status: 'tbd' }),
    ]
    render(
      <EventCardList
        events={events}
        sidebarEvents={[{ id: 'ongoing' }, { id: 'tbd' }]}
        onOpen={() => {}}
      />,
    )
    const names = () =>
      within(screen.getByRole('list', { name: '행사 목록' }))
        .getAllByRole('button')
        .map(button => button.textContent)
    const expected =
      width < 768
        ? ['진행 행사', '기획 행사', '끝난 행사']
        : ['끝난 행사', '진행 행사', '기획 행사']
    expected.forEach((name, index) => expect(names()[index]).toContain(name))
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: '기획' } })
    expect(names()).toEqual([expect.stringContaining('기획 행사')])
  },
)
