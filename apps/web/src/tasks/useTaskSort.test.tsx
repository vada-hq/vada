// @vitest-environment jsdom
import { afterEach, expect, test } from 'vitest'
import { act, cleanup, renderHook } from '@testing-library/react'
import type { TaskSummary } from '@vada/contracts'
import { responseOf, useSortedTasks } from './useTaskSort'
import type { TaskList } from './useTasks'

const task = (id: string, dueDate: string | null): TaskSummary => ({
  id,
  title: id,
  status: 'todo',
  next: 'in_progress',
  dueDate,
  overdue: false,
  department: null,
  event: null,
  assignee: null,
  actions: [],
  createdAt: `2026-10-0${id}T00:00:00.000Z`,
})
const tasks = [task('1', '2026-11-01'), task('2', '2026-10-26')]
const list = (rows: TaskSummary[]): TaskList => ({
  state: { kind: 'ready', tasks: rows, truncated: false },
  reload: () => Promise.resolve(),
})
const lists = { list: list(tasks), done: list([]) }
const view = { me: { memberId: 'm1' } } as Parameters<typeof useSortedTasks>[0]

afterEach(() => {
  cleanup()
  window.localStorage.clear()
})

const shown = (current: ReturnType<typeof useSortedTasks>) => {
  const { state } = current.list
  return state.kind === 'ready' ? state.tasks : []
}

// 표의 칸 고침은 새 응답이 올 때만 풀린다(TaskListBody). 정렬이나 부서 차례만 바뀐 배열은 같은 응답으로 본다.
test('정렬을 바꿔 새로 줄 세운 배열도 받은 응답 배열로 돌아간다', () => {
  const { result, rerender } = renderHook(({ team }) => useSortedTasks(view, lists, team), {
    initialProps: { team: null as { departments: { id: string }[] } | null },
  })
  const first = shown(result.current)
  expect(responseOf(first)).toBe(tasks)
  act(() => result.current.sort.onChange('recent'))
  const second = shown(result.current)
  expect(second.map(item => item.id)).toEqual(['2', '1'])
  expect(second).not.toBe(first)
  expect(responseOf(second)).toBe(tasks)
  rerender({ team: { departments: [{ id: 'd1' }] } })
  expect(responseOf(shown(result.current))).toBe(tasks)
  expect(window.localStorage.getItem('vada.task.sort.m1')).toBe('recent')
})
