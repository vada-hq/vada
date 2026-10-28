// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import type { HomeResponse } from '@vada/contracts'
import { openRecord } from '@/lib/go-to'
import { windowHistoryIdle } from '@/lib/use-window-history'
import { resetAddress } from '@/test-support/address-reset'
import { roomList } from '@/test-support/chat-fixtures'
import { councilView, teamResponse } from '@/test-support/council-fixtures'
import { councilHome, homeTask, homeWithTasks, onHomeExtras } from '@/test-support/home-fixtures'
import { json, mockApi } from '@/test-support/mock-api'
import { navigationWidth } from '@/test-support/navigation-width'
import { taskDetail } from '@/test-support/task-detail-fixtures'
import { COUNCIL_ID, WorkspaceAt } from '@/test-support/workspace-at'

const T = '0199d1a0-0000-7000-8000-0000000000a1'
const base = `/api/organizations/${COUNCIL_ID}`
const task = () => homeTask(T, 'overdue', { title: '패널에서 끝낼 업무' })
const homePath = `/home/${COUNCIL_ID}`
const taskPath = `/tasks/${COUNCIL_ID}/${T}`

afterEach(async () => {
  cleanup()
  await resetAddress()
  vi.unstubAllGlobals()
})

function setup(home: HomeResponse = homeWithTasks([task()]), query = '') {
  window.history.replaceState(null, '', homePath + query)
  const api = mockApi()
  api.on('GET', base, () => json(councilView(COUNCIL_ID)))
  api.on('GET', `${base}/members`, () => json(teamResponse()))
  api.on('GET', `${base}/rooms`, () => json(roomList()))
  api.on('GET', `${base}/home`, () => json(home))
  api.on('GET', `${base}/tasks?view=mine&status=open`, () => json({ tasks: [], truncated: false }))
  api.on('GET', `${base}/events/open`, () => json({ events: [], more: false }))
  api.on('GET', `${base}/tasks/${T}`, () => json({ task: taskDetail({ id: T }) }))
  onHomeExtras(api, {}, COUNCIL_ID)
  render(<WorkspaceAt startPage="home" />)
  return api
}

async function openPanel() {
  fireEvent.click(await screen.findByRole('button', { name: /패널에서 끝낼 업무/ }))
  return await screen.findByRole('dialog', { name: '현수막 주문' })
}

const closePanel = (panel: HTMLElement) =>
  fireEvent.click(within(panel).getByRole('button', { name: '닫기' }))

test('홈 위 패널에서 끝내면 홈의 줄과 수를 새로 읽고 닫을 때도 다시 읽는다', async () => {
  const api = setup()
  let finished = false
  api.on('GET', `${base}/home`, () => json(homeWithTasks(finished ? [] : [task()])))
  api.on('POST', `${base}/tasks/${T}/status`, () => {
    finished = true
    return json({ task: taskDetail({ id: T, status: 'done' }) })
  })
  const panel = await openPanel()
  fireEvent.click(await within(panel).findByRole('button', { name: '끝남' }))
  await waitFor(() => {
    expect(finished).toBe(true)
    expect(screen.queryByRole('button', { name: /패널에서 끝낼 업무/, hidden: true })).toBeNull()
  })
  const reads = () => api.calls.filter(call => call.path === `${base}/home`).length
  const beforeClose = reads()
  closePanel(panel)
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  await act(() => windowHistoryIdle())
  await waitFor(() => expect(reads()).toBeGreaterThan(beforeClose))
  expect(window.location.pathname).toBe(homePath)
  expect(screen.queryByRole('button', { name: /패널에서 끝낼 업무/ })).toBeNull()
  expect(
    within(screen.getByRole('region', { name: '내 업무' })).getByText('오늘까지 할 업무 없음'),
  ).toBeTruthy()
})

test('휴대폰 홈 위 패널은 아래 탭을 숨기고 닫으면 홈 탭을 되돌린다', async () => {
  navigationWidth(390)
  setup()
  const navigation = await screen.findByRole('navigation', { name: '휴대폰 메뉴' })
  expect(within(navigation).getByRole('button', { name: '홈' }).getAttribute('aria-current')).toBe(
    'page',
  )
  const panel = await openPanel()
  expect(screen.queryByRole('navigation', { name: '휴대폰 메뉴' })).toBeNull()
  closePanel(panel)
  await screen.findByRole('navigation', { name: '휴대폰 메뉴' })
  await act(() => windowHistoryIdle())
  expect(window.location.pathname).toBe(homePath)
})

