// @vitest-environment jsdom
import { afterEach, expect, test } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import type { TaskSummary } from '@vada/contracts'
import { TaskRow } from './TaskRow'

afterEach(cleanup)

const LONG_URL = `https://example.com/${'a'.repeat(400)}`
const task: TaskSummary = {
  id: 'a',
  title: LONG_URL,
  status: 'todo',
  next: 'in_progress',
  dueDate: null,
  overdue: false,
  department: null,
  event: null,
  assignee: null,
  actions: [],
}

// jsdom은 배치를 재지 않으므로 줄어들 수 있는지를 class로 본다. Button 바탕의 shrink-0이 남으면 띄어쓰기 없는 제목이 줄을 2500px로 늘린다(mob-0 지적 1).
test('띄어쓰기 없는 긴 제목 단추가 줄어들어 줄이 목록 폭을 넘지 않는다', () => {
  render(
    <ul>
      <TaskRow
        task={task}
        show={{ assignee: true, department: false, event: true }}
        busy={false}
        onOpen={() => {}}
      />
    </ul>,
  )
  const title = screen.getByRole('button', { name: LONG_URL })
  expect(title.classList).toContain('shrink')
  expect(title.classList).not.toContain('shrink-0')
  expect(title.classList).toContain('wrap-anywhere')
  expect(title.classList).toContain('min-w-0')
})
