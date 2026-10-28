// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { councilView } from '@/test-support/council-fixtures'
import { resetAddress } from '@/test-support/address-reset'
import { COUNCIL_ID } from '@/test-support/workspace-at'
import { room, roomList } from '@/test-support/chat-fixtures'
import ChatRoute from './ChatRoute'
import { navigationWidth } from '@/test-support/navigation-width'
import { saveSideRoom } from './last-room'
import { json, mockApi } from '@/test-support/mock-api'
import { roomDetail } from '@/test-support/chat-fixtures'

// 대화 화면 안은 다른 시험이 다룬다. 여기서는 주소 층과 닿는 곳(화면 고르기, '재정에서 보기', 뒤로)만 본다.
vi.mock('./ChatPage', () => ({
  default: (props: {
    screen: { kind: string; roomId?: string; sideRoomId?: string }
    onScreen: (screen: { kind: 'room' | 'home'; roomId: string } | { kind: 'list' }) => void
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
      <span>{`${props.screen.kind} ${props.screen.roomId ?? props.screen.sideRoomId ?? ''}${props.screen.sideRoomId ? ' side' : ''}`}</span>
      <button onClick={() => props.onScreen({ kind: 'list' })}>전체 보기</button>
      <button onClick={() => props.onScreen({ kind: 'home', roomId: ROOM })}>학생회 방 탭</button>
      <button onClick={() => props.onOpenRequest('0199d1a0-0000-7000-8000-00000000b001')}>
        재정에서 보기
      </button>
    </div>
  ),
}))

afterEach(async () => {
  cleanup()
  vi.unstubAllGlobals()
  saveSideRoom(COUNCIL_ID, 'm1', null)
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
      rooms={{
        state: { kind: 'ready', data: roomList({ rooms: [room(ROOM, { type: 'direct' })] }) },
        reload: async () => true,
      }}
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

// 방 종류를 모르는 동안 학생회 방을 전체 폭으로 열면 탭과 휴대폰 아래 메뉴가 사라진다. 첫 화면이 목록을 기다리거나 다시 시도를 보인다.
test.each(['loading', 'failed'] as const)(
  '방 목록이 %s이면 방 주소도 메시지 첫 화면으로 둔다',
  kind => {
    window.history.replaceState(null, '', `/chat/${COUNCIL_ID}/${ROOM}`)
    render(
      <ChatRoute
        councilId={COUNCIL_ID}
        view={councilView(COUNCIL_ID)}
        team={{} as never}
        rooms={{ state: { kind }, reload: async () => true }}
        onForbidden={() => {}}
      />,
    )
    expect(screen.getByText(`home ${ROOM}`)).toBeTruthy()
  },
)

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

test.each(['all_members', 'leadership', 'department'] as const)(
  '학생회 %s 방의 알림·업무 공지 주소는 그 방 탭을 연다',
  type => {
    window.history.replaceState(null, '', `/chat/${COUNCIL_ID}/${ROOM}`)
    render(
      <ChatRoute
        councilId={COUNCIL_ID}
        view={councilView(COUNCIL_ID)}
        team={{} as never}
        rooms={{
          state: { kind: 'ready', data: roomList({ rooms: [room(ROOM, { type })] }) },
          reload: async () => true,
        }}
        onForbidden={() => {}}
      />,
    )
    expect(screen.getByText(`home ${ROOM}`)).toBeTruthy()
  },
)

test('전체 보기는 rooms=all 주소를 쌓고 기기 뒤로는 첫 화면이다', async () => {
  window.history.replaceState(null, '', `/chat/${COUNCIL_ID}`)
  render(
    <ChatRoute
      councilId={COUNCIL_ID}
      view={councilView(COUNCIL_ID)}
      team={{} as never}
      rooms={{ state: { kind: 'ready', data: roomList() }, reload: async () => true }}
      onForbidden={() => {}}
    />,
  )
  fireEvent.click(screen.getByRole('button', { name: '전체 보기' }))
  expect(window.location.pathname + window.location.search).toBe(`/chat/${COUNCIL_ID}?rooms=all`)
  expect(screen.getByText('list')).toBeTruthy()
  act(() => window.history.back())
  await vi.waitFor(() => expect(window.location.search).toBe(''))
  expect(screen.getByText('home')).toBeTruthy()
})

test('학생회 방 탭을 바꿔도 방문 기록을 쌓지 않고 들어온 곳으로 돌아간다', async () => {
  window.history.replaceState(null, '', `/home/${COUNCIL_ID}`)
  window.history.pushState(null, '', `/chat/${COUNCIL_ID}`)
  render(
    <ChatRoute
      councilId={COUNCIL_ID}
      view={councilView(COUNCIL_ID)}
      team={{} as never}
      rooms={{
        state: { kind: 'ready', data: roomList({ rooms: [room(ROOM)] }) },
        reload: async () => true,
      }}
      onForbidden={() => {}}
    />,
  )
  fireEvent.click(screen.getByRole('button', { name: '학생회 방 탭' }))
  expect(screen.getByText(`home ${ROOM}`)).toBeTruthy()
  act(() => window.history.back())
  await vi.waitFor(() => expect(window.location.pathname).toBe(`/home/${COUNCIL_ID}`))
})

test('1:1 알림은 학생회 탭 대신 전체 폭 방 화면을 연다', () => {
  window.history.replaceState(null, '', `/chat/${COUNCIL_ID}/${ROOM}`)
  render(
    <ChatRoute
      councilId={COUNCIL_ID}
      view={councilView(COUNCIL_ID)}
      team={{} as never}
      rooms={{
        state: { kind: 'ready', data: roomList({ rooms: [room(ROOM, { type: 'direct' })] }) },
        reload: async () => true,
      }}
      onForbidden={() => {}}
    />,
  )
  expect(screen.getByText(`room ${ROOM}`)).toBeTruthy()
})

test.each([1024, 1280])('%i 폭의 1:1 알림은 첫 화면과 오른쪽 칸을 연다', width => {
  navigationWidth(width)
  window.history.replaceState(null, '', `/chat/${COUNCIL_ID}/${ROOM}`)
  render(
    <ChatRoute
      councilId={COUNCIL_ID}
      view={councilView(COUNCIL_ID)}
      team={{} as never}
      rooms={{
        state: { kind: 'ready', data: roomList({ rooms: [room(ROOM, { type: 'direct' })] }) },
        reload: async () => true,
      }}
      onForbidden={() => {}}
    />,
  )
  expect(screen.getByText(`home ${ROOM} side`)).toBeTruthy()
})

test.each(['loading', 'failed'] as const)(
  '방금 연 1:1은 목록이 %s여도 오른쪽 칸을 유지한다',
  kind => {
    navigationWidth(1280)
    saveSideRoom(COUNCIL_ID, 'm1', ROOM)
    window.history.replaceState(null, '', `/chat/${COUNCIL_ID}/${ROOM}`)
    render(
      <ChatRoute
        councilId={COUNCIL_ID}
        view={councilView(COUNCIL_ID)}
        team={{} as never}
        rooms={{ state: { kind }, reload: async () => true }}
        onForbidden={() => {}}
      />,
    )
    expect(screen.getByText(`home ${ROOM} side`)).toBeTruthy()
  },
)

test('PC에서 목록에 없는 방의 종류를 못 읽으면 전체 폭으로 정하지 않고 다시 읽어 오른쪽 칸에 연다', async () => {
  navigationWidth(1280)
  const fresh = '0199d1a0-0000-7000-8000-0000000000f1'
  const api = mockApi()
  let tries = 0
  api.on('GET', `/api/organizations/${COUNCIL_ID}/rooms/${fresh}`, () =>
    ++tries === 1
      ? json({ error: 'INTERNAL' }, 500)
      : json(roomDetail(room(fresh, { type: 'direct', name: '박새내' }))),
  )
  window.history.replaceState(null, '', `/chat/${COUNCIL_ID}/${fresh}`)
  render(
    <ChatRoute
      councilId={COUNCIL_ID}
      view={councilView(COUNCIL_ID)}
      team={{} as never}
      rooms={{
        state: { kind: 'ready', data: roomList({ rooms: [room(ROOM)] }) },
        reload: async () => true,
      }}
      onForbidden={() => {}}
    />,
  )
  expect(await screen.findByText(`home ${fresh} side`, {}, { timeout: 8000 })).toBeTruthy()
  expect(screen.queryByText(`room ${fresh}`)).toBeNull()
  expect(tries).toBe(2)
}, 15000)
