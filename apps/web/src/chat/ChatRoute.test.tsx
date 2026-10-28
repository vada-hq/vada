// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { councilView } from '@/test-support/council-fixtures'
import { resetAddress } from '@/test-support/address-reset'
import { COUNCIL_ID } from '@/test-support/workspace-at'
import { room, roomList } from '@/test-support/chat-fixtures'
import ChatRoute from './ChatRoute'

// 대화 화면 안은 다른 시험이 다룬다. 여기서는 주소 층과 닿는 곳(화면 고르기, '재정에서 보기', 뒤로)만 본다.
vi.mock('./ChatPage', () => ({
  default: (props: {
    screen: { kind: string; roomId?: string }
    onScreen: (screen: { kind: 'room'; roomId: string }) => void
    onOpenRequest: (requestId: string) => void
  }) => (
    <div>
      <button
        onClick={() =>
          props.onScreen({ kind: 'room', roomId: '0199d1a0-0000-7000-8000-0000000000a1' })
        }
      >
        행사 방 열기
      </button>
      <span>{`${props.screen.kind} ${props.screen.roomId ?? ''}`}</span>
      <button onClick={() => props.onOpenRequest('0199d1a0-0000-7000-8000-00000000b001')}>
        재정에서 보기
      </button>
    </div>
  ),
}))

afterEach(async () => {
  cleanup()
  await resetAddress()
})

const ROOM = '0199d1a0-0000-7000-8000-0000000000a1'
const REQUEST = '0199d1a0-0000-7000-8000-00000000b001'

test('재정에서 보기는 그 요청의 주소로 쌓고, 뒤로 가면 그 방이다', async () => {
  window.history.replaceState(null, '', `/chat/${COUNCIL_ID}/${ROOM}`)
  render(
    <ChatRoute
      councilId={COUNCIL_ID}
      view={councilView(COUNCIL_ID)}
      team={{} as never}
      rooms={{} as never}
      onForbidden={() => {}}
    />,
  )
  expect(screen.getByText(`room ${ROOM}`)).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '재정에서 보기' }))
  expect(window.location.pathname).toBe(`/purchases/${COUNCIL_ID}/${REQUEST}`)
  act(() => window.history.back())
  await vi.waitFor(() => expect(window.location.pathname).toBe(`/chat/${COUNCIL_ID}/${ROOM}`))
  expect(screen.getByText(`room ${ROOM}`)).toBeTruthy()
})

test('목록의 행사 방을 누르면 행사 메시지 탭을 한 칸 쌓는다', async () => {
  const eventId = '0199d1a0-0000-7000-8000-0000000000e1'
  window.history.replaceState(null, '', `/chat/${COUNCIL_ID}`)
  render(
    <ChatRoute
      councilId={COUNCIL_ID}
      view={councilView(COUNCIL_ID)}
      team={{} as never}
      rooms={{
        state: { kind: 'ready', data: roomList({ rooms: [room(ROOM, { eventId })] }) },
        reload: async () => true,
      }}
      onForbidden={() => {}}
    />,
  )
  fireEvent.click(screen.getByRole('button', { name: '행사 방 열기' }))
  expect(window.location.pathname + window.location.search).toBe(
    `/events/${COUNCIL_ID}/${eventId}?room=${ROOM}`,
  )
  act(() => window.history.back())
  await vi.waitFor(() => expect(window.location.pathname).toBe(`/chat/${COUNCIL_ID}`))
})
