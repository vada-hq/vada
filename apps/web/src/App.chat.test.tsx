// @vitest-environment jsdom
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { renderApp } from './test-support/render-app'
import { resetWindowHistory, windowHistoryIdle } from './lib/use-window-history'
import {
  message,
  messagePage,
  notice,
  room,
  roomDetail,
  roomList,
} from './test-support/chat-fixtures'
import { councilView, myCouncil, teamResponse } from './test-support/council-fixtures'
import { homeNotice, homeResponse, onHomeExtras } from './test-support/home-fixtures'
import { json, mockApi } from './test-support/mock-api'
import { ADDRESS_LOST } from './lib/messages'

const auth = vi.hoisted(() => ({ useSession: vi.fn(), signOut: vi.fn() }))
vi.mock('./auth/auth-client', () => ({
  authClient: { useSession: auth.useSession, signIn: { social: vi.fn() }, signOut: auth.signOut },
}))

const C1 = '0199d1a0-0000-7000-8000-0000000000c1'
const C2 = '0199d1a0-0000-7000-8000-0000000000c2'
const C9 = '0199d1a0-0000-7000-8000-0000000000c9'
const ALL = '0199d1a0-0000-7000-8000-0000000000a1'
const LEAD = '0199d1a0-0000-7000-8000-0000000000a2'
// 내가 들어가지 않은 방(다른 학생회의 방이거나 남의 1:1)
const THEIRS = '0199d1a0-0000-7000-8000-0000000000b1'
let api: ReturnType<typeof mockApi>

function serveRoom(id: string, summary: ReturnType<typeof room>, text: string) {
  for (const council of [C1, C2]) {
    const base = `/api/organizations/${council}/rooms/${id}`
    api.on('GET', base, () => json(roomDetail(summary)))
    api.on('GET', `${base}/messages`, () => json(messagePage([message(`m-${id}`, text)])))
    api.on('POST', `${base}/read`, () => new Response(null, { status: 204 }))
  }
}

