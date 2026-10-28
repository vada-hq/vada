// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { TaskSummary } from '@vada/contracts'
import { deferredResponse, json, mockApi } from '@/test-support/mock-api'
import { PUSH_ARRIVED_EVENT } from '@/lib/service-worker'
import { councilView, teamResponse } from '@/test-support/council-fixtures'
import { EVENT_ID, eventSummary } from '@/test-support/event-fixtures'
import { COUNCIL_ID } from '@/test-support/workspace-at'
import TasksPage from './TasksPage'

function readsOf(api: ReturnType<typeof mockApi>) {
  return () =>
    api.calls.filter(
      call => call.path === `/api/organizations/${COUNCIL_ID}/tasks?view=mine&status=open`,
    ).length
}

beforeEach(() => {
  window.history.replaceState(null, '', `/tasks/${COUNCIL_ID}?tab=mine`)
})

afterEach(() => {
  cleanup()
  window.history.replaceState(null, '', '/')
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

const base = `/api/organizations/${COUNCIL_ID}/tasks`
const listPath = (view: string, status = 'open') =>
  `${base}?view=${view === 'department' ? 'all' : view}&status=${status}${view === 'mine' ? '' : '&event=none'}`

const task = (id: string, extra: Partial<TaskSummary> = {}): TaskSummary => ({
  id,
  title: `업무 ${id}`,
  status: 'todo',
  next: 'in_progress',
  dueDate: '2026-10-25',
  overdue: false,
  department: null,
  event: null,
  assignee: { id: 'p1', name: '김새내', current: true },
  actions: ['task.change_status'],
  ...extra,
})
const list = (tasks: TaskSummary[], truncated = false) => json({ tasks, truncated })

// 업무 줄(li). 제목은 상세를 여는 버튼이다.
const rowOf = (title: string) => screen.getByRole('button', { name: title }).closest('li')!

test('내 업무 줄에 제목, 진행 중, 부서, 마감(지나면 빨강)이 보이고 담당자는 없으며, 상태 바꾸기는 할 수 있는 사람에게만 보인다', async () => {
  const api = mockApi()
  api.on('GET', listPath('mine'), () =>
    list([
      task('a', { overdue: true, department: { id: 'd1', name: '기획부' } }),
      task('b', { status: 'in_progress', next: 'done', dueDate: null }),
      task('c', { status: 'done', actions: [] }),
    ]),
  )
  render(<TasksPage view={councilView(COUNCIL_ID)} onForbidden={() => {}} onChanged={() => {}} />)
  await screen.findByRole('button', { name: '업무 a' })
  const a = rowOf('업무 a')
  expect(a.textContent).toContain('기획부')
  expect(within(a).getByText('10월 25일').className).toContain('text-red-600')
  // 할 일은 배지 없이 [시작]이 말해 준다.
  expect(within(a).queryByText('할 일')).toBeNull()
  expect(within(a).queryByText('김새내')).toBeNull()
  expect(within(a).getByRole('button', { name: '시작' })).toBeTruthy()
  const b = rowOf('업무 b')
  expect(within(b).getByText('진행 중')).toBeTruthy()
  expect(b.textContent).toContain('학생회 업무')
  expect(within(b).getByText('마감 없음').className).not.toContain('text-red-600')
  expect(within(b).getByRole('button', { name: '끝내기' })).toBeTruthy()
  // 끝난 업무에는 버튼이 없고, 권한이 없으면 할 일이어도 없다.
  expect(screen.getAllByRole('button', { name: /^(시작|끝내기)$/ })).toHaveLength(2)
})

test('전체의 줄에는 부서 대신 담당자(없으면 담당자 없음)와 행사가 보이고, 행사를 누르면 행사로 간다', async () => {
  const api = mockApi()
  api.on('GET', listPath('mine'), () => list([]))
  api.on('GET', listPath('all'), () =>
    list([
      task('a', {
        assignee: { id: 'p9', name: '박떠남', current: false },
        event: { id: 'e1', name: '신입생 환영회' },
      }),
      task('b', { assignee: null }),
    ]),
  )
  render(<TasksPage view={councilView(COUNCIL_ID)} onForbidden={() => {}} onChanged={() => {}} />)
  fireEvent.click(await screen.findByRole('tab', { name: '학생회 업무' }))
  await screen.findByRole('button', { name: '업무 a' })
  const a = rowOf('업무 a')
  expect(within(a).getByText('떠난 사람: 박떠남')).toBeTruthy()
  expect(within(rowOf('업무 b')).getByText('담당자 없음')).toBeTruthy()
  fireEvent.click(within(a).getByRole('button', { name: '신입생 환영회' }))
  expect(window.location.pathname).toBe(`/events/${COUNCIL_ID}/e1`)
})

test('권한 목록에 task.change_status가 없으면 [시작]이 없다', async () => {
  const api = mockApi()
  api.on('GET', listPath('mine'), () => list([task('a', { actions: [] })]))
  render(<TasksPage view={councilView(COUNCIL_ID)} onForbidden={() => {}} onChanged={() => {}} />)
  await screen.findByText('업무 a')
  expect(screen.queryByRole('button', { name: '시작' })).toBeNull()
})

test('[시작]은 보내는 동안 막히고 두 번 눌러도 한 번만 가며, 끝나면 목록과 옆 메뉴 수를 다시 읽는다', async () => {
  const api = mockApi()
  const onChanged = vi.fn()
  let reads = 0
  api.on('GET', listPath('mine'), () => {
    reads += 1
    return list([task('a', reads > 1 ? { status: 'in_progress', next: 'done' } : {})])
  })
  const pending = deferredResponse()
  api.on('POST', `${base}/a/status`, () => pending.promise)
  render(<TasksPage view={councilView(COUNCIL_ID)} onForbidden={() => {}} onChanged={onChanged} />)
  const start = await screen.findByRole('button', { name: '시작' })
  fireEvent.click(start)
  await waitFor(() => expect((start as HTMLButtonElement).disabled).toBe(true))
  fireEvent.click(start)
  pending.resolve(json({ task: {} }))
  expect(await screen.findByRole('button', { name: '끝내기' })).toBeTruthy()
  expect(api.calls.filter(call => call.method === 'POST')).toHaveLength(1)
  expect(api.calls.find(call => call.method === 'POST')?.body).toEqual({ status: 'in_progress' })
  expect(onChanged).toHaveBeenCalled()
})

test('상태 바꾸기가 실패하면 그 줄에 문구가 보이고 지워진 업무는 목록을 다시 읽는다', async () => {
  const api = mockApi()
  api.on('GET', listPath('mine'), () => list([task('a'), task('b')]))
  api.on('POST', `${base}/a/status`, () => json({ error: 'NOT_FOUND' }, 404))
  api.on('POST', `${base}/b/status`, () => json({ error: 'TOO_MANY_REQUESTS' }, 429))
  render(<TasksPage view={councilView(COUNCIL_ID)} onForbidden={() => {}} onChanged={() => {}} />)
  const [first, second] = await screen.findAllByRole('button', { name: '시작' })
  fireEvent.click(first!)
  expect(await screen.findByText('이 업무는 지워졌어요. 목록을 새로 불러왔어요.')).toBeTruthy()
  fireEvent.click(second!)
  expect(await screen.findByText('너무 빨리 바꾸고 있어요. 잠시 뒤에 다시 해 주세요.')).toBeTruthy()
})

test('전체는 부서 이름순으로 묶고 학생회 업무를 맨 뒤에 두며, 묶음 머리에 업무 수가 보인다', async () => {
  const api = mockApi()
  api.on('GET', listPath('mine'), () => list([]))
  api.on('GET', listPath('all'), () =>
    list([
      task('1', { department: null }),
      task('2', { department: { id: '0199d1a0-0000-7000-8000-0000000000d2', name: '홍보부' } }),
      task('3', { department: { id: 'd1', name: '기획부' } }),
    ]),
  )
  render(<TasksPage view={councilView(COUNCIL_ID)} onForbidden={() => {}} onChanged={() => {}} />)
  fireEvent.click(await screen.findByRole('tab', { name: '학생회 업무' }))
  await screen.findByRole('button', { name: '업무 1' })
  const names = screen.getAllByRole('heading', { level: 2 }).map(h => h.textContent)
  expect(names).toEqual(['기획부1', '홍보부1', '학생회 업무1'])
  const sections = screen.getAllByRole('region').map(section => section.getAttribute('aria-label'))
  expect(sections).toEqual(['기획부', '홍보부', '학생회 업무'])
})

test('전체의 부서 묶음 머리 오른쪽에 진행 중·지남·담당자 없음 수가 보이고, 0인 것은 빠진다', async () => {
  const api = mockApi()
  api.on('GET', listPath('mine'), () => list([]))
  const planning = { id: 'd1', name: '기획부' }
  api.on('GET', listPath('all'), () =>
    list([
      task('1', { department: planning, status: 'in_progress', next: 'done' }),
      task('2', { department: planning, overdue: true, assignee: null }),
      task('3', { department: planning, assignee: null }),
      task('4', { department: { id: '0199d1a0-0000-7000-8000-0000000000d2', name: '홍보부' } }),
    ]),
  )
  render(<TasksPage view={councilView(COUNCIL_ID)} onForbidden={() => {}} onChanged={() => {}} />)
  fireEvent.click(await screen.findByRole('tab', { name: '학생회 업무' }))
  const section = await screen.findByRole('region', { name: '기획부' })
  expect(within(section).getByText('진행 중 1')).toBeTruthy()
  expect(within(section).getByText('지남 1')).toBeTruthy()
  expect(within(section).getByText('담당자 없음 2')).toBeTruthy()
  const other = screen.getByRole('region', { name: '홍보부' })
  expect(within(other).queryByText(/^(진행 중|지남|담당자 없음) \d+$/)).toBeNull()
})

const planningHead = councilView(COUNCIL_ID, {
  departments: [
    { id: '0199d1a0-0000-7000-8000-0000000000d2', name: '기획부', role: null, rank: 'head' },
  ],
})

test('부서가 없으면 내 부서 탭이 없고, 있으면 내 부서 업무를 부서로 묶어 담당자와 함께 보인다', async () => {
  const api = mockApi()
  api.on('GET', listPath('mine'), () => list([]))
  api.on('GET', listPath('department'), () =>
    list([
      task('1', {
        department: { id: '0199d1a0-0000-7000-8000-0000000000d2', name: '기획부' },
        status: 'in_progress',
        next: 'done',
      }),
    ]),
  )
  const { unmount } = render(
    <TasksPage view={councilView(COUNCIL_ID)} onForbidden={() => {}} onChanged={() => {}} />,
  )
  await screen.findByRole('tab', { name: '학생회 업무' })
  expect(screen.getAllByRole('tab').map(tab => tab.textContent)).toEqual(['학생회 업무', '내 업무'])
  unmount()
  render(<TasksPage view={planningHead} onForbidden={() => {}} onChanged={() => {}} />)
  fireEvent.click(screen.getByRole('tab', { name: '학생회 업무' }))
  fireEvent.click(screen.getByRole('button', { name: '내 부서' }))
  const section = await screen.findByRole('region', { name: '기획부' })
  expect(within(section).getByText('진행 중 1')).toBeTruthy()
  expect(rowOf('업무 1').textContent).toContain('김새내')
})

test('행사 업무 달력은 끝나지 않은 업무와 끝난 업무, 행사를 함께 그리고 고른 날 목록을 보인다', async () => {
  // jsdom에는 스크롤이 없어 날짜 선택과 목록만 확인한다.
  vi.stubGlobal('requestAnimationFrame', () => 0)
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-25T03:00:00Z'))
  window.history.replaceState(null, '', `/events/${COUNCIL_ID}/${EVENT_ID}?tab=tasks`)
  const api = mockApi()
  api.on('GET', `${listPath('all')}&event=${EVENT_ID}`, () =>
    list([task('a'), task('c', { dueDate: null })]),
  )
  api.on('GET', `${listPath('all', 'done')}&event=${EVENT_ID}`, () =>
    list([task('b', { status: 'done', actions: [] })]),
  )
  api.on('GET', `/api/organizations/${COUNCIL_ID}/events`, () =>
    json({
      events: [
        eventSummary({ name: '가을 MT', startsAt: '2026-10-30T14:00', endsAt: '2026-11-01T12:00' }),
      ],
      truncated: false,
    }),
  )
  render(
    <TasksPage
      view={councilView(COUNCIL_ID)}
      eventId={EVENT_ID}
      onForbidden={() => {}}
      onChanged={() => {}}
    />,
  )
  await screen.findByRole('button', { name: '업무 a' })
  fireEvent.click(screen.getByRole('button', { name: '달력' }))
  expect(await screen.findByRole('heading', { name: '2026년 10월' })).toBeTruthy()
  // 행사 달력에는 거르기가 없다. 마감날을 고르면 끝난 업무까지 아래에 보인다.
  expect(screen.queryByRole('group', { name: '업무 거르기' })).toBeNull()
  fireEvent.click(await screen.findByRole('button', { name: '10월 25일 (일) 업무 2개, 행사 0개' }))
  const today = await screen.findByRole('region', { name: '10월 25일 (일)' })
  await within(today).findByRole('button', { name: '업무 b' })
  expect(
    within(today)
      .getAllByRole('button', { name: /^업무 / })
      .map(b => b.textContent),
  ).toEqual(['업무 a', '업무 b'])
  // 여러 날 행사는 걸친 날마다 보인다.
  fireEvent.click(screen.getByRole('button', { name: '10월 31일 (토) 업무 0개, 행사 1개' }))
  const day = screen.getByRole('region', { name: '10월 31일 (토)' })
  expect(day.textContent).toContain('가을 MT')
  expect(day.textContent).toContain('10월 30일 14:00 – 11월 1일 12:00')
  fireEvent.click(screen.getByRole('button', { name: '마감 없음 1' }))
  const undated = screen.getByRole('region', { name: '마감 없음' })
  expect(within(undated).getByRole('button', { name: '업무 c' })).toBeTruthy()
})

test('빈 목록, 넘침, 불러오기 실패 문구가 있다', async () => {
  const api = mockApi()
  api.on('GET', listPath('mine'), () => list([]))
  api.on('GET', listPath('all'), () => list([task('1')], true))

  render(<TasksPage view={councilView(COUNCIL_ID)} onForbidden={() => {}} onChanged={() => {}} />)
  expect(await screen.findByText('끝나지 않은 업무 없음')).toBeTruthy()
  fireEvent.click(screen.getByRole('tab', { name: '학생회 업무' }))
  expect(await screen.findByText(/^업무가 많아 \d+개만 보여요\.$/)).toBeTruthy()
  api.on('GET', listPath('mine'), () => json({ error: 'INTERNAL' }, 500))
  fireEvent.click(screen.getByRole('tab', { name: '내 업무' }))
  expect(await screen.findByText('업무를 불러오지 못했어요. 연결을 확인해 주세요.')).toBeTruthy()
  expect(screen.getByRole('button', { name: '다시 시도' })).toBeTruthy()
})

test('거르기를 바꾸면 끝난 업무를 읽는다', async () => {
  const api = mockApi()
  api.on('GET', listPath('mine'), () => list([task('a')]))
  api.on('GET', listPath('mine', 'done'), () => list([]))
  render(<TasksPage view={councilView(COUNCIL_ID)} onForbidden={() => {}} onChanged={() => {}} />)
  await screen.findByText('업무 a')
  fireEvent.click(screen.getByRole('button', { name: '끝남' }))
  expect(await screen.findByText('끝난 업무 없음')).toBeTruthy()
})

test('탭을 바꾸면 이전 탭의 늦은 응답은 버린다', async () => {
  const api = mockApi()
  const slow = deferredResponse()
  api.on('GET', listPath('mine'), () => slow.promise)
  api.on('GET', listPath('all'), () => list([task('전체것')]))
  render(<TasksPage view={councilView(COUNCIL_ID)} onForbidden={() => {}} onChanged={() => {}} />)
  fireEvent.click(await screen.findByRole('tab', { name: '학생회 업무' }))
  await screen.findByText('업무 전체것')
  slow.resolve(list([task('내것')]))
  await new Promise(resolve => setTimeout(resolve, 20))
  expect(screen.queryByText('업무 내것')).toBeNull()
  expect(screen.getByText('업무 전체것')).toBeTruthy()
})

test('403이면 학생회를 다시 읽게 한다', async () => {
  const api = mockApi()
  const onForbidden = vi.fn()
  api.on('GET', listPath('mine'), () => json({ error: 'FORBIDDEN' }, 403))
  render(
    <TasksPage view={councilView(COUNCIL_ID)} onForbidden={onForbidden} onChanged={() => {}} />,
  )
  await waitFor(() => expect(onForbidden).toHaveBeenCalled())
})

test('내 업무는 지남·오늘·7일 안·나중·마감 없음 묶음(h2와 수)으로 나뉘고, 묶음 안은 마감이 이른 순이다', async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-24T03:00:00.000Z'))
  const api = mockApi()
  api.on('GET', listPath('mine'), () =>
    list([
      task('없음', { dueDate: null }),
      task('나중', { dueDate: '2026-11-20' }),
      task('주2', { dueDate: '2026-10-31' }),
      task('주1', { dueDate: '2026-10-25' }),
      task('오늘', { dueDate: '2026-10-24' }),
      task('지남', { dueDate: '2026-10-20', overdue: true }),
    ]),
  )
  render(<TasksPage view={councilView(COUNCIL_ID)} onForbidden={() => {}} onChanged={() => {}} />)
  await screen.findByRole('button', { name: '업무 지남' })
  const sections = screen.getAllByRole('region')
  expect(sections.map(section => section.getAttribute('aria-label'))).toEqual([
    '지남',
    '오늘',
    '7일 안',
    '나중',
    '마감 없음',
  ])
  expect(screen.getAllByRole('heading', { level: 2 }).map(h => h.textContent)).toEqual([
    '지남1',
    '오늘1',
    '7일 안2',
    '나중1',
    '마감 없음1',
  ])
  const week = within(sections[2]!).getAllByRole('listitem')
  expect(week.map(row => within(row).getAllByRole('button')[0]?.textContent)).toEqual([
    '업무 주1',
    '업무 주2',
  ])
  // 내 업무 묶음에는 부서 묶음의 수(진행 중·지남·담당자 없음)가 없다.
  expect(screen.queryByText(/^지남 \d+$/)).toBeNull()
})

test('담당자 없는 업무는 맡길 권한이 있으면 줄에서 담당자를 고르고, 고르면 맡기고 다시 읽는다', async () => {
  const api = mockApi()
  const onChanged = vi.fn()
  api.on('GET', `/api/organizations/${COUNCIL_ID}/members`, () => json(teamResponse()))
  api.on('GET', listPath('mine'), () => list([]))
  api.on('GET', listPath('unassigned'), () =>
    list([
      task('a', { assignee: null, actions: ['task.change_status', 'task.change_assignee'] }),
      task('b', { assignee: null }),
    ]),
  )
  api.on('GET', listPath('all'), () => list([]))
  api.on('POST', `${base}/a/assignee`, () => json({ task: {} }))
  render(<TasksPage view={councilView(COUNCIL_ID)} onForbidden={() => {}} onChanged={onChanged} />)
  fireEvent.click(screen.getByRole('tab', { name: '학생회 업무' }))
  fireEvent.click(screen.getByRole('button', { name: '담당자 없음' }))
  const select = await screen.findByRole('combobox', { name: '업무 a 담당자' })
  expect(within(select).getByText('담당자 지정')).toBeTruthy()
  expect(screen.queryByRole('combobox', { name: '업무 b 담당자' })).toBeNull()
  const reads = () => api.calls.filter(call => call.path === listPath('unassigned')).length
  const before = reads()
  fireEvent.change(select, { target: { value: 'm2' } })
  await waitFor(() =>
    expect(api.calls.find(call => call.path === `${base}/a/assignee`)?.body).toEqual({
      assigneeId: 'm2',
    }),
  )
  await waitFor(() => expect(reads()).toBeGreaterThan(before))
  expect(onChanged).toHaveBeenCalled()
})

test('업무 화면에는 업무 만들기 단추가 없고 맨 위에 새 업무 칸이 있다', async () => {
  const api = mockApi()
  api.on('GET', listPath('mine'), () => list([]))
  render(<TasksPage view={councilView(COUNCIL_ID)} onForbidden={() => {}} onChanged={() => {}} />)
  expect(await screen.findByRole('textbox', { name: '새 업무' })).toBeTruthy()
  expect(screen.queryByRole('button', { name: '업무 만들기' })).toBeNull()
})

test('푸시가 오면 보이는 화면은 목록을 바로 다시 읽는다', async () => {
  const api = mockApi()
  api.on('GET', listPath('mine'), () => list([task('a')]))
  render(<TasksPage view={councilView(COUNCIL_ID)} onForbidden={() => {}} onChanged={() => {}} />)
  await screen.findByText('업무 a')
  const reads = readsOf(api)
  const before = reads()
  window.dispatchEvent(new Event(PUSH_ARRIVED_EVENT))
  await waitFor(() => expect(reads()).toBe(before + 1))
})

test('화면이 다시 보이면 목록을 다시 읽는다', async () => {
  const api = mockApi()
  api.on('GET', listPath('mine'), () => list([task('a')]))
  render(<TasksPage view={councilView(COUNCIL_ID)} onForbidden={() => {}} onChanged={() => {}} />)
  await screen.findByText('업무 a')
  const reads = readsOf(api)
  const before = reads()
  document.dispatchEvent(new Event('visibilitychange'))
  await waitFor(() => expect(reads()).toBe(before + 1))
})
