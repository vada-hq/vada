// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import type { TaskSummary } from '@vada/contracts'
import { councilView, teamResponse } from '@/test-support/council-fixtures'
import { TaskCard } from '../tasks/TaskCard'
import { TaskRow } from '../tasks/TaskRow'
import { MemberRow } from '../team/MemberRow'
import { DirectOpenContext, type DirectOpener } from './direct-open'

// 022 조각 7: 업무 담당자와 운영진 목록의 이름도 같은 1:1 열기를 쓴다. 나와 떠난 사람은 누르지 못한다.
afterEach(cleanup)

const members = teamResponse().members
const opener = (): DirectOpener => ({ meId: 'm1', people: members, open: vi.fn() })
const withOpener = (value: DirectOpener, children: ReactNode) =>
  render(<DirectOpenContext value={value}>{children}</DirectOpenContext>)

const task = (extra: Partial<TaskSummary> = {}): TaskSummary => ({
  id: 't1',
  title: '현수막 주문',
  status: 'todo',
  next: 'in_progress',
  dueDate: '2026-10-25',
  overdue: false,
  department: { id: 'd1', name: '재정부' },
  event: null,
  assignee: { id: 'm2', name: '이재정', current: true },
  actions: ['task.change_status'],
  ...extra,
})
const noop = () => {}
const card = (item: TaskSummary, onOpen = noop) => (
  <ul>
    <TaskCard
      task={item}
      color={{ line: '', chip: '' }}
      busy={false}
      onOpen={onOpen}
      onChangeStatus={noop}
    />
  </ul>
)

test('업무 카드의 담당자를 누르면 카드 상세 대신 그 사람과 1:1을 연다', () => {
  const value = opener()
  const onCard = vi.fn()
  withOpener(value, card(task(), onCard))
  fireEvent.click(screen.getByRole('button', { name: '이재정 1:1 대화' }))
  expect(value.open).toHaveBeenCalledWith(members[1])
  expect(onCard).not.toHaveBeenCalled()
})

test('떠난 담당자와 내가 담당인 업무의 이름은 누를 수 없다', () => {
  withOpener(
    opener(),
    <>
      {card(task({ assignee: { id: 'm9', name: '정떠남', current: false } }))}
      {card(task({ id: 't2', assignee: { id: 'm1', name: '김회장', current: true } }))}
    </>,
  )
  expect(screen.getByText('떠난 사람: 정떠남')).toBeTruthy()
  expect(screen.getByText('김회장')).toBeTruthy()
  expect(screen.queryByRole('button', { name: /1:1 대화/ })).toBeNull()
})

test('업무 목록 줄의 담당자도 1:1을 연다', () => {
  const value = opener()
  withOpener(
    value,
    <TaskRow
      task={task()}
      show={{ assignee: true, department: false, event: false }}
      busy={false}
      onChangeStatus={noop}
      onOpen={noop}
    />,
  )
  fireEvent.click(screen.getByRole('button', { name: '이재정 1:1 대화' }))
  expect(value.open).toHaveBeenCalledWith(members[1])
})

test('운영진 목록의 이름은 나를 빼고 1:1을 연다', () => {
  const value = opener()
  const view = councilView()
  const row = (index: number) => (
    <MemberRow
      member={members[index]!}
      departments={[]}
      titles={view.council.titles}
      actions={{ assign: false, rank: false, transfer: false, remove: false }}
      saving={false}
      triggerRef={noop}
      onAssign={noop}
      onToggleRank={noop}
      onTransfer={noop}
      onRemove={noop}
    />
  )
  withOpener(
    value,
    <ul>
      {row(0)}
      {row(2)}
    </ul>,
  )
  expect(screen.queryByRole('button', { name: '김회장 1:1 대화' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: '박새내 1:1 대화' }))
  expect(value.open).toHaveBeenCalledWith(members[2])
})

test('1:1을 열 수 없는 곳(작업 공간 밖)에서는 이름이 글로만 보인다', () => {
  render(card(task()))
  expect(screen.getByText('이재정')).toBeTruthy()
  expect(screen.queryByRole('button', { name: /1:1 대화/ })).toBeNull()
})
