// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { TaskSummary } from '@vada/contracts'
import { councilView, teamResponse } from '@/test-support/council-fixtures'
import { json, mockApi } from '@/test-support/mock-api'
import { COUNCIL_ID } from '@/test-support/workspace-at'
import TasksPage from './TasksPage'

const base = `/api/organizations/${COUNCIL_ID}`
const FINANCE = { id: '0199d1a0-0000-7000-8000-0000000000d1', name: '재정부' }
const PLANNING = { id: '0199d1a0-0000-7000-8000-0000000000d2', name: '기획부' }
// 조직의 부서 차례는 재정부 → 기획부다(이름순이면 기획부가 앞이다).
const team = () => {
  const response = teamResponse()
  const [finance, planning] = response.departments
  return {
    ...response,
    departments: [
      { ...finance!, ...FINANCE },
      { ...planning!, ...PLANNING },
    ],
  }
}

const task = (
  id: string,
  department: TaskSummary['department'],
  dueDate: string | null,
  day: string,
): TaskSummary => ({
  id,
  title: id,
  status: 'todo',
  next: 'in_progress',
  dueDate,
  overdue: false,
  department,
  event: null,
  assignee: { id: 'm1', name: '김회장', current: true },
  actions: ['task.change_status'],
  createdAt: `2026-10-${day}T01:00:00.000Z`,
})

// 서버는 마감 순으로 준다.
const OPEN = [
  task('학생회-일찍', null, '2026-10-26', '01'),
  task('기획-일찍', PLANNING, '2026-10-27', '02'),
  task('재정-늦음', FINANCE, '2026-11-02', '03'),
  task('기획-없음', PLANNING, null, '04'),
  task('재정-없음', FINANCE, null, '05'),
]

function wide() {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: true,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
}

let api: ReturnType<typeof mockApi>
function serve(query = '') {
  window.history.replaceState(null, '', `/tasks/${COUNCIL_ID}${query}`)
  api = mockApi()
  api.on('GET', `${base}/members`, () => json(team()))
  api.on('GET', `${base}/events`, () => json({ events: [], truncated: false }))
  api.on('GET', `${base}/tasks/options`, () => json({ departments: [], linkableEvents: [] }))
  // 서버가 거르는 칩(부서)은 주소로 받아 그 부서만 준다.
  api.onPrefix('GET', `${base}/tasks?`, call => {
    const url = new URL(call.path, 'http://localhost')
    const status = url.searchParams.get('status')
    const dept = url.searchParams.get('dept')
    const mine = url.searchParams.get('view') === 'mine'
    const tasks =
      status === 'done' ? [] : OPEN.filter(item => !dept || item.department?.id === dept)
    return json({ tasks: mine ? tasks.filter(item => item.department) : tasks, truncated: false })
  })
  render(<TasksPage view={councilView(COUNCIL_ID)} onForbidden={() => {}} onChanged={() => {}} />)
}

const todoTitles = async () => {
  const todo = await screen.findByRole('region', { name: /^할 일/ })
  await waitFor(() => expect(within(todo).queryAllByRole('listitem').length).toBeGreaterThan(0))
  return within(todo)
    .getAllByRole('listitem')
    .map(item => OPEN.find(row => item.textContent?.includes(row.id))?.id)
}
const sortSelect = () => screen.getByRole<HTMLSelectElement>('combobox', { name: '정렬' })

beforeEach(() => {
  window.localStorage.clear()
  wide()
})
afterEach(() => {
  cleanup()
  api.assertNoUnexpectedRequests()
  window.history.replaceState(null, '', '/')
  vi.unstubAllGlobals()
})

test('보드의 기본 정렬은 부서별이다: 조직의 부서 차례, 같은 부서 안은 마감 임박 순에 마감 없음은 뒤, 부서 없는 업무는 맨 뒤', async () => {
  serve()
  const titles = await todoTitles()
  expect(sortSelect().value).toBe('department')
  expect(titles).toEqual(['재정-늦음', '재정-없음', '기획-일찍', '기획-없음', '학생회-일찍'])
})

test('정렬을 바꾸면 열 안의 차례가 바뀌고, 이 기기에 사람마다 기억해 다시 열어도 남는다', async () => {
  serve()
  await todoTitles()
  fireEvent.change(sortSelect(), { target: { value: 'recent' } })
  await waitFor(async () => expect((await todoTitles())[0]).toContain('재정-없음'))
  expect((await todoTitles()).at(-1)).toContain('학생회-일찍')
  fireEvent.change(sortSelect(), { target: { value: 'due' } })
  await waitFor(async () => expect((await todoTitles())[0]).toContain('학생회-일찍'))
  cleanup()
  serve()
  expect((await todoTitles())[0]).toContain('학생회-일찍')
  expect(sortSelect().value).toBe('due')
  // 정렬은 서버에 보내지 않는다(목록 상한 안의 차례만 바꾼다).
  expect(api.calls.some(call => call.path.includes('sort'))).toBe(false)
})

test('부서 칩으로 서버가 거른 목록도 고른 정렬을 따른다', async () => {
  serve(`?dept=${FINANCE.id}`)
  await todoTitles()
  fireEvent.change(sortSelect(), { target: { value: 'recent' } })
  await waitFor(async () => expect(await todoTitles()).toEqual(['재정-없음', '재정-늦음']))
  expect(api.calls.some(call => call.path.includes(`dept=${FINANCE.id}`))).toBe(true)
})

test('내 업무도 기본은 부서별이고 마감 묶음 안에서 정렬을 따르며 검색과 함께 동작한다', async () => {
  serve('?tab=mine')
  const select = await screen.findByRole('combobox', { name: '정렬' })
  expect((select as HTMLSelectElement).value).toBe('department')
  const none = await screen.findByRole('region', { name: '마감 없음' })
  const titles = () =>
    within(none)
      .getAllByRole('listitem')
      .map(item => item.textContent ?? '')
  await waitFor(() => expect(titles()).toHaveLength(2))
  expect(titles()[0]).toContain('재정-없음')
  expect(titles()[1]).toContain('기획-없음')
  fireEvent.change(select, { target: { value: 'recent' } })
  expect(titles()[0]).toContain('재정-없음')
  fireEvent.change(select, { target: { value: 'due' } })
  expect(titles()[0]).toContain('기획-없음')
  fireEvent.change(screen.getByRole('searchbox', { name: '검색' }), { target: { value: '기획' } })
  await waitFor(() => expect(screen.queryByText('재정-없음')).toBeNull())
  expect(screen.getByText('기획-없음')).toBeTruthy()
})
