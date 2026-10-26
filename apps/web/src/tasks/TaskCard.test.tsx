// @vitest-environment jsdom
import { afterEach, expect, test } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import type { TaskStatus, TaskSummary } from '@vada/contracts'
import { departmentColorOf } from './department-color'
import { TaskCard } from './TaskCard'

afterEach(cleanup)
const task = (extra: Partial<TaskSummary> = {}): TaskSummary => ({
  id: 'a',
  title: '장소 예약',
  status: 'todo',
  next: 'in_progress',
  dueDate: '2026-10-25',
  overdue: false,
  department: { id: 'd1', name: '기획부' },
  event: null,
  assignee: null,
  actions: ['task.change_status'],
  ...extra,
})
function draw(extra: Partial<TaskSummary> = {}, error?: string) {
  const value = task(extra)
  render(
    <ul>
      <TaskCard
        task={value}
        color={departmentColorOf(value.department?.id ?? null, [{ id: 'd1' }])}
        busy={false}
        onOpen={() => {}}
        onChangeStatus={() => {}}
        error={error}
      />
    </ul>,
  )
  return screen.getByRole('listitem')
}

test.each<TaskStatus>(['todo', 'in_progress', 'done'])(
  '%s 미배정 카드는 담당자 없음만 중립색으로 보이고 부서 색상선이 유지된다',
  status => {
    const card = draw({ status })
    expect(card.className).toContain('border-l-category-1')
    expect(card.className).not.toMatch(/border-(?:l-)?red-/)
    const assignee = within(card).getByText('담당자 없음')
    expect(assignee.className).toContain('text-gray-500')
    expect(card.textContent).not.toContain('배정 필요')
    expect(within(card).getByText('기획부')).toBeTruthy()
  },
)

test('부서 없는 미배정 카드도 학생회 업무의 회색선을 유지한다', () => {
  const card = draw({ department: null })
  expect(card.className).toContain('border-l-gray-400')
  expect(within(card).getByText('학생회 업무')).toBeTruthy()
})

test.each<TaskStatus>(['todo', 'in_progress'])(
  '%s 마감 지남은 칩과 날짜만 빨간 강조이며 부서색을 덮지 않는다',
  status => {
    const card = draw({ status, overdue: true })
    expect(card.className).toContain('border-l-category-1')
    expect(within(card).getByText('지남').className).toContain('text-red-700')
    expect(within(card).getByText('10월 25일 · 지남').className).toContain('text-red-600')
    expect(within(card).getByText('담당자 없음').className).not.toContain('text-red')
  },
)

test('완료 카드에는 오래된 지남 값이 있어도 긴급 표시가 없다', () => {
  const card = draw({ status: 'done', overdue: true })
  expect(within(card).queryByText('지남')).toBeNull()
  expect(within(card).getByText('10월 25일').className).not.toContain('text-red')
})

test('떠난 담당자 이름과 실제 저장 오류의 강조는 유지한다', () => {
  const card = draw(
    { assignee: { id: 'old', name: '김이전', current: false } },
    '저장하지 못했어요.',
  )
  expect(within(card).getByText('떠난 사람: 김이전')).toBeTruthy()
  expect(within(card).getByRole('alert').className).toContain('text-destructive')
})
