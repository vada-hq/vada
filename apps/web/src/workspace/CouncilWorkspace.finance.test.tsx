// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import {
  councilView,
  FINANCE_PERMISSIONS,
  myCouncil,
  teamResponse,
} from '@/test-support/council-fixtures'
import { roomList } from '@/test-support/chat-fixtures'
import { json, mockApi } from '@/test-support/mock-api'
import { purchaseDetail, purchaseSummary } from '@/test-support/purchase-fixtures'
import type { Page } from './pages'
import CouncilWorkspace from './CouncilWorkspace'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const base = '/api/organizations/c1'
const pendingPath = `${base}/purchase-requests?view=pending`
const minePath = `${base}/purchase-requests?view=mine`
const tasksPath = `${base}/tasks?view=mine&status=open`

function open(options: { finance?: boolean; pending?: () => unknown; startPage?: Page } = {}) {
  const api = mockApi()
  const view = councilView('c1', options.finance ? { permissions: FINANCE_PERMISSIONS } : {})
  api.on('GET', base, () => json(view))
  api.on('GET', `${base}/members`, () => json(teamResponse()))
  api.on('GET', `${base}/rooms`, () => json(roomList()))
  api.on('GET', tasksPath, () => json({ tasks: [], truncated: false }))
  api.on('GET', pendingPath, () => json(options.pending?.() ?? { requests: [], truncated: false }))
  api.on('GET', minePath, () => json({ requests: [], truncated: false }))
  render(
    <CouncilWorkspace
      council={myCouncil()}
      councils={[myCouncil()]}
      onSelect={() => {}}
      returnFocusTo={null}
      startPage={options.startPage ?? 'chat'}
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

const pending =
  (count: number, truncated = false) =>
  () => ({
    requests: Array.from({ length: count }, (_, index) => purchaseSummary(`p${index}`)),
    truncated,
  })

test('재정부에게는 옆 메뉴 재정에 결재 대기 수가 보이고 넘치면 +가 붙는다', async () => {
  open({ finance: true, pending: pending(3, true) })
  const badge = (await screen.findAllByLabelText('결재 대기 요청 3개 이상'))[0]!
  expect(badge.textContent).toBe('3+')
})

test('결재 대기가 없으면 배지가 없다', async () => {
  const api = open({ finance: true })
  await waitFor(() => expect(api.calls.some(call => call.path === pendingPath)).toBe(true))
  await screen.findAllByText('재정')
  await new Promise(resolve => setTimeout(resolve, 20))
  expect(screen.queryByLabelText(/결재 대기 요청/)).toBeNull()
})

test('결재 권한이 없으면 결재 대기를 읽지도 않고 배지도 없다', async () => {
  const api = open()
  await screen.findAllByText('재정')
  await waitFor(() => expect(api.calls.some(call => call.path === tasksPath)).toBe(true))
  await new Promise(resolve => setTimeout(resolve, 20))
  expect(api.calls.some(call => call.path === pendingPath)).toBe(false)
  expect(screen.queryByLabelText(/결재 대기 요청/)).toBeNull()
})

test('옆 메뉴 재정을 누르면 재정 화면이 열린다', async () => {
  open()
  fireEvent.click((await screen.findAllByRole('button', { name: '재정' }))[0]!)
  expect(await screen.findByRole('tab', { name: '구매 요청' })).toBeTruthy()
  expect(screen.getAllByText('재정').length).toBeGreaterThan(0)
})

test('요청을 내면 옆 메뉴의 결재 대기 수를 다시 읽는다', async () => {
  let count = 2
  const api = open({ finance: true, pending: () => pending(count)(), startPage: 'finance' })
  api.on('POST', `${base}/purchase-requests`, () => {
    count = 3
    return json({ request: purchaseDetail() }, 201)
  })
  expect((await screen.findAllByLabelText('결재 대기 요청 2개'))[0]!.textContent).toBe('2')
  fireEvent.click(await screen.findByRole('button', { name: '구매 요청 내기' }))
  fireEvent.change(await screen.findByLabelText('제목'), { target: { value: '테이프' } })
  fireEvent.change(screen.getByLabelText('품목 1 이름'), { target: { value: '테이프' } })
  fireEvent.click(screen.getByRole('button', { name: '내기' }))
  expect((await screen.findAllByLabelText('결재 대기 요청 3개'))[0]!.textContent).toBe('3')
})
