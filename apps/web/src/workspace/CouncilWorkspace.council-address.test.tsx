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
  api.on('GET', `${base}/rooms`, () =>
    json(roomList({ rooms: [notice], unreadTotal: 0, mentionTotal: 0 })),
  )
  api.on('GET', `${base}/rooms/${ROOM_ID}`, () => json(roomDetail(notice)))
  api.on('GET', `${base}/rooms/${ROOM_ID}/messages`, () => json(messagePage()))
  api.on('GET', `${base}/home`, () => json(homeResponse()))
  for (const view of ['mine', 'all']) {
    for (const status of ['open', 'done'])
      for (const event of view === 'all' ? ['', '&event=none'] : [''])
        api.on('GET', `${base}/tasks?view=${view}&status=${status}${event}`, () =>
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

test.each(['', '?tab=messages', '?tab=unknown&layout=list'])(
  '옛 학생회 메시지 주소 %s는 메시지 메뉴로 바꿔 쓰고 공간 탭을 없앤다',
  async query => {
    setup(councilPath + query)
    await screen.findByRole('heading', { level: 1, name: '메시지' })
    await waitFor(() => expect(pathNow()).toBe(`/chat/${COUNCIL_ID}`))
    expect(current().map(item => item.textContent)).toEqual(['메시지'])
    expect(sidebar().queryByRole('button', { name: '우리 학생회' })).toBeNull()
    expect(sidebar().queryByRole('group', { name: '공간' })).toBeNull()
    expect(screen.queryByRole('tablist', { name: '우리 학생회 보기' })).toBeNull()
    expect(screen.getByRole('list', { name: '경로' }).textContent).toBe('컴퓨터학부 학생회메시지')
  },
)

test('옛 학생회 업무 주소는 학생회 업무 탭의 같은 거르기·배치로 열리고 뒤로에도 새 주소다', async () => {
  const { api, rendered } = setup(`${councilPath}?tab=tasks&layout=list&filter=done`)
  const target = `/tasks/${COUNCIL_ID}?filter=done&layout=list&events=include`
  await waitFor(() => expect(pathNow()).toBe(target))
  expect(
    (await screen.findByRole('tab', { name: '학생회 업무' })).getAttribute('aria-selected'),
  ).toBe('true')
  await waitFor(() =>
    expect(api.calls.some(call => call.path === `${base}/tasks?view=all&status=done`)).toBe(true),
  )
  expect(screen.getByRole('button', { name: '표' }).getAttribute('aria-pressed')).toBe('true')
  expect(screen.getByRole('list', { name: '경로' }).textContent).toBe(
    '컴퓨터학부 학생회업무학생회 업무',
  )
  rendered.unmount()
  setup(pathNow())
  expect(
    (await screen.findByRole('tab', { name: '학생회 업무' })).getAttribute('aria-selected'),
  ).toBe('true')
  fireEvent.click(sidebar().getByRole('button', { name: '홈' }))
  await screen.findByRole('heading', { level: 1, name: '홈' })
  act(() => window.history.back())
  await waitFor(() => expect(pathNow()).toBe(target))
  expect((await screen.findByRole('button', { name: '표' })).getAttribute('aria-pressed')).toBe(
    'true',
  )
})

test('옛 학생회 업무 주소는 학생회 업무의 행사 포함 범위와 같은 목록이다', async () => {
  setup(`${councilPath}?tab=tasks`)
  expect(await screen.findByRole('button', { name: '학생회 공통 업무' })).toBeTruthy()
  await waitFor(() => expect(pathNow()).toBe(`/tasks/${COUNCIL_ID}?events=include`))
  expect(current().map(item => item.textContent)).toEqual(['업무'])
})

test('넓은 화면의 옛 학생회 업무 주소는 할 일·진행 중·끝남 보드다', async () => {
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
