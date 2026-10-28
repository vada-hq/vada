// @vitest-environment jsdom
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { renderApp } from './test-support/render-app'
import { navigationWidth } from './test-support/navigation-width'
import { resetAddress } from './test-support/address-reset'
import { message, messagePage, room, roomDetail, roomList } from './test-support/chat-fixtures'
import { councilView, MEMBER_PERMISSIONS, myCouncil } from './test-support/council-fixtures'
import {
  eventDetail,
  eventSummary,
  EVENT_ID,
  MEMBER,
  uuidTeam,
} from './test-support/event-fixtures'
import { homeResponse, homeTask, homeWithTasks, onHomeExtras } from './test-support/home-fixtures'
import { json, mockApi } from './test-support/mock-api'
import { settlementOf } from './test-support/settlement-fixtures'
import { taskDetail } from './test-support/task-detail-fixtures'
import { COUNCIL_ID } from './test-support/workspace-at'

vi.mock('./auth/auth-client', () => ({
  authClient: {
    useSession: () => ({
      data: { user: { id: 'u1', name: '박새내', email: 'member@example.test' } },
      isPending: false,
      error: null,
    }),
    signIn: { social: vi.fn() },
    signOut: vi.fn(),
  },
}))

const BASE = `/api/organizations/${COUNCIL_ID}`
const ALL = '0199d1a0-0000-7000-8000-0000000000a1'
const DEPARTMENT = '0199d1a0-0000-7000-8000-0000000000a2'
const MESSAGE = '0199d1a0-0000-7000-8000-0000000000b1'
const TASK = '0199d1a0-0000-7000-8000-0000000000d1'
const task = taskDetail({
  id: TASK,
  title: '마지막 업무',
  department: null,
  assignee: { id: MEMBER.m3, name: '박새내', current: true },
  actions: [],
})
let api: ReturnType<typeof mockApi>

beforeEach(() => {
  navigationWidth(390)
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-28T03:00:00Z'))
  window.history.replaceState(null, '', `/home/${COUNCIL_ID}`)
  api = mockApi()
  api.on('GET', '/api/me/councils', () => json({ councils: [myCouncil(COUNCIL_ID)] }))
  api.on('GET', BASE, () =>
    json(
      councilView(COUNCIL_ID, {
        memberId: MEMBER.m3,
        councilRank: null,
        permissions: MEMBER_PERMISSIONS,
        departments: [{ id: 'd2', name: '기획부', rank: null, role: null }],
      }),
    ),
  )
  api.on('GET', `${BASE}/members`, () => json(uuidTeam()))
  api.on('GET', `${BASE}/home`, () => json(homeResponse()))
  api.on('GET', `${BASE}/events/open`, () => json({ events: [], more: false }))
  onHomeExtras(api, {}, COUNCIL_ID)
  for (const query of ['view=mine&status=open', 'view=all&status=open&event=none'])
    api.on('GET', `${BASE}/tasks?${query}`, () => json({ tasks: [task], truncated: false }))
  api.on('GET', `${BASE}/tasks/${TASK}`, () => json({ task }))
  api.on('GET', `${BASE}/tasks/options`, () => json({ departments: [], linkableEvents: [] }))
  const rooms = [
    room(ALL),
    room(DEPARTMENT, { type: 'department', name: '기획부', departmentId: 'd2' }),
  ]
  api.on('GET', `${BASE}/rooms`, () => json(roomList({ rooms })))
  for (const summary of rooms) {
    const at = `${BASE}/rooms/${summary.id}`
    api.on('GET', at, () => json(roomDetail(summary)))
    api.on('GET', `${at}/messages`, () =>
      json(messagePage([message(MESSAGE, '현수막을 준비해 주세요', { senderId: MEMBER.m2 })])),
    )
    api.on('POST', `${at}/read`, () => json({}))
  }
})

afterEach(async () => {
  cleanup()
  await resetAddress()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  api.assertNoUnexpectedRequests()
})

