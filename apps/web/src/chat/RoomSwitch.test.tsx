// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { room } from '@/test-support/chat-fixtures'
import RoomSwitch from './RoomSwitch'

afterEach(cleanup)

const notice = room('notice', { unread: 2 })
const department = room('department', {
  type: 'department',
  name: '기획부',
  departmentId: 'planning',
  unread: 3,
})

test.each([{ rooms: [] }, { rooms: [notice] }])(
  '방이 1개 이하면 전환 줄과 구분선·여백이 없다 (%#)',
  ({ rooms }) => {
    const { container } = render(
      <RoomSwitch rooms={rooms} activeId={rooms[0]?.id ?? null} onPick={vi.fn()} />,
    )
    expect(screen.queryByRole('group', { name: '대화방' })).toBeNull()
    expect(container.firstChild).toBeNull()
  },
)

test('방이 2개면 전환 줄에서 두 방을 보이고 다른 방을 고를 수 있다', () => {
  const onPick = vi.fn()
  render(<RoomSwitch rooms={[notice, department]} activeId={department.id} onPick={onPick} />)
  const group = screen.getByRole('group', { name: '대화방' })
  expect(within(group).getAllByRole('button')).toHaveLength(2)
  expect(
    within(group)
      .getByRole('button', { name: /기획부 방/ })
      .getAttribute('aria-pressed'),
  ).toBe('true')
  fireEvent.click(within(group).getByRole('button', { name: /공지방/ }))
  expect(onPick).toHaveBeenCalledWith(notice.id)
})
