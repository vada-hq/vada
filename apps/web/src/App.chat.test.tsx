// @vitest-environment jsdom
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { renderApp } from './test-support/render-app'
import { resetWindowHistory, windowHistoryIdle } from './lib/use-window-history'
import { message, messagePage, room, roomDetail, roomList } from './test-support/chat-fixtures'
import { councilView, myCouncil, teamResponse } from './test-support/council-fixtures'
import { homeResponse, onHomeExtras } from './test-support/home-fixtures'
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
  })
  for (const id of [C1, C2]) {
    api.on('GET', `/api/organizations/${id}`, () => json(councilView(id)))
    api.on('GET', `/api/organizations/${id}/members`, () => json(teamResponse()))
    api.on('GET', `/api/organizations/${id}/rooms`, () => json(rooms))
    api.on('GET', `/api/organizations/${id}/home`, () => json(homeResponse()))
    onHomeExtras(api, {}, id)
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
  expect(await roomButton(/공지방/)).toBeTruthy()
  expect(pathNow()).toBe(`/chat/${C1}`)
})

test('옛 공지 모아 보기 주소(?tab=notices)는 대화 첫 화면이고 공지 칸이 없다(DEC-90)', async () => {
  window.history.replaceState(null, '', `/chat/${C1}?tab=notices`)
  await renderApp()
  expect(await roomButton(/공지방/)).toBeTruthy()
  expect(screen.queryByRole('heading', { name: '공지 모아 보기' })).toBeNull()
  expect(screen.queryByRole('button', { name: /^공지 / })).toBeNull()
})

test('홈에 공지 부분이 없다', async () => {
  window.history.replaceState(null, '', `/home/${C1}`)
  await renderApp()
  expect(await screen.findByRole('heading', { level: 1, name: '홈', hidden: true })).toBeTruthy()
  expect(screen.queryByRole('region', { name: '공지' })).toBeNull()
})

test('홈 메시지함은 옆 메뉴 배지와 같은 대화 목록을 쓰고, 칩으로 연 방을 읽으면 돌아온 홈에서 칩이 빠진다', async () => {
  let read = false
  const roomsNow = () =>
    roomList({
      rooms: [room(ALL), room(LEAD, { type: 'leadership', unread: read ? 0 : 2 })],
      unreadTotal: read ? 0 : 2,
    })
  const roomsPath = `/api/organizations/${C1}/rooms`
  api.on('GET', roomsPath, () => json(roomsNow()))
  api.on('POST', `${roomsPath}/${LEAD}/read`, () => {
    read = true
    return new Response(null, { status: 204 })
  })
  window.history.replaceState(null, '', `/home/${C1}`)
  await renderApp()
  const inbox = await screen.findByRole('region', { name: '메시지함' })
  expect(screen.getByLabelText('안 읽은 메시지 2개')).toBeTruthy()
  expect(api.calls.filter(call => call.path === roomsPath)).toHaveLength(1)
  fireEvent.click(within(inbox).getByRole('button', { name: '회장단방, 안 읽은 메시지 2개' }))
  expect(await screen.findByText('회장단 글')).toBeTruthy()
  expect(pathNow()).toBe(`/chat/${C1}/${LEAD}`)
  // 읽음 표시 뒤 목록을 다시 읽는다. 뒤로는 들어온 곳(홈)이다.
  await waitFor(() => expect(api.calls.filter(call => call.path === roomsPath)).toHaveLength(2))
  toList()
  expect(await screen.findByRole('heading', { level: 1, name: '홈', hidden: true })).toBeTruthy()
  await screen.findByRole('region', { name: '지금 볼 것' })
  expect(screen.queryByRole('region', { name: '메시지함' })).toBeNull()
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
  fireEvent.click(await roomButton(/공지방/))
  await screen.findByText('전체방 글')
  expect(((await field()) as HTMLTextAreaElement).value).toBe('쓰던 글')
})

test('들어가지 않은 방 주소는 찾을 수 없음이고 그 방의 메시지를 읽지 않는다', async () => {
  // 목록에 없는 방은 서버에 그 방을 물어 정한다. 참여자가 아니면 서버가 403이다(PRIN-5).
  api.on('GET', `/api/organizations/${C1}/rooms/${THEIRS}`, () => json({ error: 'FORBIDDEN' }, 403))
  window.history.replaceState(null, '', `/chat/${C1}/${THEIRS}`)
  await renderApp()
  expect(await screen.findByText(ADDRESS_LOST)).toBeTruthy()
  expect(api.calls.some(call => call.path.includes(`${THEIRS}/messages`))).toBe(false)
  fireEvent.click(screen.getByRole('button', { name: '대화방 목록' }))
  expect(await roomButton(/공지방/)).toBeTruthy()
  expect(pathNow()).toBe(`/chat/${C1}`)
})

test('다른 학생회의 방 주소는 찾을 수 없음이다', async () => {
  // C2의 방 목록에는 ALL이 없다.
  api.on('GET', `/api/organizations/${C2}/rooms`, () =>
    json(roomList({ rooms: [room(LEAD, { type: 'leadership' })] })),
  )
  // 다른 학생회의 방은 서버가 없는 방과 같은 404로 답한다.
  api.on('GET', `/api/organizations/${C2}/rooms/${ALL}`, () => json({ error: 'NOT_FOUND' }, 404))
  window.history.replaceState(null, '', `/chat/${C2}/${ALL}`)
  await renderApp()
  expect(await screen.findByText(ADDRESS_LOST)).toBeTruthy()
  cleanup()
  window.history.replaceState(null, '', `/chat/${C9}/${ALL}`)
  await renderApp()
  expect(await screen.findByText(ADDRESS_LOST)).toBeTruthy()
})

test('메시지가 없어 목록에 없는 내 1:1 방 주소는 서버가 그 방을 주면 열린다', async () => {
  const fresh = '0199d1a0-0000-7000-8000-0000000000a3'
  const direct = room(fresh, { type: 'direct', name: '박새내', lastMessageAt: null })
  const at = `/api/organizations/${C1}/rooms/${fresh}`
  api.on('GET', at, () => json(roomDetail(direct)))
  api.on('GET', `${at}/messages`, () => json(messagePage([])))
  window.history.replaceState(null, '', `/chat/${C1}/${fresh}`)
  await renderApp()
  expect(await screen.findByText('아직 메시지가 없어요.')).toBeTruthy()
  expect(await field()).toBeTruthy()
  expect(screen.queryByText(ADDRESS_LOST)).toBeNull()
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
  fireEvent.click(await roomButton(/공지방/))
  expect(await screen.findByText('전체방 글')).toBeTruthy()
  expect(pathNow()).toBe(`/chat/${C1}/${ALL}`)
})