const tabs = () => screen.getByRole('navigation', { name: '휴대폰 메뉴' })
// 탭 이름 앞에 배지 수가 붙는다(예: '안 읽은 메시지 3개 메시지').
const go = (name: string) =>
  fireEvent.click(within(tabs()).getByRole('button', { name: new RegExp(`${name}$`) }))

// jsdom은 배치를 재지 않는다. 탭 높이와 안전 영역을 예약하는 유틸리티의 적용 위치를 고정한다.
function reservedBottom(element: HTMLElement) {
  const main = screen.getByRole('main')
  expect(main.contains(element)).toBe(true)
  expect(main.classList.contains('overflow-y-auto')).toBe(true)
  expect(main.classList.contains('max-md:bottom-navigation-space')).toBe(true)
  expect(main.classList.contains('bottom-navigation-space')).toBe(false)
  // 안쪽에 다시 같은 여백을 주면 이중으로 비우므로 예약은 main 한 곳에서만 한다.
  const owners: HTMLElement[] = []
  for (let node: HTMLElement | null = element; node; node = node.parentElement) {
    if (node.className.includes('bottom-navigation-space')) owners.push(node)
    if (node === main) break
  }
  expect(owners).toEqual([main])
  return main
}

test('390에서 홈 → 메시지 부서방 → 업무 → 메시지 구매 요청까지 서랍 없이 간다', async () => {
  await renderApp()
  await screen.findByRole('heading', { level: 1, name: '홈' })
  const menuOpened = vi.fn()
  within(tabs()).getByRole('button', { name: '메뉴' }).addEventListener('click', menuOpened)
  go('메시지')
  fireEvent.click(await screen.findByRole('tab', { name: /기획부 방/ }))
  await screen.findByText('현수막을 준비해 주세요')
  expect(tabs()).toBeTruthy()
  go('업무')
  await screen.findByRole('button', { name: '마지막 업무' })
  go('메시지')
  expect(
    (await screen.findByRole('tab', { name: /기획부 방/ })).getAttribute('aria-selected'),
  ).toBe('true')
  fireEvent.keyDown(await screen.findByRole('button', { name: '메시지 동작' }), { key: 'Enter' })
  fireEvent.click(await screen.findByRole('menuitem', { name: '구매 요청 만들기' }))
  const form = await screen.findByRole('form', { name: '구매 요청 내기' })
  expect(within(form).getByLabelText('제목').getAttribute('value')).toContain('현수막')
  expect(menuOpened).not.toHaveBeenCalled()
  expect(screen.queryByRole('dialog', { name: '학생회 작업 공간' })).toBeNull()
})

test('390의 메시지 흐름은 탭 여백 안에서 높이를 채우고 마지막 메시지와 입력칸을 둔다', async () => {
  window.history.replaceState(null, '', `/chat/${COUNCIL_ID}/${DEPARTMENT}`)
  await renderApp()
  const last = await screen.findByText('현수막을 준비해 주세요')
  const main = reservedBottom(last)
  const flow = last.closest('.overflow-y-auto')
  expect(flow).not.toBe(main)
  expect(flow?.classList.contains('min-h-0')).toBe(true)
  expect(flow?.classList.contains('flex-1')).toBe(true)
  expect(main.firstElementChild?.classList.contains('h-full')).toBe(true)
  expect(main.contains(screen.getByRole('textbox', { name: '메시지' }))).toBe(true)
  expect(tabs().hidden).toBe(false)
})

test('390의 보드 배치는 줄 목록으로 접히고 마지막 업무 아래 main에만 탭 여백이 있다', async () => {
  window.history.replaceState(null, '', `/tasks/${COUNCIL_ID}?layout=board`)
  await renderApp()
  const last = await screen.findByRole('button', { name: '마지막 업무' })
  expect(last.closest('.overflow-y-auto')).toBe(reservedBottom(last))
  expect(tabs()).toBeTruthy()
})

