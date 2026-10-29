// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import type {
  HomeOpsPerson,
  HomeResponse,
  HomeTodoRow,
  HomeWeekItem,
  MeetingAction,
  TaskSummary,
} from '@vada/contracts'
import { councilView } from '@/test-support/council-fixtures'
import {
  councilHome,
  emptyTodo,
  emptyWeek,
  followUpRow,
  homeTask,
  noRooms,
} from '@/test-support/home-fixtures'
import { mockApi, json } from '@/test-support/mock-api'
import HomePage from './HomePage'

// 회장단 홈 오른쪽 단(시연 조각 ㉯): ③ 내가 할 일, ⑤ 이번 주, 사용 가능 한 줄.

afterEach(() => {
  cleanup()
  window.history.replaceState(null, '', '/')
  vi.unstubAllGlobals()
})

const pathNow = () => window.location.pathname + window.location.search

function open(home: HomeResponse) {
  const api = mockApi()
  api.on('GET', '/api/organizations/c1/home', () => json(home))
  const fns = { onOpenEvent: vi.fn(), onOpenPage: vi.fn() }
  render(<HomePage view={councilView('c1')} rooms={noRooms} onForbidden={vi.fn()} {...fns} />)
  return fns
}

const person = (name: string, role: HomeOpsPerson['role']) => ({
  memberId: `m-${name}`,
  name,
  role,
  tint: 1,
})
const taskOf = (id: string, title: string): TaskSummary => homeTask(id, 'overdue', { title })

const minutes: HomeTodoRow = {
  kind: 'minutes',
  meeting: { id: 'm1', title: '10월 4주 운영진 회의', endsAt: '2026-10-22T20:00' },
  decisions: 1,
  followUps: 2,
}
const tidy: HomeTodoRow = {
  kind: 'event_tidy',
  ...followUpRow('e1', { remaining: { tasks: 1, settlement: 1 } }),
  settlementContact: person('정하늘', {
    kind: 'finance_head',
    department: '재정부',
    title: '부장',
  }),
  actions: [],
}
const late: HomeTodoRow = {
  kind: 'task_late',
  task: taskOf('t1', '세칙 개정안 정리'),
  days: 1,
  owner: null,
}
const today: HomeTodoRow = {
  kind: 'task_today',
  task: taskOf('t2', '대표자 회의 자료 제출'),
  days: 0,
  owner: person('이도윤', { kind: 'council', title: '부회장' }),
}

test('③ 줄: 회의록·행사 정리는 확인하기로 원래 화면을 열고, 업무는 줄로 업무를 연다. 위험 색은 업무의 지남·오늘에만', async () => {
  const fns = open(
    councilHome({
      todo: emptyTodo({
        rows: [minutes, tidy, late, today],
        counts: { minutes: 1, event_tidy: 1, task_late: 1, task_today: 1 },
        total: 4,
      }),
    }),
  )
  const todo = await screen.findByRole('region', { name: '내가 할 일' })
  expect(within(todo).getByText('4')).toBeTruthy()
  const [m, e, l, d] = within(todo).getAllByRole('listitem')
  expect(within(m!).getByText('확정 전 · 결정 1 · 후속 업무 2').className).not.toContain(
    'text-danger',
  )
  expect(within(e!).getByText('업무 남음 1 · 정산 남음 1 · 끝난 지 15일')).toBeTruthy()
  expect(within(e!).getByText('정하늘 재정부장에게 묻기')).toBeTruthy()
  // 재정부장에게 묻기는 그 사람과의 1:1을 여는 단추다(묻기 하나뿐).
  expect(within(todo).getAllByRole('button', { name: /묻기/ })).toHaveLength(1)
  expect(within(l!).getByText('1일 지남').className).toContain('text-danger')
  expect(within(d!).getByText('오늘 마감').className).toContain('text-danger')
  expect(within(d!).getByText('이도윤 부회장')).toBeTruthy()
  fireEvent.click(within(m!).getByRole('button', { name: '확인하기' }))
  expect(pathNow()).toBe('/meetings/c1/m1?mode=minutes')
  fireEvent.click(within(e!).getByRole('button', { name: '확인하기' }))
  expect(fns.onOpenEvent).toHaveBeenCalledWith('e1', 'money')
  fireEvent.click(within(l!).getByRole('button', { name: '세칙 개정안 정리' }))
  expect(pathNow()).toBe('/tasks/c1/t1')
})

