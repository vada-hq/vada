// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { councilView, myCouncil, teamResponse } from '@/test-support/council-fixtures'
import { roomList } from '@/test-support/chat-fixtures'
import { homeTask, homeWithTasks } from '@/test-support/home-fixtures'
import { json, mockApi } from '@/test-support/mock-api'
import { taskDetail } from '@/test-support/task-detail-fixtures'
import CouncilWorkspace from './CouncilWorkspace'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const base = '/api/organizations/c1'
const T1 = '3f2b8c1e-6a4d-4e0b-9c57-1a2b3c4d5e6f'

function open() {
  const api = mockApi()
  api.on('GET', base, () => json(councilView('c1')))
  api.on('GET', `${base}/members`, () => json(teamResponse()))
  api.on('GET', `${base}/rooms`, () => json(roomList()))
  api.on('GET', `${base}/home`, () => json(homeWithTasks([homeTask(T1, 'overdue')])))
  api.on('GET', `${base}/tasks?view=mine&status=open`, () =>
    json({ tasks: [homeTask(T1, 'overdue')], truncated: false }),
  )
  api.on('GET', `${base}/tasks/${T1}`, () =>
    json({ task: taskDetail({ id: T1, title: '현수막 주문' }) }),
  )
  render(
    <CouncilWorkspace
      council={myCouncil()}
      councils={[myCouncil()]}
      onSelect={() => {}}
      returnFocusTo={null}
      startPage="home"
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

test('옆 메뉴 맨 위에 홈이 있고 배지가 없다', async () => {
  open()
  const nav = await screen.findByRole('navigation', { name: '학생회 메뉴' })
  const home = within(nav).getAllByRole('button')[0]!
  expect(home.textContent).toBe('홈')
})

test('홈의 업무 줄을 누르면 업무 화면에서 그 업무 상세가 열린다', async () => {
  open()
  fireEvent.click(await screen.findByRole('button', { name: /업무 3f2b8c1e/ }))
  // 상세가 열리면 뒤의 화면은 보조 기술에서 가려진다.
  await waitFor(() =>
    expect(within(screen.getByRole('dialog')).getByText('현수막 주문')).toBeTruthy(),
  )
  expect(screen.queryByRole('heading', { level: 1, name: '홈' })).toBeNull()
})

test('홈의 모두 보기는 업무 화면(상세 없이)으로 가고, 홈으로 돌아오면 다시 읽는다', async () => {
  const api = open()
  fireEvent.click(await screen.findByRole('button', { name: '모두 보기' }))
  expect(await screen.findByRole('heading', { level: 1, name: '업무' })).toBeTruthy()
  expect(screen.queryByRole('dialog')).toBeNull()
  const reads = () => api.calls.filter(call => call.path === `${base}/home`).length
  expect(reads()).toBe(1)
  fireEvent.click(screen.getAllByRole('button', { name: '홈' })[0]!)
  expect(await screen.findByRole('heading', { level: 1, name: '홈' })).toBeTruthy()
  await waitFor(() => expect(reads()).toBe(2))
})
