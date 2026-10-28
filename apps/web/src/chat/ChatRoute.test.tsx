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
      <span>{`${props.screen.kind} ${props.screen.roomId ?? ''}`}</span>
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
      rooms={{ state: { kind: 'loading' }, reload: async () => true }}
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