test('③은 5줄까지이고 접힌 갈래를 센 전체 보기를 누르면 홈 안에서 펼친다. 0건이면 내가 할 일 없음 띠다', async () => {
  const rows = [minutes, tidy, late, late, today, { ...today, task: taskOf('t3', '여섯째') }].map(
    (row, index) =>
      row.kind.startsWith('task') && 'task' in row
        ? { ...row, task: { ...row.task, id: `x${index}` } }
        : row,
  )
  open(
    councilHome({
      todo: emptyTodo({
        rows,
        counts: { minutes: 1, event_tidy: 1, task_late: 2, task_today: 2 },
        total: 6,
      }),
    }),
  )
  const todo = await screen.findByRole('region', { name: '내가 할 일' })
  expect(within(todo).getAllByRole('listitem')).toHaveLength(5)
  const seeAll = within(todo).getByRole('button', { name: /전체 6건 보기/ })
  expect(within(seeAll).getByText('외 1건 · 오늘 마감 1')).toBeTruthy()
  fireEvent.click(seeAll)
  expect(within(todo).getAllByRole('listitem')).toHaveLength(6)
  cleanup()
  open(councilHome())
  expect(await screen.findByRole('heading', { name: '내가 할 일 없음' })).toBeTruthy()
})

const meetingItem = (actions: MeetingAction[]): HomeWeekItem => ({
  kind: 'meeting',
  meeting: {
    id: 'm2',
    title: '11월 1주 운영진 회의',
    heldAt: '2026-10-26T19:00',
    agendaCount: 3,
    actions,
  },
})
const external: HomeWeekItem = {
  kind: 'schedule',
  item: { id: 's1', title: '총학생회 대표자 회의', type: 'external' },
  date: '2026-10-24',
  time: '18:00',
}
const deadline: HomeWeekItem = {
  kind: 'schedule',
  item: { id: 's2', title: '학생회비 집행 내역 제출', type: 'deadline' },
  date: '2026-10-28',
  time: null,
}

test('⑤ 이번 주: 일정마다 띠 한 줄(날짜 · 안건 수 또는 외부·마감), 회의는 안건 올리기로 회의록을 열고 줄은 원래 기록을 연다', async () => {
  open(
    councilHome({
      week: emptyWeek({ items: [external, meetingItem(['meeting.minutes']), deadline], total: 4 }),
    }),
  )
  const week = await screen.findByRole('region', { name: '이번 주' })
  const [e, m, d] = within(week).getAllByRole('listitem')
  expect(e!.textContent).toContain('10월 24일 (토) 18:00 · 외부')
  expect(m!.textContent).toContain('10월 26일 (월) 19:00 · 안건 3')
  expect(d!.textContent).toContain('10월 28일 (수) · 마감')
  fireEvent.click(within(m!).getByRole('button', { name: '안건 올리기' }))
  expect(pathNow()).toBe('/meetings/c1/m2?mode=minutes')
  fireEvent.click(within(e!).getByRole('button', { name: '총학생회 대표자 회의' }))
  expect(pathNow()).toBe('/schedule/c1/s1')
  fireEvent.click(within(week).getByRole('button', { name: /전체 4건 보기/ }))
  expect(pathNow()).toBe('/calendar/c1')
})

test('⑤ 안건 올리기는 회의의 actions에 meeting.minutes가 있을 때만이고, 0건이면 이번 주 일정 없음 띠다', async () => {
  open(councilHome({ week: emptyWeek({ items: [meetingItem([])], total: 1 }) }))
  const week = await screen.findByRole('region', { name: '이번 주' })
  expect(within(week).queryByRole('button', { name: '안건 올리기' })).toBeNull()
  expect(within(week).queryByRole('button', { name: /전체/ })).toBeNull()
  cleanup()
  open(councilHome())
  expect(await screen.findByRole('heading', { name: '이번 주 일정 없음' })).toBeTruthy()
})

const summary = (available: number) => ({
  overview: { total: 1000000, actual: 0, committed: 0, available },
  missing: [],
})

test('사용 가능 한 줄: 음수만 위험 색이고 재정 보기로 재정에 간다. 기간이 없으면 숨기고 재정 담당이 없어도 보인다', async () => {
  open(councilHome({}, { financeSummary: summary(-120000) }))
  const line = await screen.findByRole('region', { name: '사용 가능' })
  expect(within(line).getByText('-120,000원').className).toContain('text-danger')
  fireEvent.click(within(line).getByRole('button', { name: '재정 보기' }))
  expect(pathNow()).toBe('/finance/c1')
  cleanup()
  open(councilHome({}, { financeSummary: summary(470000) }))
  const plus = await screen.findByRole('region', { name: '사용 가능' })
  expect(within(plus).getByText('470,000원').className).not.toContain('text-danger')
  cleanup()
  open(councilHome({}, { financeSummary: { overview: null, missing: [] } }))
  await screen.findByRole('heading', { name: '이번 주 일정 없음' })
  expect(screen.queryByRole('region', { name: '사용 가능' })).toBeNull()
  cleanup()
  open(councilHome({ financeStaffed: false }, { financeSummary: summary(470000) }))
  expect(await screen.findByRole('region', { name: '사용 가능' })).toBeTruthy()
})
