// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { councilView } from '@/test-support/council-fixtures'
import { EVENT_ID, eventSummary } from '@/test-support/event-fixtures'
import { taskDetail } from '@/test-support/task-detail-fixtures'
import { deferredResponse, json, mockApi } from '@/test-support/mock-api'
import { COUNCIL_ID } from '@/test-support/workspace-at'
import TasksPage from './TasksPage'

const base = `/api/organizations/${COUNCIL_ID}`
const path = (filter = 'open', event = '') =>
  `${base}/tasks?view=mine&status=${filter}${event ? `&event=${event}` : ''}`
const card = (title: string) => screen.getByRole('button', { name: title }).closest('li')!
const rows = [
  taskDetail({ id: 'yesterday', title: '간식 구매', dueDate: '2026-10-24', overdue: true }),
  taskDetail({ id: 'today', title: '장소 대관', dueDate: '2026-10-25', actions: [] }),
  taskDetail({
    id: 'three',
    title: '포스터',
    status: 'in_progress',
    dueDate: '2026-10-28',
    event: { id: EVENT_ID, name: '간식 행사' },
  }),
  taskDetail({
    id: 'later',
    title: '설문',
    dueDate: '2026-11-14',
    department: { id: 'd2', name: '간식부' },
  }),
  taskDetail({ id: 'none', title: '창고 정리', dueDate: null }),
]

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-25T03:00:00Z'))
  window.history.replaceState(null, '', `/tasks/${COUNCIL_ID}?tab=mine`)
})
afterEach(() => {
  cleanup()
  window.history.replaceState(null, '', '/')
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

function setup(tasks = rows, query = '?tab=mine', completed: ReturnType<typeof taskDetail>[] = []) {
  window.history.replaceState(null, '', `/tasks/${COUNCIL_ID}${query}`)
  const api = mockApi()
  for (const scope of ['', 'none', EVENT_ID]) {
    api.on('GET', path('open', scope), () => json({ tasks, truncated: false }))
    api.on('GET', path('done', scope), () => json({ tasks: completed, truncated: false }))
  }
  api.on('GET', `${base}/events`, () => json({ events: [eventSummary()], truncated: false }))
  render(<TasksPage view={councilView(COUNCIL_ID)} onForbidden={() => {}} onChanged={() => {}} />)
  return api
}

test('요약 → 탭 → 범위·상태·검색 → 마감 다섯 묶음과 공통 카드가 보인다', async () => {
  setup()
  await screen.findByText('간식 구매')
  expect(screen.getByLabelText('내 업무 요약').textContent).toContain('지남 1건')
  expect(screen.getByLabelText('내 업무 요약').textContent).toContain('해야 할 업무 5건')
  expect(
    screen.getAllByRole('tablist').map(list =>
      within(list)
        .getAllByRole('tab')
        .map(tab => tab.textContent),
    ),
  ).toEqual([
    ['학생회 업무', '내 업무'],
    ['해야 할 업무', '완료된 업무'],
  ])
  expect(screen.getByRole('combobox', { name: '범위' })).toBeTruthy()
  expect(screen.getByRole('combobox', { name: '상태' })).toBeTruthy()
  expect(screen.getByRole('searchbox', { name: '검색' })).toBeTruthy()
  expect(screen.queryByText(/끼룩이/)).toBeNull()
  expect(screen.getAllByRole('region').map(section => section.getAttribute('aria-label'))).toEqual([
    '지남',
    '오늘',
    '7일 안',
    '나중',
    '마감 없음',
  ])
  expect(within(card('장소 대관')).queryByRole('button', { name: '끝내기' })).toBeNull()
  expect(within(card('간식 구매')).getByRole('button', { name: '끝내기' })).toBeTruthy()
})

test('범위는 서버 event로 보내고 상태와 제목·행사·부서 검색만 받은 목록을 거른다', async () => {
  const api = setup()
  await screen.findByText('간식 구매')
  fireEvent.change(screen.getByRole('combobox', { name: '범위' }), { target: { value: 'council' } })
  await waitFor(() => expect(api.calls.some(call => call.path === path('open', 'none'))).toBe(true))
  fireEvent.change(screen.getByRole('combobox', { name: '범위' }), { target: { value: EVENT_ID } })
  await waitFor(() =>
    expect(api.calls.some(call => call.path === path('open', EVENT_ID))).toBe(true),
  )
  fireEvent.change(screen.getByRole('combobox', { name: '상태' }), {
    target: { value: 'in_progress' },
  })
  expect(screen.queryByText('간식 구매')).toBeNull()
  expect(screen.getByText('포스터')).toBeTruthy()
  fireEvent.change(screen.getByRole('combobox', { name: '상태' }), { target: { value: '' } })
  const address = window.location.href
  fireEvent.change(screen.getByRole('searchbox', { name: '검색' }), { target: { value: '간식' } })
  expect(screen.getAllByRole('listitem')).toHaveLength(3)
  expect(screen.queryByText('장소 대관')).toBeNull()
  expect(window.location.href).toBe(address)
  fireEvent.change(screen.getByRole('searchbox', { name: '검색' }), {
    target: { value: '없는 말' },
  })
  fireEvent.click(screen.getByRole('button', { name: '필터 초기화' }))
  await waitFor(() => expect(window.location.search).toBe('?tab=mine'))
  expect(screen.getByRole<HTMLInputElement>('searchbox').value).toBe('')
})

test('결과물은 가장 최근 한 줄과 외 N만 보이고 없으면 줄이 없다', async () => {
  const api = mockApi()
  api.on('GET', path(), () =>
    json({
      tasks: [
        {
          ...rows[0],
          latestResult: {
            kind: 'request',
            stage: 'in_progress',
            changedAt: '2026-10-25T01:00:00Z',
          },
          resultCount: 2,
        },
        { ...rows[1], latestResult: null, resultCount: 0 },
      ],
      truncated: false,
    }),
  )
  api.on('GET', `${base}/events`, () => json({ events: [], truncated: false }))
  render(<TasksPage view={councilView(COUNCIL_ID)} onForbidden={() => {}} onChanged={() => {}} />)
  expect(await screen.findByText('구매 요청 · 진행 중 외 1')).toBeTruthy()
  expect(within(card('장소 대관')).queryByText(/다음 행동/)).toBeNull()
})

test('끝내기는 done을 보내고 다시 읽은 카드가 사라지며 완료 목록은 서버 순서를 지킨다', async () => {
  const api = setup([rows[0]!])
  const pending = deferredResponse()
  api.on('POST', `${base}/tasks/yesterday/status`, () => pending.promise)
  const finish = await screen.findByRole('button', { name: '끝내기' })
  fireEvent.click(finish)
  fireEvent.click(finish)
  api.on('GET', path(), () => json({ tasks: [], truncated: false }))
  pending.resolve(json({ task: {} }))
  await waitFor(() => expect(screen.queryByText('간식 구매')).toBeNull())
  expect(api.calls.filter(call => call.method === 'POST').map(call => call.body)).toEqual([
    { status: 'done' },
  ])
  api.on('GET', path('done'), () =>
    json({
      tasks: [
        taskDetail({ id: 'new', title: '최근 완료', status: 'done', dueDate: '2026-11-01' }),
        taskDetail({ id: 'old', title: '이전 완료', status: 'done', dueDate: '2026-10-01' }),
      ],
      truncated: false,
    }),
  )
  fireEvent.click(screen.getByRole('tab', { name: '완료된 업무' }))
  await screen.findByText('최근 완료')
  expect(screen.getAllByRole('listitem').map(item => item.textContent)).toEqual([
    expect.stringContaining('최근 완료'),
    expect.stringContaining('이전 완료'),
  ])
  expect(screen.queryByRole('combobox', { name: '상태' })).toBeNull()
  expect(screen.queryByRole('button', { name: '끝내기' })).toBeNull()
})

test('실패는 해당 카드에 있고 실제 0은 회색 0건이며 빈 목록에 초기화가 없다', async () => {
  const api = setup([rows[0]!])
  api.on('POST', `${base}/tasks/yesterday/status`, () => json({ error: 'TOO_MANY_REQUESTS' }, 429))
  fireEvent.click(await screen.findByRole('button', { name: '끝내기' }))
  expect(await within(card('간식 구매')).findByRole('alert')).toBeTruthy()
  cleanup()
  setup([])
  expect(await screen.findByText('내 업무 없음')).toBeTruthy()
  expect(screen.getByLabelText('내 업무 요약').textContent).toBe('지남 0건해야 할 업무 0건')
  expect(screen.queryByRole('button', { name: '필터 초기화' })).toBeNull()
})

test('읽기 전·실패는 집계 전이고 잘린 목록의 요약은 수 뒤에 +를 붙인다', async () => {
  const api = mockApi()
  const pending = deferredResponse()
  api.on('GET', path(), () => pending.promise)
  api.on('GET', `${base}/events`, () => json({ events: [], truncated: false }))
  render(<TasksPage view={councilView(COUNCIL_ID)} onForbidden={() => {}} onChanged={() => {}} />)
  expect(within(screen.getByLabelText('내 업무 요약')).getAllByText('집계 전')).toHaveLength(2)
  pending.resolve(json({ error: 'INTERNAL' }, 500))
  await screen.findByRole('alert')
  expect(within(screen.getByLabelText('내 업무 요약')).getAllByText('집계 전')).toHaveLength(2)
  api.on('GET', path(), () => json({ tasks: [rows[0]], truncated: true }))
  fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))
  await screen.findByText('간식 구매')
  expect(within(screen.getByLabelText('내 업무 요약')).getAllByText('1+건')).toHaveLength(2)
})

test('완료 탭에서는 주소에 남은 state가 읽기를 줄이지 않고 scope를 유지한다', async () => {
  const api = setup([], `?tab=mine&filter=done&scope=council&state=in_progress`, [
    taskDetail({ status: 'done', title: '완료된 학생회 업무' }),
  ])
  expect(await screen.findByText('완료된 학생회 업무')).toBeTruthy()
  expect(api.calls.some(call => call.path === path('done', 'none'))).toBe(true)
  expect(screen.queryByRole('combobox', { name: '상태' })).toBeNull()
})
