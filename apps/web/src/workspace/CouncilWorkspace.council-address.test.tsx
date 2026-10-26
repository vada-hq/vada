// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { councilView, teamResponse } from '@/test-support/council-fixtures'
import { messagePage, room, roomDetail, roomList } from '@/test-support/chat-fixtures'
import { homeResponse, onHomeExtras } from '@/test-support/home-fixtures'
import { json, mockApi } from '@/test-support/mock-api'
import { COUNCIL_ID, WorkspaceAt } from '@/test-support/workspace-at'
import { resetWindowHistory, windowHistoryIdle } from '@/lib/use-window-history'

const base = `/api/organizations/${COUNCIL_ID}`
const ROOM_ID = '0199d1a0-0000-7000-8000-0000000000a1'
const councilPath = `/council/${COUNCIL_ID}`
const pathNow = () => window.location.pathname + window.location.search
const sidebar = () => within(screen.getByRole('complementary', { name: '학생회 작업 공간' }))
const current = () =>
  sidebar()
    .getAllByRole('button')
    .filter(item => item.getAttribute('aria-current') === 'page')

function setup(path = councilPath) {
  window.history.replaceState(null, '', path)
  const api = mockApi()
  const notice = room(ROOM_ID)
  onHomeExtras(api, {}, COUNCIL_ID)
  api.on('GET', base, () => json(councilView(COUNCIL_ID)))
  api.on('GET', `${base}/members`, () => json(teamResponse()))
  api.on('GET', `${base}/rooms`, () => json(roomList({ rooms: [notice] })))
  api.on('GET', `${base}/rooms/${ROOM_ID}`, () => json(roomDetail(notice)))
  api.on('GET', `${base}/rooms/${ROOM_ID}/messages`, () => json(messagePage()))
  api.on('GET', `${base}/home`, () => json(homeResponse()))
  for (const view of ['mine', 'all']) {
    for (const status of ['open', 'done'])
      api.on('GET', `${base}/tasks?view=${view}&status=${status}`, () =>
        json({
          tasks:
            view === 'all' && status === 'open'
              ? [
                  {
                    id: '0199d1a0-0000-7000-8000-0000000000b1',
                    title: '학생회 공통 업무',
                    status: 'todo',
                    next: 'in_progress',
                    dueDate: null,
                    overdue: false,
                    department: null,
                    event: null,
                    assignee: null,
                    actions: [],
                  },
                ]
              : [],
          truncated: false,
        }),
      )
  }
  return { api, rendered: render(<WorkspaceAt startPage="home" />) }
}

