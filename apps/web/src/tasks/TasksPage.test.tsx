// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { TaskSummary } from '@vada/contracts'
import { deferredResponse, json, mockApi } from '@/test-support/mock-api'
import { PUSH_ARRIVED_EVENT } from '@/lib/service-worker'
import { councilView } from '@/test-support/council-fixtures'
import TasksPage from './TasksPage'

function readsOf(api: ReturnType<typeof mockApi>) {
  return () =>
    api.calls.filter(call => call.path === '/api/organizations/c1/tasks?view=mine&status=open')
      .length
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const base = '/api/organizations/c1/tasks'
const listPath = (view: string, status = 'open') => `${base}?view=${view}&status=${status}`

const task = (id: string, extra: Partial<TaskSummary> = {}): TaskSummary => ({
  id,
  title: `업무 ${id}`,
  status: 'todo',
  dueDate: '2026-10-25',
  overdue: false,
  department: null,
  event: null,
  assignee: { id: 'p1', name: '김새내', current: true },
  actions: ['task.status'],
  ...extra,
})
const list = (tasks: TaskSummary[], truncated = false) => json({ tasks, truncated })

test('카드에 제목, 마감, 지남, 상태, 담당자가 보이고 상태 바꾸기는 할 수 있는 사람에게만 보인다', async () => {
  const api = mockApi()
  api.on('GET', listPath('mine'), () =>
    list([
      task('a', { overdue: true, assignee: { id: 'p9', name: '박떠남', current: false } }),
      task('b', { status: 'in_progress', dueDate: null, assignee: null }),
      task('c', { status: 'done', actions: [] }),
    ]),
  )
  render(<TasksPage view={councilView('c1')} onForbidden={() => {}} onChanged={() => {}} />)
  const a = (await screen.findByText('업무 a')).closest('div')!.parentElement!
  expect(a.textContent).toContain('10월 25일')
  expect(within(a).getByText('지남')).toBeTruthy()
  expect(within(a).getByText('할 일')).toBeTruthy()
  expect(within(a).getByText('떠난 사람: 박떠남')).toBeTruthy()
  expect(within(a).getByRole('button', { name: '시작' })).toBeTruthy()
  const b = screen.getByText('업무 b').closest('div')!.parentElement!
  expect(b.textContent).toContain('마감 없음')
  expect(b.textContent).toContain('담당자 없음')
  expect(within(b).getByRole('button', { name: '끝내기' })).toBeTruthy()
  // 끝난 업무에는 버튼이 없고, 권한이 없으면 할 일이어도 없다.
  expect(screen.getAllByRole('button', { name: /시작|끝내기/ })).toHaveLength(2)
})

test('권한 목록에 task.status가 없으면 [시작]이 없다', async () => {
  const api = mockApi()
  api.on('GET', listPath('mine'), () => list([task('a', { actions: [] })]))
  render(<TasksPage view={councilView('c1')} onForbidden={() => {}} onChanged={() => {}} />)
  await screen.findByText('업무 a')
  expect(screen.queryByRole('button', { name: '시작' })).toBeNull()
})

test('[시작]은 보내는 동안 막히고 두 번 눌러도 한 번만 가며, 끝나면 목록과 옆 메뉴 수를 다시 읽는다', async () => {
  const api = mockApi()
  const onChanged = vi.fn()
  let reads = 0
  api.on('GET', listPath('mine'), () => {
    reads += 1
    return list([task('a', { status: reads > 1 ? 'in_progress' : 'todo' })])
  })
  const pending = deferredResponse()
  api.on('POST', `${base}/a/status`, () => pending.promise)
  render(<TasksPage view={councilView('c1')} onForbidden={() => {}} onChanged={onChanged} />)
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

test('상태 바꾸기가 실패하면 그 카드에 문구가 보이고 지워진 업무는 목록을 다시 읽는다', async () => {
  const api = mockApi()
  api.on('GET', listPath('mine'), () => list([task('a'), task('b')]))
  api.on('POST', `${base}/a/status`, () => json({ error: 'NOT_FOUND' }, 404))
  api.on('POST', `${base}/b/status`, () => json({ error: 'TOO_MANY_REQUESTS' }, 429))
  render(<TasksPage view={councilView('c1')} onForbidden={() => {}} onChanged={() => {}} />)
  const [first, second] = await screen.findAllByRole('button', { name: '시작' })
  fireEvent.click(first!)
  expect(await screen.findByText('이 업무는 지워졌어요. 목록을 새로 불러왔어요.')).toBeTruthy()
  fireEvent.click(second!)
  expect(await screen.findByText('너무 빨리 바꾸고 있어요. 잠시 뒤에 다시 해 주세요.')).toBeTruthy()
})

test('전체는 부서 이름순으로 묶고 학생회 업무를 맨 뒤에 둔다', async () => {
  const api = mockApi()
  api.on('GET', listPath('mine'), () => list([]))
  api.on('GET', listPath('all'), () =>
    list([
      task('1', { department: null }),
      task('2', { department: { id: 'd2', name: '홍보부' } }),
      task('3', { department: { id: 'd1', name: '기획부' } }),
    ]),
  )
  render(<TasksPage view={councilView('c1')} onForbidden={() => {}} onChanged={() => {}} />)
  fireEvent.click(await screen.findByRole('tab', { name: '전체' }))
  await screen.findByText('업무 1')
  const names = screen.getAllByRole('heading', { level: 2 }).map(h => h.textContent)
  expect(names).toEqual(['기획부', '홍보부', '학생회 업무'])
})

test('빈 목록, 넘침, 불러오기 실패 문구가 있다', async () => {
  const api = mockApi()
  api.on('GET', listPath('mine'), () => list([]))
  api.on('GET', listPath('all'), () => list([task('1')], true))
  api.on('GET', listPath('unassigned'), () => json({ error: 'INTERNAL' }, 500))
  render(<TasksPage view={councilView('c1')} onForbidden={() => {}} onChanged={() => {}} />)
  expect(await screen.findByText('끝나지 않은 업무가 없어요.')).toBeTruthy()
  fireEvent.click(screen.getByRole('tab', { name: '전체' }))
  expect(await screen.findByText(/업무가 많아서 .*개만 보여요/)).toBeTruthy()
  fireEvent.click(screen.getByRole('tab', { name: '담당자 없음' }))
  expect(await screen.findByText('업무를 불러오지 못했어요. 연결을 확인해 주세요.')).toBeTruthy()
  expect(screen.getByRole('button', { name: '다시 시도' })).toBeTruthy()
})

test('거르기를 바꾸면 끝난 업무를 읽는다', async () => {
  const api = mockApi()
  api.on('GET', listPath('mine'), () => list([task('a')]))
  api.on('GET', listPath('mine', 'done'), () => list([]))
  render(<TasksPage view={councilView('c1')} onForbidden={() => {}} onChanged={() => {}} />)
  await screen.findByText('업무 a')
  fireEvent.click(screen.getByRole('button', { name: '끝남' }))
  expect(await screen.findByText('끝난 업무가 없어요.')).toBeTruthy()
})

test('탭을 바꾸면 이전 탭의 늦은 응답은 버린다', async () => {
  const api = mockApi()
  const slow = deferredResponse()
  api.on('GET', listPath('mine'), () => slow.promise)
  api.on('GET', listPath('all'), () => list([task('전체것')]))
  render(<TasksPage view={councilView('c1')} onForbidden={() => {}} onChanged={() => {}} />)
  fireEvent.click(await screen.findByRole('tab', { name: '전체' }))
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
  render(<TasksPage view={councilView('c1')} onForbidden={onForbidden} onChanged={() => {}} />)
  await waitFor(() => expect(onForbidden).toHaveBeenCalled())
})

test('내 업무의 제목은 h2이고, 부서 묶음 아래 카드의 제목은 h3이다', async () => {
  const api = mockApi()
  api.on('GET', listPath('mine'), () => list([task('a')]))
  api.on('GET', listPath('all'), () => list([task('b')]))
  render(<TasksPage view={councilView('c1')} onForbidden={() => {}} onChanged={() => {}} />)
  expect((await screen.findByRole('heading', { level: 2, name: '업무 a' })).tagName).toBe('H2')
  fireEvent.click(screen.getByRole('tab', { name: '전체' }))
  expect((await screen.findByRole('heading', { level: 3, name: '업무 b' })).tagName).toBe('H3')
})

test('푸시가 오면 보이는 화면은 목록을 바로 다시 읽는다', async () => {
  const api = mockApi()
  api.on('GET', listPath('mine'), () => list([task('a')]))
  render(<TasksPage view={councilView('c1')} onForbidden={() => {}} onChanged={() => {}} />)
  await screen.findByText('업무 a')
  const reads = readsOf(api)
  const before = reads()
  window.dispatchEvent(new Event(PUSH_ARRIVED_EVENT))
  await waitFor(() => expect(reads()).toBe(before + 1))
})

test('화면이 다시 보이면 목록을 다시 읽는다', async () => {
  const api = mockApi()
  api.on('GET', listPath('mine'), () => list([task('a')]))
  render(<TasksPage view={councilView('c1')} onForbidden={() => {}} onChanged={() => {}} />)
  await screen.findByText('업무 a')
  const reads = readsOf(api)
  const before = reads()
  document.dispatchEvent(new Event('visibilitychange'))
  await waitFor(() => expect(reads()).toBe(before + 1))
})
