// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import type { HomeDepartmentBoard, HomeResponse, TaskSummary } from '@vada/contracts'
import { councilView, teamResponse } from '@/test-support/council-fixtures'
import {
  boardEvent,
  councilHome,
  emptyOps,
  homeResponse,
  memberHome,
  noRooms,
} from '@/test-support/home-fixtures'
import { json, mockApi } from '@/test-support/mock-api'
import { narrowedTasksResponse } from '@/test-support/task-list-fake'
import { taskDetail } from '@/test-support/task-detail-fixtures'
import { rememberTaskTab } from '@/lib/task-layout'
import TasksPage from '@/tasks/TasksPage'
import HomePage from './HomePage'

test('홈 업무 링크와 학생회 전체 범위는 옛 view 쿼리를 만들지 않는다', () => {
  // jsdom 환경의 import.meta.url은 file 주소가 아니라 Vite가 원문을 모아 준다.
  const sources = Object.values(
    import.meta.glob<string>(['./*.tsx', '!./*.test.tsx'], {
      query: '?raw',
      import: 'default',
      eager: true,
    }),
  ).join('\n')
  expect(sources).toMatch(/openMenu\('tasks'/)
  expect(sources).not.toMatch(/openMenu\('tasks',\s*[^,]+,\s*\{[^}]*\bview:/)
  expect(sources).not.toMatch(/openEventTasks\([^;{}]*\{[^}]*\bview:/)
  expect(sources).not.toMatch(/seeTasks\(\{[^}]*\bview:/)
  expect(sources).not.toMatch(/const ALL = \{[^}]*\bview:/)
})

const C = '01900000-0000-7000-8000-000000000001'
const E = '01900000-0000-7000-8000-000000000002'
const department = { id: '01900000-0000-7000-8000-000000000003', name: '기획부' }
const other = { id: '01900000-0000-7000-8000-000000000004', name: '홍보부' }
const person = { id: '01900000-0000-7000-8000-000000000005', name: '김운영', current: true }
const event = { id: E, name: '가을 축제' }
const view = councilView(C, {
  councilRank: null,
  memberId: person.id,
  departments: [{ ...department, rank: 'head', role: null }],
})
const tasks: TaskSummary[] = [
  taskDetail({ id: 'late', title: '기획 지난 업무', department, event, overdue: true }),
  taskDetail({
    id: 'both',
    title: '지난 담당자 없는 업무',
    department,
    event,
    overdue: true,
    assignee: null,
  }),
  taskDetail({
    id: 'free',
    title: '담당자 없는 상시 업무',
    department,
    event: null,
    assignee: null,
  }),
  taskDetail({
    id: 'left',
    title: '떠난 담당자 업무',
    department,
    event: null,
    assignee: { ...person, id: 'left-member', current: false },
  }),
  taskDetail({
    id: 'other',
    title: '다른 부서 지난 업무',
    department: other,
    event: null,
    overdue: true,
  }),
  taskDetail({ id: 'normal', title: '진행할 업무', department, event, assignee: person }),
  taskDetail({
    id: 'done',
    title: '끝난 업무',
    department,
    event,
    overdue: true,
    assignee: null,
    status: 'done',
  }),
]

afterEach(() => {
  cleanup()
  window.history.replaceState(null, '', '/')
  window.localStorage.clear()
  vi.unstubAllGlobals()
})

const attention = (items: TaskSummary[]) => ({
  // 홈 응답은 앞줄만 주지만 머리 수는 전체 범위다.
  items: items.slice(0, 3).map(task => ({
    task: { ...task, group: 'overdue' as const },
    reason: task.overdue ? ('overdue' as const) : ('unassigned' as const),
  })),
  total: items.length,
})

function departmentBoard(items: TaskSummary[]): HomeDepartmentBoard {
  return {
    departments: [department],
    attention: attention(items),
    purchases: { requests: [], total: 0 },
    ownedEnded: [],
    congestion: null,
  }
}

// 행사(event)와 상태(status)로 고른 거르기 전 목록. 보기·칩은 가짜 서버(narrowedTasksResponse)가 건다.
function listOf(list: TaskSummary[], path: string) {
  const query = new URL(path, 'http://localhost').searchParams
  const event = query.get('event')
  const done = query.get('status') === 'done'
  return list.filter(
    task =>
      (task.status === 'done') === done &&
      (event === null || (event === 'none' ? task.event === null : task.event?.id === event)),
  )
}

function setup(home: HomeResponse, list = tasks) {
  window.history.replaceState(null, '', `/home/${C}`)
  const api = mockApi()
  const base = `/api/organizations/${C}`
  api.on('GET', `${base}/home`, () => json(home))
  api.on('GET', `${base}/events`, () => json({ events: [], truncated: false }))
  for (const query of ['', `?event=${E}`])
    api.on('GET', `${base}/tasks/options${query}`, () =>
      json({ departments: [], linkableEvents: [] }),
    )
  api.on('GET', `${base}/members`, () => {
    const team = teamResponse()
    return json({ ...team, departments: [department, other] })
  })
  // jsdom 폭은 1024px 아래라 도착 화면은 상태 탭이고, 끝남 탭 수를 세려고 끝난 업무도 읽는다.
  api.onPrefix(
    'GET',
    `${base}/tasks?`,
    narrowedTasksResponse(path => listOf(list, path), {
      memberId: person.id,
      heads: [department.id],
    }),
  )
  const shown = render(
    <HomePage
      view={view}
      rooms={noRooms}
      onForbidden={vi.fn()}
      onOpenEvent={vi.fn()}
      onOpenPage={vi.fn()}
    />,
  )
  const destination = (eventId?: string) => {
    shown.unmount()
    render(<TasksPage view={view} eventId={eventId} onForbidden={vi.fn()} onChanged={vi.fn()} />)
  }
  return { api, destination }
}

async function expectTasks(expected: TaskSummary[], all = tasks) {
  for (const task of expected)
    expect(await screen.findByRole('button', { name: task.title })).toBeTruthy()
  const titles = all.map(task => task.title)
  const shown = screen
    .getAllByRole('button')
    .filter(button =>
      titles.includes(button.getAttribute('aria-label') ?? button.textContent ?? ''),
    )
  expect(shown).toHaveLength(expected.length)
}

test('① 부서 미정 업무 n건은 업무 목록의 부서 없음 + 담당자 없음 거르기로 가고 같은 수를 보인다', async () => {
  const noDepartment = [
    taskDetail({
      id: 'nd1',
      title: '부서 미정 업무',
      department: null,
      event: null,
      assignee: null,
    }),
    taskDetail({
      id: 'nd2',
      title: '떠난 담당자의 부서 미정 행사 업무',
      department: null,
      event,
      assignee: { ...person, id: 'left-member', current: false },
    }),
  ]
  const list = [
    ...tasks,
    ...noDepartment,
    taskDetail({ id: 'nd3', title: '부서 없는 담당자 업무', department: null, assignee: person }),
  ]
  const { api, destination } = setup(
    councilHome({
      ops: emptyOps({
        assign: { noDepartment: 2, unassignedMembers: 0, financeStaffed: true },
        total: 2,
      }),
    }),
    list,
  )
  const card = within(await screen.findByRole('region', { name: '확인이 필요한 운영 상황' }))
  fireEvent.click(card.getByRole('button', { name: '부서 미정 업무 2건' }))
  destination()
  await expectTasks(noDepartment, list)
  api.assertNoUnexpectedRequests()
})

test.each([
  { label: '지남 2', query: 'due=overdue', ids: ['late', 'both'] },
  { label: '담당자 없음 1', query: 'assignee=none', ids: ['both'] },
])(
  '행사 이유 칩 $label은 그 칩이 켜진 행사 업무 탭에서 같은 수를 보인다',
  async ({ label, query, ids }) => {
    const { api, destination } = setup(
      councilHome({
        events: {
          cards: [boardEvent(E, { tasks: { done: 1, total: 4, overdue: 2, unassigned: 1 } })],
          counts: { planning: 1, ongoing: 0, followUp: 0 },
        },
      }),
    )
    fireEvent.click(await screen.findByRole('button', { name: label }))
    expect(window.location.pathname + window.location.search).toBe(
      `/events/${C}/${E}?tab=tasks&${query}`,
    )
    destination(E)
    await expectTasks(tasks.filter(task => ids.includes(task.id)))
    expect(screen.getByRole('button', { name: label }).getAttribute('aria-pressed')).toBe('true')
    api.assertNoUnexpectedRequests()
  },
)

test('부서장 업무 전체 보기는 그 부서 칩과 행사 포함으로 홈의 확인 필요 수를 유지한다', async () => {
  const expected = tasks.slice(0, 4)
  const { api, destination } = setup(homeResponse({ departmentBoard: departmentBoard(expected) }))
  fireEvent.click(await screen.findByRole('button', { name: '업무 전체 보기' }))
  expect(new URLSearchParams(window.location.search).get('view')).toBeNull()
  destination()
  await expectTasks(expected)
  expect(screen.getByRole('button', { name: department.name }).getAttribute('aria-pressed')).toBe(
    'true',
  )
  expect(screen.getByRole('button', { name: '행사 업무 포함' }).getAttribute('aria-pressed')).toBe(
    'true',
  )
  fireEvent.click(screen.getByRole('button', { name: '필터 해제' }))
  expect(await screen.findByRole('button', { name: '다른 부서 지난 업무' })).toBeTruthy()
  api.assertNoUnexpectedRequests()
})

// 회장단 홈은 배치 L3에서 인사 카드의 내 업무 바로가기가 빠졌다(③ 내가 할 일이 시연 조각 ㉯에서 그 자리를 맡는다).
test.each(['department', 'finance', 'member'] as const)(
  '$s 홈의 내 업무는 마지막 학생회 탭과 무관하게 내 업무 탭으로 간다',
  async kind => {
    const empty = homeResponse()
    const homes = {
      department: homeResponse({ departmentBoard: departmentBoard([]) }),
      finance: homeResponse({
        kind: 'finance',
        financeBoard: {
          pending: { requests: [], total: 0, truncated: false },
          nearby: { items: [], total: 0 },
          settling: { events: [], total: 0 },
          budgets: { events: [], total: 0 },
          departments: [],
          ownedEnded: [],
        },
      }),
      member: memberHome(),
    }
    rememberTaskTab(person.id, 'council')
    const { api, destination } = setup({
      ...empty,
      ...homes[kind],
      myTasks: { open: 1, overdue: 0, nearest: null },
    })
    fireEvent.click(await screen.findByRole('button', { name: '내 업무 1' }))
    expect(window.location.pathname + window.location.search).toBe(`/tasks/${C}?tab=mine`)
    destination()
    expect(screen.getByRole('tab', { name: '내 업무' }).getAttribute('aria-selected')).toBe('true')
    await expectTasks(tasks.filter(task => task.id === 'normal'))
    api.assertNoUnexpectedRequests()
  },
)
