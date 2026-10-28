// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { room, roomDetail, roomList } from '@/test-support/chat-fixtures'
import { json, mockApi } from '@/test-support/mock-api'
import { resetAddress } from '@/test-support/address-reset'
import { COUNCIL_ID } from '@/test-support/workspace-at'
import RoomGate from './RoomGate'

const ROOM = '0199d1a0-0000-7000-8000-0000000000a1'
const EVENT = '0199d1a0-0000-7000-8000-0000000000e1'
const base = `/api/organizations/${COUNCIL_ID}/rooms/${ROOM}`

afterEach(async () => {
  cleanup()
  await resetAddress()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

test.each([true, false])(
  '옛 행사 방 주소는 행사 메시지 탭으로 바꿔 쓴다(목록에 있음: %s)',
  async listed => {
    const api = mockApi()
    const summary = room(ROOM, { eventId: EVENT })
    api.on('GET', base, () => json(roomDetail(summary)))
    window.history.replaceState(null, '', `/chat/${COUNCIL_ID}/${ROOM}`)
    const replace = vi.spyOn(window.history, 'replaceState')
    const push = vi.spyOn(window.history, 'pushState')
    render(
      <RoomGate
        rooms={{
          state: { kind: 'ready', data: roomList({ rooms: listed ? [summary] : [] }) },
          reload: async () => true,
        }}
        councilId={COUNCIL_ID}
        roomId={ROOM}
        onList={() => {}}
      >
        <p>메시지 메뉴의 방</p>
      </RoomGate>,
    )
    await waitFor(() =>
      expect(window.location.pathname + window.location.search).toBe(
        `/events/${COUNCIL_ID}/${EVENT}?room=${ROOM}`,
      ),
    )
    expect(screen.queryByText('메시지 메뉴의 방')).toBeNull()
    expect(replace).toHaveBeenCalled()
    expect(push).not.toHaveBeenCalled()
    vi.restoreAllMocks()
  },
)

test('볼 수 없는 방은 행사 주소를 지어내지 않고 찾을 수 없음을 보인다', async () => {
  const api = mockApi()
  api.on('GET', base, () => json({}, 404))
  window.history.replaceState(null, '', `/chat/${COUNCIL_ID}/${ROOM}`)
  render(
    <RoomGate
      rooms={{ state: { kind: 'ready', data: roomList({ rooms: [] }) }, reload: async () => true }}
      councilId={COUNCIL_ID}
      roomId={ROOM}
      onList={() => {}}
    >
      <p>메시지 메뉴의 방</p>
    </RoomGate>,
  )
  expect(await screen.findByRole('button', { name: '대화방 목록' })).toBeTruthy()
  expect(window.location.pathname).toBe(`/chat/${COUNCIL_ID}/${ROOM}`)
  expect(screen.queryByText('메시지 메뉴의 방')).toBeNull()
})
