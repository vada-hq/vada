// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import type { TaskSummary } from '@vada/contracts'
import { councilView, teamResponse } from '@/test-support/council-fixtures'
import { room, roomDetail, roomList, messagePage } from '@/test-support/chat-fixtures'
import { homeResponse, onHomeExtras } from '@/test-support/home-fixtures'
import { json, mockApi } from '@/test-support/mock-api'
import { navigationWidth } from '@/test-support/navigation-width'
import { resetAddress } from '@/test-support/address-reset'
import { COUNCIL_ID, WorkspaceAt } from '@/test-support/workspace-at'
import { windowHistoryIdle } from '@/lib/use-window-history'

afterEach(async () => {
  cleanup()
  await resetAddress()
  vi.unstubAllGlobals()
})
const base = `/api/organizations/${COUNCIL_ID}`
const ROOM = '0199d1a0-0000-7000-8000-0000000000a1'
const tabs = () => screen.getByRole('navigation', { name: '휴대폰 메뉴' })
function open(count = 0, rooms = [room(ROOM)]) {
  const resize = navigationWidth()
  const api = mockApi()
  api.on('GET', base, () => json(councilView(COUNCIL_ID)))
  api.on('GET', `${base}/members`, () => json(teamResponse()))
  api.on('GET', `${base}/home`, () => json(homeResponse()))
  api.on('GET', `${base}/rooms`, () => json(roomList({ rooms, unreadTotal: count })))
  const tasks: TaskSummary[] = Array.from({ length: count }, (_, i) => ({
    id: `t${i}`,
    title: `업무 ${i}`,
    status: 'todo',
    next: 'in_progress',
    dueDate: '2020-01-01',
    overdue: true,
    department: null,
    event: null,
    assignee: null,
    actions: [],
  }))
  api.on('GET', `${base}/tasks?view=mine&status=open`, () => json({ tasks, truncated: false }))
  api.on('GET', `${base}/tasks?view=all&status=open&event=none`, () =>
    json({ tasks: [], truncated: false }),
  )
  api.on('GET', `${base}/events/open`, () => json({ events: [], more: false }))
  api.on('GET', `${base}/rooms/${ROOM}`, () => json(roomDetail(rooms[0])))
  api.on('GET', `${base}/rooms/${ROOM}/messages`, () => json(messagePage()))
  api.on('POST', `${base}/rooms/${ROOM}/read`, () => json({}))
  onHomeExtras(api, {}, COUNCIL_ID)
  render(<WorkspaceAt startPage="home" />)
  return { api, resize }
}
test('다섯 탭과 머리글, 메뉴 서랍의 뒤로·선택·넓어진 폭을 처리한다', async () => {
  const { resize } = open()
  await screen.findByRole('heading', { level: 1, name: '홈' })
  expect(
    within(tabs())
      .getAllByRole('button')
      .map(item => item.textContent),
  ).toEqual(['홈', '메시지', '업무', '행사', '메뉴'])
  expect(within(screen.getByRole('banner')).queryByRole('button', { name: /메뉴/ })).toBeNull()
  fireEvent.click(within(tabs()).getByRole('button', { name: '메뉴' }))
  const sheet = await screen.findByRole('dialog', { name: '학생회 작업 공간' })
  expect(screen.queryByRole('navigation', { name: '휴대폰 메뉴' })).toBeNull()
  await windowHistoryIdle()
  act(() => window.history.back())
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(window.location.pathname).toBe(`/home/${COUNCIL_ID}`)
  fireEvent.click(within(tabs()).getByRole('button', { name: '메뉴' }))
  fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: '조직' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  await waitFor(() => expect(window.location.pathname).toBe(`/people/${COUNCIL_ID}`))
  expect(within(tabs()).getByRole('button', { name: '메뉴' }).getAttribute('aria-current')).toBe(
    'page',
  )
  fireEvent.click(within(tabs()).getByRole('button', { name: '메뉴' }))
  await screen.findByRole('dialog')
  act(() => resize(768))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(screen.queryByRole('navigation', { name: '휴대폰 메뉴' })).toBeNull()
  expect(sheet.isConnected).toBe(false)
})
test.each([0, 2, 120])('배지 %i는 옆 메뉴 데이터와 같고 새로 읽지 않는다', async count => {
  const { api } = open(count)
  const sidebar = within(screen.getByRole('navigation', { name: '학생회 메뉴' }))
  await waitFor(() =>
    expect(api.calls.some(call => call.path === `${base}/tasks?view=mine&status=open`)).toBe(true),
  )
  if (count === 0) {
    expect(within(tabs()).queryByLabelText(/안 읽은 메시지|지난 업무/)).toBeNull()
  } else {
    for (const label of [`안 읽은 메시지 ${count}개`, `지난 업무 ${count}개`]) {
      const badge = await within(tabs()).findByLabelText(label)
      expect(badge.textContent).toBe(count > 99 ? '99+' : String(count))
      expect(await sidebar.findByLabelText(label)).toBeTruthy()
    }
  }
  expect(api.calls.filter(call => call.path === `${base}/rooms`)).toHaveLength(1)
})
test('메시지 첫 화면은 탭을 두고, 전체 보기에서 연 1:1 방에서는 숨기고 뒤로 나오면 되돌린다', async () => {
  open(0, [room(ROOM, { type: 'direct', name: '박새내' })])
  fireEvent.click(within(tabs()).getByRole('button', { name: '메시지' }))
  fireEvent.click(await screen.findByRole('button', { name: '전체 보기' }))
  expect(tabs()).toBeTruthy()
  fireEvent.click(await screen.findByRole('button', { name: /박새내/ }))
  await screen.findByRole('button', { name: '대화방 목록' })
  expect(screen.queryByRole('navigation', { name: '휴대폰 메뉴' })).toBeNull()
  expect(screen.getByRole('main').className).not.toContain('bottom-navigation-space')
  fireEvent.click(screen.getByRole('button', { name: '대화방 목록' }))
  await screen.findByRole('navigation', { name: '휴대폰 메뉴' })
  expect(screen.getByRole('main').className).toContain('bottom-navigation-space')
})
test('켜진 탭을 다시 누르면 첫 화면 맨 위이고 행사는 행사 목록이다', async () => {
  open()
  const main = screen.getByRole('main')
  main.scrollTop = 300
  fireEvent.click(within(tabs()).getByRole('button', { name: '홈' }))
  expect(main.scrollTop).toBe(0)
  fireEvent.click(within(tabs()).getByRole('button', { name: '행사' }))
  expect(window.location.pathname).toBe(`/events/${COUNCIL_ID}`)
  main.scrollTop = 300
  fireEvent.click(within(tabs()).getByRole('button', { name: '행사' }))
  expect(main.scrollTop).toBe(0)
})