beforeEach(() => {
  window.localStorage.clear()
  window.history.replaceState(null, '', '/')
  api = mockApi()
  auth.useSession.mockReturnValue({
    data: { user: { id: 'u1', name: '김회장', email: 'kim@example.test' } },
    isPending: false,
    error: null,
    refetch: vi.fn(),
  })
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: { addEventListener: () => undefined, removeEventListener: () => undefined },
  })
  api.on('GET', '/api/me/councils', () =>
    json({ councils: [myCouncil(C1), myCouncil(C2, '다른 학생회')] }),
  )
  const rooms = roomList({
    rooms: [room(ALL), room(LEAD, { type: 'leadership', lastMessageAt: null })],
    notices: [notice('n1', '10월 정기 회의는 금요일입니다')],
  })
  for (const id of [C1, C2]) {
    api.on('GET', `/api/organizations/${id}`, () => json(councilView(id)))
    api.on('GET', `/api/organizations/${id}/members`, () => json(teamResponse()))
    api.on('GET', `/api/organizations/${id}/rooms`, () => json(rooms))
    api.on('GET', `/api/organizations/${id}/home`, () => json(homeResponse()))
    api.on('GET', `/api/organizations/${id}/notices`, () =>
      json({ notices: [notice('n1', '10월 정기 회의는 금요일입니다')] }),
    )
    onHomeExtras(api, { notices: [homeNotice('h1', { body: '회의 장소 변경' })] }, id)
  }
  serveRoom(ALL, room(ALL), '전체방 글')
  serveRoom(LEAD, room(LEAD, { type: 'leadership' }), '회장단 글')
})
afterEach(async () => {
  cleanup()
  await windowHistoryIdle()
  resetWindowHistory()
  Reflect.deleteProperty(navigator, 'serviceWorker')
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const pathNow = () => window.location.pathname + window.location.search
const roomButton = (name: RegExp) => screen.findByRole('button', { name })
const toList = () => fireEvent.click(screen.getByRole('button', { name: '대화방 목록' }))
const field = () => screen.findByRole('textbox', { name: '메시지' })

test('방 주소로 바로 들어오면 그 방이 열리고 뒤로가 방 목록이다. 방을 누르면 방 주소가 된다', async () => {
  window.history.replaceState(null, '', `/chat/${C1}/${ALL}`)
  await renderApp()
  expect(await screen.findByText('전체방 글')).toBeTruthy()
  expect(pathNow()).toBe(`/chat/${C1}/${ALL}`)
  toList()
  fireEvent.click(await roomButton(/회장단방/))
  expect(await screen.findByText('회장단 글')).toBeTruthy()
  expect(pathNow()).toBe(`/chat/${C1}/${LEAD}`)
  toList()
  expect(await roomButton(/운영진 전체방/)).toBeTruthy()
  expect(pathNow()).toBe(`/chat/${C1}`)
})

test('방 → 공지 모아 보기 → 뒤로는 그 방이다', async () => {
  window.history.replaceState(null, '', `/chat/${C1}`)
  await renderApp()
  fireEvent.click(await roomButton(/운영진 전체방/))
  await screen.findByText('전체방 글')
  fireEvent.click(await screen.findByRole('button', { name: '모아 보기' }))
  expect(await screen.findByRole('heading', { name: '공지 모아 보기' })).toBeTruthy()
  expect(pathNow()).toBe(`/chat/${C1}?tab=notices`)
  toList()
  expect(await screen.findByText('전체방 글')).toBeTruthy()
  expect(pathNow()).toBe(`/chat/${C1}/${ALL}`)
})

test('공지 모아 보기 주소로 열면 그대로 열리고, 바로 들어왔으면 뒤로가 방 목록이다', async () => {
  window.history.replaceState(null, '', `/chat/${C1}?tab=notices`)
  await renderApp()
  expect(await screen.findByRole('heading', { name: '공지 모아 보기' })).toBeTruthy()
  toList()
  expect(await roomButton(/운영진 전체방/)).toBeTruthy()
  expect(pathNow()).toBe(`/chat/${C1}`)
})

test('홈의 공지 줄은 공지 모아 보기로 열고 뒤로는 홈이다', async () => {
  window.history.replaceState(null, '', `/home/${C1}`)
  await renderApp()
  const section = await screen.findByRole('region', { name: '공지' })
  fireEvent.click(within(section).getByRole('button', { name: '회의 장소 변경' }))
  expect(await screen.findByRole('heading', { name: '공지 모아 보기' })).toBeTruthy()
  expect(pathNow()).toBe(`/chat/${C1}?tab=notices`)
  toList()
  expect(await screen.findByRole('heading', { level: 1, name: '홈', hidden: true })).toBeTruthy()
  expect(pathNow()).toBe(`/home/${C1}`)
})

test('방을 바꿨다 돌아와도 쓰던 입력이 그대로다', async () => {
  window.history.replaceState(null, '', `/chat/${C1}/${ALL}`)
  await renderApp()
  fireEvent.change(await field(), { target: { value: '쓰던 글' } })
  toList()
  fireEvent.click(await roomButton(/회장단방/))
  await screen.findByText('회장단 글')
  expect((await field()).textContent).toBe('')
  toList()
  fireEvent.click(await roomButton(/운영진 전체방/))
  await screen.findByText('전체방 글')
  expect(((await field()) as HTMLTextAreaElement).value).toBe('쓰던 글')
})

test('들어가지 않은 방 주소는 찾을 수 없음이고 그 방을 읽지 않는다', async () => {
  window.history.replaceState(null, '', `/chat/${C1}/${THEIRS}`)
  await renderApp()
  expect(await screen.findByText(ADDRESS_LOST)).toBeTruthy()
  expect(api.calls.some(call => call.path.includes(THEIRS))).toBe(false)
  fireEvent.click(screen.getByRole('button', { name: '대화방 목록' }))
  expect(await roomButton(/운영진 전체방/)).toBeTruthy()
  expect(pathNow()).toBe(`/chat/${C1}`)
})

test('다른 학생회의 방 주소는 찾을 수 없음이다', async () => {
  // C2의 방 목록에는 ALL이 없다.
  api.on('GET', `/api/organizations/${C2}/rooms`, () =>
    json(roomList({ rooms: [room(LEAD, { type: 'leadership' })] })),
  )
  window.history.replaceState(null, '', `/chat/${C2}/${ALL}`)
  await renderApp()
  expect(await screen.findByText(ADDRESS_LOST)).toBeTruthy()
  cleanup()
  window.history.replaceState(null, '', `/chat/${C9}/${ALL}`)
  await renderApp()
  expect(await screen.findByText(ADDRESS_LOST)).toBeTruthy()
})

test('목록에 아직 없는 방의 주소는 목록을 한 번 다시 읽어 열린다', async () => {
  const fresh = '0199d1a0-0000-7000-8000-0000000000a3'
  let reads = 0
  api.on('GET', `/api/organizations/${C1}/rooms`, () => {
    reads += 1
    const added = reads > 1 ? [room(fresh, { type: 'leadership' })] : []
    return json(roomList({ rooms: [room(ALL), ...added] }))
  })
  serveRoom(fresh, room(fresh, { type: 'leadership' }), '새 방 글')
  window.history.replaceState(null, '', `/chat/${C1}/${fresh}`)
  await renderApp()
  await waitFor(() => expect(screen.getByText('새 방 글')).toBeTruthy())
})

// 목록과 방을 나란히 둘 만큼 넓은 화면(PC)
const wide = () =>
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: true,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))

test('PC에서 대화 메뉴 첫 화면은 기억한 방이고 주소는 그대로다. 다른 방을 누르면 방 주소가 된다', async () => {
  wide()
  window.localStorage.setItem(`vada.chat.room.${C1}`, LEAD)
  window.history.replaceState(null, '', `/chat/${C1}`)
  await renderApp()
  expect(await screen.findByText('회장단 글')).toBeTruthy()
  expect(pathNow()).toBe(`/chat/${C1}`)
  fireEvent.click(await roomButton(/운영진 전체방/))
  expect(await screen.findByText('전체방 글')).toBeTruthy()
  expect(pathNow()).toBe(`/chat/${C1}/${ALL}`)
})
