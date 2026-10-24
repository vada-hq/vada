// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { TaskSummary } from '@vada/contracts'
import { councilView, myCouncil, teamResponse } from '@/test-support/council-fixtures'
import { roomList } from '@/test-support/chat-fixtures'
import { EVENT_ID, eventDetail, eventSummary } from '@/test-support/event-fixtures'
import { json, mockApi } from '@/test-support/mock-api'
import type { Page } from './pages'
import CouncilWorkspace from './CouncilWorkspace'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const base = '/api/organizations/c1'

const eventTask: TaskSummary = {
  id: 't1',
  title: '현수막 주문',
  status: 'todo',
  next: 'in_progress',
  dueDate: null,
  overdue: false,
  department: null,
  event: { id: EVENT_ID, name: '신입생 환영회' },
  assignee: null,
  actions: [],
}

function open(startPage: Page = 'chat', tasks: TaskSummary[] = []) {
  const api = mockApi()
  api.on('GET', base, () => json(councilView('c1')))
  api.on('GET', `${base}/members`, () => json(teamResponse()))
  api.on('GET', `${base}/rooms`, () => json(roomList()))
  api.on('GET', `${base}/tasks?view=mine&status=open`, () => json({ tasks, truncated: false }))
  api.on('GET', `${base}/events`, () => json({ events: [eventSummary()], truncated: false }))
  api.on('GET', `${base}/events/${EVENT_ID}`, () => json({ event: eventDetail() }))
  render(
    <CouncilWorkspace
      council={myCouncil()}
      councils={[myCouncil()]}
      onSelect={() => {}}
      returnFocusTo={null}
      startPage={startPage}
      roomId={undefined}
      user={{ name: '김회장' }}
      logoutBusy={false}
      onLogout={() => {}}
      onCouncilsChanged={() => {}}
      onCouncilLost={() => {}}
    />,
  )
  return api
}

test('옆 메뉴의 행사는 업무 위에 있고, 누르면 행사 목록이 열린다', async () => {
  open()
  const names = (await screen.findAllByRole('button')).map(button => button.textContent)
  expect(names.indexOf('행사')).toBeGreaterThan(-1)
  expect(names.indexOf('행사')).toBeLessThan(names.findIndex(name => name?.startsWith('업무')))
  fireEvent.click(screen.getAllByRole('button', { name: '행사' })[0]!)
  expect(await screen.findByRole('button', { name: '신입생 환영회' })).toBeTruthy()
})

test('업무 카드의 행사 이름을 누르면 행사 화면에서 그 행사가 열린다', async () => {
  open('tasks', [eventTask])
  fireEvent.click(await screen.findByRole('button', { name: '신입생 환영회' }))
  expect(await screen.findByRole('tab', { name: '개요' })).toBeTruthy()
  expect(await screen.findByRole('heading', { name: '신입생 환영회' })).toBeTruthy()
  expect(screen.queryByRole('button', { name: '현수막 주문' })).toBeNull()
})

test('행사를 열었다가 다른 화면에 다녀오면 목록이 열린다', async () => {
  open('tasks', [eventTask])
  fireEvent.click(await screen.findByRole('button', { name: '신입생 환영회' }))
  await screen.findByRole('tab', { name: '개요' })
  fireEvent.click(screen.getAllByRole('button', { name: /^업무/ })[0]!)
  await screen.findByRole('button', { name: '현수막 주문' })
  fireEvent.click(screen.getAllByRole('button', { name: '행사' })[0]!)
  expect(await screen.findByRole('button', { name: '신입생 환영회' })).toBeTruthy()
  expect(screen.queryByRole('tab', { name: '개요' })).toBeNull()
})