beforeEach(() => window.localStorage.clear())
afterEach(async () => {
  cleanup()
  await windowHistoryIdle()
  resetWindowHistory()
  window.history.replaceState(null, '', '/')
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

test('공간 맨 위 우리 학생회는 메시지 탭과 공지방을 열고 이 줄만 켜진다', async () => {
  setup(`/home/${COUNCIL_ID}`)
  fireEvent.click(await sidebar().findByRole('button', { name: '우리 학생회' }))
  expect(pathNow()).toBe(councilPath)
  expect((await screen.findByRole('tab', { name: '메시지' })).getAttribute('aria-selected')).toBe(
    'true',
  )
  expect(await screen.findByRole('heading', { name: '공지방' })).toBeTruthy()
  const space = sidebar().getByRole('group', { name: '공간' })
  expect(within(space).getAllByRole('button')[0]?.textContent).toBe('우리 학생회')
  expect(current().map(item => item.textContent)).toEqual(['우리 학생회'])
  expect(current()[0]?.querySelector('[data-slot="count-badge"]')).toBeNull()
  expect(screen.getByRole('list', { name: '경로' }).textContent).toBe(
    '컴퓨터학부 학생회우리 학생회메시지',
  )
})

test('업무 탭은 전체 업무를 읽고 쿼리·배치를 새로고침에도 지키며 다른 메뉴에서 뒤로 돌아온다', async () => {
  const { api, rendered } = setup(`${councilPath}?tab=tasks&layout=list&filter=done`)
  expect((await screen.findByRole('tab', { name: '업무' })).getAttribute('aria-selected')).toBe(
    'true',
  )
  await waitFor(() =>
    expect(api.calls.some(call => call.path === `${base}/tasks?view=all&status=done`)).toBe(true),
  )
  expect(screen.getByRole('button', { name: '표' }).getAttribute('aria-pressed')).toBe('true')
  expect(screen.getByRole('list', { name: '경로' }).textContent).toBe(
    '컴퓨터학부 학생회우리 학생회업무',
  )
  rendered.unmount()
  setup(pathNow())
  expect((await screen.findByRole('tab', { name: '업무' })).getAttribute('aria-selected')).toBe(
    'true',
  )
  fireEvent.click(sidebar().getByRole('button', { name: '홈' }))
  await screen.findByRole('heading', { level: 1, name: '홈' })
  act(() => window.history.back())
  await waitFor(() => expect(pathNow()).toBe(`${councilPath}?tab=tasks&filter=done&layout=list`))
  expect((await screen.findByRole('button', { name: '표' })).getAttribute('aria-pressed')).toBe(
    'true',
  )
})

test('탭으로 고른 표 배치는 다른 메뉴에서 우리 학생회 → 업무로 들어가는 링크가 기억한다', async () => {
  setup()
  fireEvent.click(await screen.findByRole('tab', { name: '업무' }))
  await waitFor(() => expect(pathNow()).toBe(`${councilPath}?tab=tasks`))
  fireEvent.click(await screen.findByRole('button', { name: '표' }))
  await waitFor(() => expect(pathNow()).toBe(`${councilPath}?tab=tasks&layout=list`))
  fireEvent.click(sidebar().getByRole('button', { name: '홈' }))
  await screen.findByRole('heading', { level: 1, name: '홈' })
  fireEvent.click(sidebar().getByRole('button', { name: '우리 학생회' }))
  fireEvent.click(await screen.findByRole('tab', { name: '업무' }))
  await waitFor(() => expect(pathNow()).toBe(`${councilPath}?tab=tasks&layout=list`))
  expect(screen.getByRole('button', { name: '표' }).getAttribute('aria-pressed')).toBe('true')
})

test('모르는 탭은 메시지로 읽고 업무 쿼리를 버리며 기존 업무 메뉴를 켜지 않는다', async () => {
  setup(`${councilPath}?tab=unknown&layout=list`)
  expect((await screen.findByRole('tab', { name: '메시지' })).getAttribute('aria-selected')).toBe(
    'true',
  )
  await waitFor(() => expect(pathNow()).toBe(councilPath))
  expect(await screen.findByRole('heading', { name: '공지방' })).toBeTruthy()
  expect(current().map(item => item.textContent)).toEqual(['우리 학생회'])
  expect(screen.queryByRole('tab', { name: '재정' })).toBeNull()
})

test('우리 학생회 업무 탭과 기존 업무 메뉴의 전체 보기는 같은 업무를 보여 준다', async () => {
  setup(`${councilPath}?tab=tasks`)
  expect(await screen.findByRole('button', { name: '학생회 공통 업무' })).toBeTruthy()
  fireEvent.click(sidebar().getByRole('button', { name: /^업무/ }))
  fireEvent.click(await screen.findByRole('tab', { name: '전체' }))
  expect(await screen.findByRole('button', { name: '학생회 공통 업무' })).toBeTruthy()
  expect(current().map(item => item.textContent)).toEqual(['업무'])
})

test('넓은 화면의 기본 업무 탭은 할 일·진행 중·끝남 보드다', async () => {
  vi.stubGlobal('matchMedia', () => ({
    matches: true,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
  setup(`${councilPath}?tab=tasks`)
  await screen.findByRole('button', { name: '학생회 공통 업무' })
  for (const name of ['할 일1', '진행 중0', '끝남0'])
    expect(screen.getByRole('heading', { name })).toBeTruthy()
  expect(screen.getByRole('button', { name: '보드' }).getAttribute('aria-pressed')).toBe('true')
})