test('390의 캘린더 월 마지막 주도 main의 스크롤과 탭 여백 안에 있다', async () => {
  window.history.replaceState(null, '', `/calendar/${COUNCIL_ID}?view=month`)
  api.on('GET', `${BASE}/calendar?from=2026-09-27&to=2026-10-31`, () =>
    json({ items: [], truncated: false }),
  )
  await renderApp()
  const last = await screen.findByRole('button', { name: '10월 31일 (토) 일정 0건' })
  expect(last.closest('.overflow-y-auto')).toBe(reservedBottom(last))
  expect(tabs()).toBeTruthy()
})

test('390의 행사 개요 마지막 줄은 main의 스크롤과 탭 여백 안에 있다', async () => {
  window.history.replaceState(null, '', `/events/${COUNCIL_ID}/${EVENT_ID}?tab=overview`)
  api.on('GET', `${BASE}/events`, () => json({ events: [eventSummary()], truncated: false }))
  api.on('GET', `${BASE}/events/${EVENT_ID}`, () => json({ event: eventDetail() }))
  api.on('GET', `${BASE}/events/${EVENT_ID}/rooms`, () => json({ rooms: [], archived: false }))
  api.on('GET', `${BASE}/events/${EVENT_ID}/registration-forms`, () =>
    json({ forms: [], actions: [] }),
  )
  api.on('GET', `${BASE}/events/${EVENT_ID}/settlement`, () => json(settlementOf()))
  api.on('GET', `${BASE}/tasks?view=all&status=open&event=${EVENT_ID}`, () =>
    json({ tasks: [task], truncated: false }),
  )
  await renderApp()
  const last = await screen.findByRole('button', { name: /마지막 업무/ })
  expect(last.closest('.overflow-y-auto')).toBe(reservedBottom(last))
  expect(tabs()).toBeTruthy()
})

test('390에서 홈의 업무 패널을 열면 탭과 본문 여백을 빼고 닫으면 연 업무로 초점을 돌린다', async () => {
  api.on('GET', `${BASE}/home`, () =>
    json(homeWithTasks([homeTask(TASK, 'today', { title: task.title, dueDate: '2026-10-28' })])),
  )
  await renderApp()
  const opener = await screen.findByRole('button', { name: '마지막 업무' })
  const main = reservedBottom(opener)
  const navigation = tabs()
  opener.focus()
  fireEvent.click(opener)
  const panel = await screen.findByRole('dialog', { name: '마지막 업무' })
  expect(navigation.hidden).toBe(true)
  expect(screen.queryByRole('navigation', { name: '휴대폰 메뉴' })).toBeNull()
  expect(main.className).not.toContain('bottom-navigation-space')
  fireEvent.click(within(panel).getByRole('button', { name: '닫기' }))
  await waitFor(() => {
    expect(navigation.hidden).toBe(false)
    expect(main.classList.contains('max-md:bottom-navigation-space')).toBe(true)
    expect(document.activeElement).toBe(opener)
  })
})

test('390에서 메뉴 시트를 닫으면 아래 탭의 메뉴 단추로 초점이 돌아간다', async () => {
  await renderApp()
  await screen.findByRole('heading', { level: 1, name: '홈' })
  const opener = within(tabs()).getByRole('button', { name: '메뉴' })
  opener.focus()
  fireEvent.click(opener)
  const sheet = await screen.findByRole('dialog', { name: '학생회 작업 공간' })
  expect(screen.queryByRole('navigation', { name: '휴대폰 메뉴' })).toBeNull()
  fireEvent.click(within(sheet).getByRole('button', { name: '메뉴 닫기' }))
  await waitFor(() => {
    expect(tabs()).toBeTruthy()
    expect(document.activeElement).toBe(opener)
  })
})

test.each([768, 1024, 1280])(
  '%i에서는 탭이 없고 아래 여백은 휴대폰에만 적용된다',
  async (width: number) => {
    navigationWidth(width)
    await renderApp()
    await screen.findByRole('heading', { level: 1, name: '홈' })
    expect(screen.queryByRole('navigation', { name: '휴대폰 메뉴' })).toBeNull()
    expect(screen.getByRole('main').classList.contains('bottom-navigation-space')).toBe(false)
    expect(screen.getByRole('main').classList.contains('max-md:bottom-navigation-space')).toBe(true)
  },
)
