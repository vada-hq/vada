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
    expect(screen.queryByRole('tablist', { name: '대화방' })).toBeNull()
    expect(container.firstChild).toBeNull()
  },
)

test('방이 2개면 전환 줄에서 두 방을 보이고 다른 방을 고를 수 있다', () => {
  const onPick = vi.fn()
  render(<RoomSwitch rooms={[notice, department]} activeId={department.id} onPick={onPick} />)
  const group = screen.getByRole('tablist', { name: '대화방' })
  expect(within(group).getAllByRole('tab')).toHaveLength(2)
  expect(
    within(group)
      .getByRole('tab', { name: /기획부 방/ })
      .getAttribute('aria-selected'),
  ).toBe('true')
  expect(within(group).getByLabelText('안 읽은 메시지 3개').textContent).toBe('3')
  expect(within(group).getByLabelText('안 읽은 메시지 2개').textContent).toBe('2')
  fireEvent.click(within(group).getByRole('tab', { name: /공지방/ }))
  expect(onPick).toHaveBeenCalledWith(notice.id)
})

test('방 탭은 화살표와 Home·End로 선택과 초점을 함께 옮긴다', () => {
  const onPick = vi.fn()
  render(<RoomSwitch rooms={[notice, department]} activeId={department.id} onPick={onPick} />)
  const active = screen.getByRole('tab', { name: /기획부 방/ })
  const other = screen.getByRole('tab', { name: /공지방/ })
  active.focus()
  fireEvent.keyDown(active, { key: 'ArrowRight' })
  expect(document.activeElement).toBe(other)
  expect(onPick).toHaveBeenLastCalledWith(notice.id)
  fireEvent.keyDown(other, { key: 'Home' })
  expect(document.activeElement).toBe(other)
  fireEvent.keyDown(other, { key: 'End' })
  expect(document.activeElement).toBe(active)
})

test('선택 인자가 있을 때만 끝에 1:1 탭과 합계 배지가 있고 화살표로 선택한다', () => {
  const onDirect = vi.fn()
  render(
    <RoomSwitch
      rooms={[notice]}
      activeId={notice.id}
      onPick={vi.fn()}
      direct={{ active: false, unread: 4, onPick: onDirect }}
    />,
  )
  const direct = screen.getByRole('tab', { name: /1:1/ })
  expect(screen.getAllByRole('tab').at(-1)).toBe(direct)
  expect(within(direct).getByLabelText('안 읽은 메시지 4개').textContent).toBe('4')
  fireEvent.keyDown(screen.getByRole('tab', { name: /공지방/ }), { key: 'ArrowRight' })
  expect(onDirect).toHaveBeenCalledOnce()
  expect(document.activeElement).toBe(direct)
})
