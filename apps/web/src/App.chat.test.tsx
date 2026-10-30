// @vitest-environment jsdom
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { renderApp } from './test-support/render-app'
import { navigationWidth } from './test-support/navigation-width'
import { resetWindowHistory, windowHistoryIdle } from './lib/use-window-history'
import { message, messagePage, room, roomDetail, roomList } from './test-support/chat-fixtures'
import { councilView, myCouncil, teamResponse } from './test-support/council-fixtures'
import { homeResponse, onHomeExtras } from './test-support/home-fixtures'
import { json, mockApi } from './test-support/mock-api'
import { ADDRESS_LOST } from './lib/messages'
import { saveSideRoom } from './chat/last-room'
import { resizeToJpeg } from './lib/photo-resize'

vi.mock('./lib/photo-resize', async importOriginal => ({
  ...(await importOriginal<typeof import('./lib/photo-resize')>()),
  resizeToJpeg: vi.fn(),
}))

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
  saveSideRoom(C1, 'm1', null)
  await windowHistoryIdle()
  resetWindowHistory()
  Reflect.deleteProperty(navigator, 'serviceWorker')
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const pathNow = () => window.location.pathname + window.location.search
const roomTab = (name: RegExp) => screen.findByRole('tab', { name })
const field = () => screen.findByRole('textbox', { name: '메시지' })

test('학생회 공지 주소는 메시지 첫 화면의 그 탭이고 탭을 바꿔도 전체 목록은 곁에 없다', async () => {
  window.history.replaceState(null, '', `/chat/${C1}/${ALL}`)
  await renderApp()
  expect(await screen.findByText('전체방 글')).toBeTruthy()
  expect(pathNow()).toBe(`/chat/${C1}/${ALL}`)
  expect(screen.getByRole('tab', { name: /공지방/ }).getAttribute('aria-selected')).toBe('true')
  fireEvent.click(await roomTab(/회장단방/))
  expect(await screen.findByText('회장단 글')).toBeTruthy()
  expect(pathNow()).toBe(`/chat/${C1}/${LEAD}`)
  expect(screen.queryByRole('list', { name: '대화방' })).toBeNull()
  expect(screen.getByText('학생회 · 회장단만 보는 방')).toBeTruthy()
})

test('옛 공지 모아 보기 주소(?tab=notices)는 대화 첫 화면이고 공지 칸이 없다(DEC-90)', async () => {
  window.history.replaceState(null, '', `/chat/${C1}?tab=notices`)
  await renderApp()
  expect(await roomTab(/공지방/)).toBeTruthy()
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
  act(() => window.history.back())
  expect(await screen.findByRole('heading', { level: 1, name: '홈', hidden: true })).toBeTruthy()
  await screen.findByRole('region', { name: '지금 볼 것' })
  expect(screen.queryByRole('region', { name: '메시지함' })).toBeNull()
})

test('방을 바꿨다 돌아와도 쓰던 입력이 그대로다', async () => {
  window.history.replaceState(null, '', `/chat/${C1}/${ALL}`)
  await renderApp()
  fireEvent.change(await field(), { target: { value: '쓰던 글' } })
  fireEvent.click(await roomTab(/회장단방/))
  await screen.findByText('회장단 글')
  expect((await field()).textContent).toBe('')
  fireEvent.click(await roomTab(/공지방/))
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
  expect(await roomTab(/공지방/)).toBeTruthy()
  expect(pathNow()).toBe(`/chat/${C1}`)
})

test.each([390, 1280])(
  '%i 폭에서 1:1을 열면 PC는 오른쪽 칸, 휴대폰은 전체 화면이다',
  async width => {
    navigationWidth(width)
    const direct = room(THEIRS, { type: 'direct', name: '박새내' })
    api.on('GET', `/api/organizations/${C1}/rooms`, () =>
      json(roomList({ rooms: [room(ALL), room(LEAD, { type: 'leadership' }), direct] })),
    )
    serveRoom(THEIRS, direct, '1:1 글')
    window.history.replaceState(null, '', `/chat/${C1}`)
    await renderApp()
    await screen.findByText('회장단 글')
    if (width === 390) expect(screen.getByRole('navigation', { name: '휴대폰 메뉴' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '전체 보기' }))
    fireEvent.click(await screen.findByRole('button', { name: /박새내/ }))
    expect(await screen.findByText('1:1 글')).toBeTruthy()
    expect(pathNow()).toBe(`/chat/${C1}/${THEIRS}`)
    expect(screen.queryByRole('list', { name: '대화방' })).toBeNull()
    if (width === 390) {
      expect(screen.queryByRole('tablist', { name: '대화방' })).toBeNull()
      expect(screen.queryByRole('navigation', { name: '휴대폰 메뉴' })).toBeNull()
      fireEvent.click(screen.getByRole('button', { name: '대화방 목록' }))
      await screen.findByRole('list', { name: '대화방' })
      expect(pathNow()).toBe(`/chat/${C1}?rooms=all`)
    } else {
      expect(await screen.findByText('회장단 글')).toBeTruthy()
      expect(screen.getByRole('tablist', { name: '대화방' })).toBeTruthy()
      const panel = screen.getByRole('complementary', { name: '1:1' })
      fireEvent.click(within(panel).getByRole('button', { name: '1:1' }))
      expect(within(panel).getByRole('list', { name: '1:1 대화방' })).toBeTruthy()
      expect(pathNow()).toBe(`/chat/${C1}/${LEAD}`)
    }
  },
)

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

