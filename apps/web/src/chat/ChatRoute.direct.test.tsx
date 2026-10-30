// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { resetAddress } from '@/test-support/address-reset'
import { message, messagePage, room, roomDetail, roomList } from '@/test-support/chat-fixtures'
import { councilView } from '@/test-support/council-fixtures'
import { json, mockApi } from '@/test-support/mock-api'
import { navigationWidth } from '@/test-support/navigation-width'
import { COUNCIL_ID } from '@/test-support/workspace-at'
import { windowHistoryIdle } from '@/lib/use-window-history'
import { useTeam } from '@/team/useTeam'
import ChatRoute from './ChatRoute'
import { saveSideRoom } from './last-room'
import { useRoomList } from './useRoomList'

// 대화상자가 닫히면서 방 주소로 가는 길이다. 창의 기록 칸을 거두는 순서가 주소를 지우지 않는지 진짜 주소 층으로 본다.
const BASE = `/api/organizations/${COUNCIL_ID}`
const NOTICE = '0199d1a0-0000-7000-8000-0000000000a1'
const LEAD = '0199d1a0-0000-7000-8000-0000000000a2'
const DIRECT = '0199d1a0-0000-7000-8000-0000000000d1'
const LINK = 'https://www.coupang.com/vp/products/7334523?itemId=18698271'
const DIRECT_PATH = `/chat/${COUNCIL_ID}/${DIRECT}`
const FIRST_PATH = `/chat/${COUNCIL_ID}`
const ALL_PATH = `${FIRST_PATH}?rooms=all`

const pathNow = () => window.location.pathname + window.location.search

function Route() {
  const team = useTeam(COUNCIL_ID, () => {})
  const rooms = useRoomList(COUNCIL_ID, () => {}, true)
  return (
    <ChatRoute
      councilId={COUNCIL_ID}
      view={councilView(COUNCIL_ID)}
      team={team}
      rooms={rooms}
      onForbidden={() => {}}
    />
  )
}

function serve() {
  const api = mockApi()
  const notice = room(NOTICE)
  const lead = room(LEAD, { type: 'leadership' })
  const direct = room(DIRECT, { type: 'direct', name: '이재정', lastMessageAt: null })
  api.on('GET', `${BASE}/rooms`, () => json(roomList({ rooms: [notice, lead] })))
  api.on('GET', `${BASE}/members`, () =>
    json({
      members: [
        { id: 'm1', name: '김회장' },
        { id: 'm2', name: '이재정' },
      ],
      departments: [],
    }),
  )
  api.on('POST', `${BASE}/direct`, () => json({ roomId: DIRECT }, 201))
  api.on('POST', `${BASE}/product-info`, () => json({ product: null, reason: 'unavailable' }))
  for (const item of [notice, lead, direct]) {
    api.on('GET', `${BASE}/rooms/${item.id}`, () => json(roomDetail(item)))
    api.on('GET', `${BASE}/rooms/${item.id}/messages`, () => json(messagePage([])))
    api.on('POST', `${BASE}/rooms/${item.id}/read`, () => new Response(null, { status: 204 }))
  }
  api.on('GET', `${BASE}/rooms/${NOTICE}/messages`, () => json(messagePage([message('p1', LINK)])))
}

async function openFromAllRooms() {
  window.history.replaceState(null, '', FIRST_PATH)
  window.history.pushState({ vadaFrom: FIRST_PATH }, '', ALL_PATH)
  render(<Route />)
  fireEvent.click(await screen.findByRole('button', { name: '1:1 대화 시작' }))
  const dialog = await screen.findByRole('dialog', { name: '1:1 대화' })
  fireEvent.click(await within(dialog).findByRole('button', { name: '이재정' }))
}

beforeEach(() => {
  vi.stubGlobal('scrollTo', () => {})
})
afterEach(async () => {
  cleanup()
  vi.unstubAllGlobals()
  saveSideRoom(COUNCIL_ID, 'm1', null)
  await resetAddress()
})

test.each([1024, 1280])(
  '%i 폭의 전체 보기에서 사람을 고르면 그 방이 오른쪽 칸에 열린다',
  async width => {
    navigationWidth(width)
    serve()
    await openFromAllRooms()
    await waitFor(() => expect(pathNow()).toBe(DIRECT_PATH))
    await windowHistoryIdle()
    expect(pathNow()).toBe(DIRECT_PATH)
    expect(screen.queryByRole('dialog')).toBeNull()
    const panel = await screen.findByRole('complementary', { name: '1:1' })
    expect(await within(panel).findByLabelText('메시지')).toBeTruthy()
    // 전체 보기 칸을 바꿔 썼으니 뒤로는 그 아래 첫 화면이다.
    act(() => window.history.back())
    await waitFor(() => expect(pathNow()).toBe(FIRST_PATH))
  },
)

test('390 폭의 전체 보기에서 사람을 고르면 그 방이 전체 폭으로 열리고 뒤로는 전체 보기다', async () => {
  navigationWidth(390)
  serve()
  await openFromAllRooms()
  await waitFor(() => expect(pathNow()).toBe(DIRECT_PATH))
  await windowHistoryIdle()
  expect(pathNow()).toBe(DIRECT_PATH)
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(await screen.findByLabelText('메시지')).toBeTruthy()
  expect(screen.queryByRole('complementary', { name: '1:1' })).toBeNull()
  act(() => window.history.back())
  await waitFor(() => expect(pathNow()).toBe(ALL_PATH))
  expect(await screen.findByRole('button', { name: '1:1 대화 시작' })).toBeTruthy()
})

test('오른쪽 칸의 1:1 목록에서 사람을 골라도 주소가 그 방에 남는다', async () => {
  navigationWidth(1280)
  serve()
  window.history.replaceState(null, '', FIRST_PATH)
  render(<Route />)
  const toggle = await screen.findByRole('button', { name: /^1:1/, expanded: false })
  fireEvent.click(toggle)
  const panel = await screen.findByRole('complementary', { name: '1:1' })
  fireEvent.click(await within(panel).findByRole('button', { name: '1:1 대화 시작' }))
  const dialog = await screen.findByRole('dialog', { name: '1:1 대화' })
  fireEvent.click(await within(dialog).findByRole('button', { name: '이재정' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  await windowHistoryIdle()
  await waitFor(() => expect(pathNow()).toBe(DIRECT_PATH))
})

test('옆에 남는 상품 정보 칸이 열린 채 방 탭을 바꿔도 칸을 닫은 뒤 주소가 그 방에 남는다', async () => {
  navigationWidth(1280)
  serve()
  window.history.replaceState(null, '', `${FIRST_PATH}/${NOTICE}`)
  render(<Route />)
  fireEvent.click(await screen.findByRole('link', { name: LINK }))
  const panel = await screen.findByRole('complementary', { name: '상품 정보' })
  await windowHistoryIdle()
  fireEvent.click(await screen.findByRole('tab', { name: /회장단방/ }))
  await waitFor(() => expect(pathNow()).toBe(`${FIRST_PATH}/${LEAD}`))
  await windowHistoryIdle()
  expect(screen.getByRole('complementary', { name: '상품 정보' })).toBe(panel)
  fireEvent.click(within(panel).getByRole('button', { name: '닫기' }))
  await waitFor(() => expect(screen.queryByRole('complementary', { name: '상품 정보' })).toBeNull())
  await windowHistoryIdle()
  expect(pathNow()).toBe(`${FIRST_PATH}/${LEAD}`)
})
