// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { TaskSummary } from '@vada/contracts'
import { deferredResponse, json, mockApi } from '@/test-support/mock-api'
import { TaskBoard } from './TaskBoard'
import { useTasks } from './useTasks'
import { useStatusChange } from './useStatusChange'

const base = '/api/organizations/c1/tasks'
const original: TaskSummary = {
  id: 'a',
  title: '장소 예약',
  status: 'todo',
  next: 'in_progress',
  dueDate: null,
  overdue: false,
  department: null,
  event: null,
  assignee: null,
  actions: ['task.change_status'],
}
const opened = vi.fn()
const forbidden = vi.fn()
let api: ReturnType<typeof mockApi>
let tasks: TaskSummary[]

function Board({ eventId }: { eventId?: string | undefined }) {
  const open = useTasks('c1', { view: 'all', filter: 'open', eventId }, forbidden)
  const done = useTasks('c1', { view: 'all', filter: 'done', eventId }, forbidden)
  const reload = async () => {
    await Promise.all([open.reload(), done.reload()])
  }
  const change = useStatusChange('c1', reload, forbidden)
  return (
    <TaskBoard
      open={open}
      done={done}
      departments={[]}
      change={change}
      onOpenTask={opened}
      onShowDoneTable={() => {}}
      councilEmpty={false}
      emptyText="업무 없음"
    />
  )
}

function serve(eventId?: string) {
  tasks = [{ ...original }]
  api = mockApi()
  for (const status of ['open', 'done']) {
    api.on('GET', `${base}?view=all&status=${status}${eventId ? `&event=${eventId}` : ''}`, () =>
      json({
        tasks: tasks.filter(t => (t.status === 'done') === (status === 'done')),
        truncated: false,
      }),
    )
  }
  api.on('POST', `${base}/a/status`, ({ body }) => {
    const status = (body as { status: TaskSummary['status'] }).status
    tasks = [{ ...original, status }]
    return json({ task: tasks[0] })
  })
}
const column = (label: string) => screen.getByRole('region', { name: new RegExp(`^${label}`) })
const posts = () => api.calls.filter(c => c.method === 'POST')
async function card() {
  return (await screen.findByRole('button', { name: original.title })).closest('li')!
}
const transfer = () => ({ setData: vi.fn(), effectAllowed: 'none', dropEffect: 'none' })
function start(source: HTMLElement) {
  const dataTransfer = transfer()
  fireEvent.dragStart(source, { dataTransfer })
  return dataTransfer
}
function drop(target: HTMLElement, dataTransfer = transfer()) {
  fireEvent.dragOver(target, { dataTransfer })
  fireEvent.drop(target, { dataTransfer })
}

afterEach(() => {
  cleanup()
  api.assertNoUnexpectedRequests()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

test.each([undefined, 'e1'])(
  '공유 보드(%s): 빈 상태 열에 놓으면 기존 요청으로 저장하고 두 목록을 다시 읽는다',
  async eventId => {
    serve(eventId)
    render(<Board eventId={eventId} />)
    const source = await card()
    expect(source.draggable).toBe(true)
    const data = start(source)
    expect(source.className).toContain('opacity-50')
    const target = column('끝남')
    expect(target.textContent).toContain('여기에 놓아 끝남으로 변경')
    drop(target, data)
    await waitFor(() => expect(posts()).toHaveLength(1))
    expect(posts()[0]?.body).toEqual({ status: 'done' })
    await waitFor(() => expect(within(column('끝남')).getAllByRole('listitem')).toHaveLength(1))
    expect(within(column('할 일')).queryAllByRole('listitem')).toHaveLength(0)
    fireEvent.dragEnd(source)
    fireEvent.click(screen.getByRole('button', { name: original.title }))
    expect(opened).not.toHaveBeenCalled()
    fireEvent.pointerDown(screen.getByRole('button', { name: original.title }))
    fireEvent.click(screen.getByRole('button', { name: original.title }))
    expect(opened).toHaveBeenCalledExactlyOnceWith('a')
  },
)

test('같은 열·취소·바깥에서 가져온 드롭·권한 없는 업무는 저장하지 않는다', async () => {
  serve()
  render(<Board />)
  const source = await card()
  drop(column('끝남'))
  const data = start(source)
  drop(column('할 일'), data)
  fireEvent.dragEnd(source)
  drop(column('끝남'), data)
  expect(posts()).toHaveLength(0)
  tasks = [{ ...original, actions: [] }]
  fireEvent(document, new Event('visibilitychange'))
  await waitFor(() => expect(source.draggable).toBe(false))
  start(source)
  drop(column('끝남'))
  expect(posts()).toHaveLength(0)
})

test('저장 중 연속 드롭과 메뉴 재선택은 한 번만 보내고, 실패는 원래 열에 남겨 다시 시도할 수 있다', async () => {
  serve()
  const pending = deferredResponse()
  api.on('POST', `${base}/a/status`, () => pending.promise)
  render(<Board />)
  const source = await card()
  const data = start(source)
  drop(column('진행 중'), data)
  drop(column('끝남'), data)
  start(source)
  drop(column('끝남'), data)
  expect(posts()).toHaveLength(1)
  expect(source.draggable).toBe(false)
  await act(async () => pending.resolve(json({ error: 'INTERNAL_ERROR' }, 500)))
  expect(await within(source).findByRole('alert')).toBeTruthy()
  expect(within(column('할 일')).getAllByRole('listitem')).toHaveLength(1)
  expect(source.draggable).toBe(true)
  start(source)
  drop(column('끝남'))
  expect(posts()).toHaveLength(2)
})

test('끌던 중 재조회로 권한이나 상태가 바뀌면 드롭을 무시한다', async () => {
  serve()
  render(<Board />)
  const source = await card()
  start(source)
  tasks = [{ ...original, actions: [] }]
  fireEvent(document, new Event('visibilitychange'))
  await waitFor(() => expect(source.draggable).toBe(false))
  drop(column('끝남'))
  expect(posts()).toHaveLength(0)
  tasks = [{ ...original }]
  fireEvent(document, new Event('visibilitychange'))
  await waitFor(() => expect(source.draggable).toBe(true))
  start(source)
  tasks = [{ ...original, status: 'in_progress' }]
  fireEvent(document, new Event('visibilitychange'))
  await waitFor(() => expect(within(column('진행 중')).getAllByRole('listitem')).toHaveLength(1))
  drop(column('끝남'))
  expect(posts()).toHaveLength(0)
})

test('서버가 권한을 거절하면 기존 오류·권한 재조회 경로를 쓰고 상태를 옮기지 않는다', async () => {
  serve()
  api.on('POST', `${base}/a/status`, () => json({ error: 'FORBIDDEN' }, 403))
  render(<Board />)
  const source = await card()
  start(source)
  drop(column('끝남'))
  expect(await within(source).findByRole('alert')).toBeTruthy()
  expect(forbidden).toHaveBeenCalledTimes(1)
  expect(within(column('할 일')).getAllByRole('listitem')).toHaveLength(1)
})