test.each([390, 1280])(
  '%i 폭에서 목록에 없는 빈 1:1 주소도 서버가 준 방 종류로 열린다',
  async width => {
    navigationWidth(width)
    const fresh = '0199d1a0-0000-7000-8000-0000000000a3'
    const direct = room(fresh, { type: 'direct', name: '박새내', lastMessageAt: null })
    const at = `/api/organizations/${C1}/rooms/${fresh}`
    api.on('GET', at, () => json(roomDetail(direct)))
    api.on('GET', `${at}/messages`, () => json(messagePage([])))
    window.history.replaceState(null, '', `/chat/${C1}/${fresh}`)
    await renderApp()
    expect(await screen.findByText('메시지 없음')).toBeTruthy()
    if (width === 1280) {
      const panel = await screen.findByRole('complementary', { name: '1:1' })
      expect(within(panel).getByRole('textbox', { name: '메시지' })).toBeTruthy()
      expect(await screen.findByText('회장단 글')).toBeTruthy()
    } else expect(await field()).toBeTruthy()
    expect(screen.queryByText(ADDRESS_LOST)).toBeNull()
  },
)

// 목록과 방을 나란히 둘 만큼 넓은 화면(PC)
const wide = () =>
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: true,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))

test('PC에서 메시지 첫 화면은 기억한 학생회 방이고 다른 탭에서도 흐름은 전체 폭이다', async () => {
  wide()
  window.localStorage.setItem(`vada.chat.room.${C1}`, LEAD)
  window.history.replaceState(null, '', `/chat/${C1}`)
  await renderApp()
  expect(await screen.findByText('회장단 글')).toBeTruthy()
  expect(pathNow()).toBe(`/chat/${C1}`)
  fireEvent.click(await roomTab(/공지방/))
  expect(await screen.findByText('전체방 글')).toBeTruthy()
  expect(pathNow()).toBe(`/chat/${C1}/${ALL}`)
  expect(screen.queryByRole('list', { name: '대화방' })).toBeNull()
})

test('전체 보기는 한 칸 방 목록이고 학생회 방을 누르면 해당 탭, 뒤로는 목록·첫 화면이다', async () => {
  window.history.replaceState(null, '', `/chat/${C1}`)
  await renderApp()
  await screen.findByText('회장단 글')
  fireEvent.click(screen.getByRole('button', { name: '전체 보기' }))
  expect(pathNow()).toBe(`/chat/${C1}?rooms=all`)
  const list = await screen.findByRole('list', { name: '대화방' })
  fireEvent.click(within(list).getByRole('button', { name: /공지방/ }))
  expect(await screen.findByText('전체방 글')).toBeTruthy()
  expect(screen.getByRole('tab', { name: /공지방/ }).getAttribute('aria-selected')).toBe('true')
  act(() => window.history.back())
  await screen.findByRole('list', { name: '대화방' })
  act(() => window.history.back())
  await screen.findByRole('tablist', { name: '대화방' })
  expect(pathNow()).toBe(`/chat/${C1}`)
})

test('방을 바꿨다 돌아오면 붙인 사진이 글과 함께 남고 다른 방의 입력칸에는 없다(이동 10)', async () => {
  vi.stubGlobal(
    'URL',
    Object.assign(URL, { createObjectURL: () => 'blob:x', revokeObjectURL: () => {} }),
  )
  vi.mocked(resizeToJpeg).mockResolvedValue(new Blob(['jpeg'], { type: 'image/jpeg' }))
  api.on('POST', `/api/organizations/${C1}/rooms/${ALL}/uploads`, () =>
    json({ key: 'k1', url: '/r2/k1', headers: {}, expiresAt: '2026-10-21T00:10:00.000Z' }),
  )
  api.on('PUT', '/r2/k1', () => new Response(null, { status: 200 }))
  window.history.replaceState(null, '', `/chat/${C1}/${ALL}`)
  await renderApp()
  fireEvent.change(await field(), { target: { value: '남을 글' } })
  fireEvent.change(screen.getByLabelText('사진 고르기'), {
    target: { files: [new File(['raw'], 'a.jpg', { type: 'image/jpeg' })] },
  })
  expect(await screen.findByRole('img', { name: 'a.jpg' })).toBeTruthy()
  fireEvent.click(await roomTab(/회장단방/))
  expect(await screen.findByText('회장단 글')).toBeTruthy()
  expect(screen.queryByLabelText('보낼 사진')).toBeNull()
  fireEvent.click(await roomTab(/공지방/))
  expect(await screen.findByText('전체방 글')).toBeTruthy()
  await waitFor(async () =>
    expect((await field()) as HTMLTextAreaElement).toHaveProperty('value', '남을 글'),
  )
  expect(
    within(screen.getByLabelText('보낼 사진')).getByRole('img', { name: 'a.jpg' }),
  ).toBeTruthy()
})