test('패널 안 지우기 확인에서 뒤로 가면 업무 패널과 홈 배경이 남는다', async () => {
  setup()
  const panel = await openPanel()
  fireEvent.keyDown(within(panel).getByRole('button', { name: '더 보기' }), { key: 'Enter' })
  fireEvent.click(await screen.findByRole('menuitem', { name: '지우기' }))
  await screen.findByRole('dialog', { name: '이 업무를 지울까요?' })
  await act(() => windowHistoryIdle())
  act(() => window.history.back())
  await waitFor(() =>
    expect(screen.queryByRole('dialog', { name: '이 업무를 지울까요?' })).toBeNull(),
  )
  expect(await screen.findByRole('dialog', { name: '현수막 주문' })).toBeTruthy()
  expect(window.location.pathname).toBe(taskPath)
  expect(screen.getByRole('heading', { level: 1, name: '홈', hidden: true })).toBeTruthy()
  closePanel(panel)
  await act(() => windowHistoryIdle())
  expect(window.location.pathname).toBe(homePath)
})

test('없는 업무 안내는 다음 업무를 열면 지우고 닫아도 되살리지 않는다', async () => {
  const api = setup()
  api.on('GET', `${base}/tasks/${T}`, () => json({ error: 'NOT_FOUND' }, 404))
  fireEvent.click(await screen.findByRole('button', { name: /패널에서 끝낼 업무/ }))
  await screen.findByRole('alert')
  await waitFor(() => expect(window.location.pathname).toBe(homePath))
  api.on('GET', `${base}/tasks/${T}`, () => json({ task: taskDetail({ id: T }) }))
  const panel = await openPanel()
  expect(screen.queryByRole('alert', { hidden: true })).toBeNull()
  closePanel(panel)
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  await act(() => windowHistoryIdle())
  expect(screen.queryByRole('alert')).toBeNull()
})

test('재정 보기 홈에서 연 업무도 같은 보기를 뒤에 두고, 잃으면 그 보기와 안내를 지킨다', async () => {
  const home = councilHome(
    {},
    {
      financeView: true,
      financeBoard: {
        pending: { requests: [], total: 0, truncated: false },
        nearby: { items: [], total: 0 },
        settling: { events: [], total: 0 },
        budgets: { events: [], total: 0 },
        departments: [],
        ownedEnded: [],
      },
    },
  )
  const api = setup(home, '?view=finance')
  await screen.findByRole('region', { name: '행사별 예산' })
  act(() => openRecord('tasks', COUNCIL_ID, T, { behind: 'home' }))
  await screen.findByRole('dialog', { name: '현수막 주문' })
  expect(screen.getByRole('region', { name: '행사별 예산', hidden: true })).toBeTruthy()
  api.on('GET', `${base}/tasks/${T}`, () => json({ error: 'NOT_FOUND' }, 404))
  api.on('POST', `${base}/tasks/${T}/status`, () => json({ error: 'NOT_FOUND' }, 404))
  fireEvent.click(screen.getByRole('button', { name: '끝남' }))
  await screen.findByRole('alert')
  await waitFor(() =>
    expect(window.location.pathname + window.location.search).toBe(homePath + '?view=finance'),
  )
  expect(screen.getByRole('region', { name: '행사별 예산' })).toBeTruthy()
  // 잃은 뒤 남은 홈 칸에서도 보기를 바꿀 수 있다(뒤 화면 표시가 남아도 지금 주소를 읽는다).
  fireEvent.click(screen.getByRole('button', { name: '운영 보기' }))
  await waitFor(() => expect(window.location.pathname + window.location.search).toBe(homePath))
  expect(screen.getByRole('button', { name: '운영 보기' }).getAttribute('aria-pressed')).toBe(
    'true',
  )
})

test('없는 업무로 홈에 남은 뒤 다른 업무를 열어도 같은 홈 스크롤 자리를 쓴다', async () => {
  const api = setup()
  api.on('GET', `${base}/tasks/${T}`, () => json({ error: 'NOT_FOUND' }, 404))
  fireEvent.click(await screen.findByRole('button', { name: /패널에서 끝낼 업무/ }))
  await screen.findByRole('alert')
  await waitFor(() => expect(window.location.pathname).toBe(homePath))
  const spot = (window.history.state as { vadaBehind?: { spot: string } }).vadaBehind?.spot
  expect(spot).toBeTruthy()
  api.on('GET', `${base}/tasks/${T}`, () => json({ task: taskDetail({ id: T }) }))
  await openPanel()
  expect((window.history.state as { vadaBehind?: { spot: string } }).vadaBehind?.spot).toBe(spot)
})
