// @vitest-environment jsdom
import { useState } from 'react'
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { Action } from '@vada/contracts'
import { councilView, MEMBER_PERMISSIONS } from '@/test-support/council-fixtures'
import { message, messagePage, room, roomDetail, roomList } from '@/test-support/chat-fixtures'
import { navigationWidth } from '@/test-support/navigation-width'
import { chatBase, serveChat } from '@/test-support/chat-harness'
import { json } from '@/test-support/mock-api'
import { useTeam } from '@/team/useTeam'
import ChatPage, { type Screen } from './ChatPage'
import { useRoomList } from './useRoomList'
import { saveSideRoom } from './last-room'

afterEach(() => {
  cleanup()
  localStorage.clear()
  saveSideRoom('c1', 'm1', null)
  vi.unstubAllGlobals()
})

const a = room('side-a', { type: 'direct', name: '이재정', unread: 1 })
const b = room('side-b', { type: 'direct', name: '박새내', lastMessageAt: null })

function Harness({ permissions = MEMBER_PERMISSIONS }: { permissions?: Action[] }) {
  const [current, setCurrent] = useState<Screen>({ kind: 'home', roomId: 'r1' })
  const team = useTeam('side-council', () => {})
  const rooms = useRoomList('c1', () => {}, true)
  return (
    <ChatPage
      councilId="c1"
      view={councilView('c1', { permissions })}
      team={team}
      rooms={rooms}
      screen={current}
      onScreen={setCurrent}
      onBack={() => setCurrent({ kind: 'home' })}
      onForbidden={() => {}}
      onOpenRequest={() => {}}
    />
  )
}

function serve() {
  const api = serveChat()
  api.on('GET', '/api/organizations/side-council/members', () =>
    json({
      members: [
        { id: 'm1', name: '김회장' },
        { id: 'm2', name: '이재정' },
        { id: 'm3', name: '박새내' },
      ],
      departments: [],
    }),
  )
  api.on('GET', `${chatBase}/rooms`, () => json(roomList({ rooms: [room('r1'), b, a] })))
  for (const item of [a, b]) {
    api.on('GET', `${chatBase}/rooms/${item.id}`, () => json(roomDetail(item)))
    api.on('GET', `${chatBase}/rooms/${item.id}/messages`, () =>
      json(messagePage([message(item.id, `${item.name}의 글`)])),
    )
    api.on('POST', `${chatBase}/rooms/${item.id}/read`, () => new Response(null, { status: 204 }))
  }
  api.on('POST', `${chatBase}/direct`, () => json({ roomId: a.id }))
  return api
}

test('PC 오른쪽 1:1 목록은 권한 없이도 읽고 흐름을 왼쪽에 남기며 방마다 글을 보존한다', async () => {
  navigationWidth(1280)
  serve()
  render(<Harness permissions={MEMBER_PERMISSIONS.filter(item => item !== 'chat.direct')} />)
  const panel = await screen.findByRole('complementary', { name: '1:1' })
  expect(
    within(panel)
      .getAllByRole('button')
      .map(item => item.textContent),
  ).toEqual([expect.stringContaining('이재정'), expect.stringContaining('박새내')])
  expect(screen.queryByRole('button', { name: '1:1 대화 시작' })).toBeNull()
  fireEvent.click(within(panel).getByRole('button', { name: /이재정/ }))
  expect(await within(panel).findByText('이재정의 글')).toBeTruthy()
  expect(screen.getByText('모레 회의 있어요')).toBeTruthy()
  expect(within(panel).getByRole('heading', { name: '이재정님과 1:1' })).toBeTruthy()
  const input = within(panel).getByRole('textbox', { name: '메시지' })
  fireEvent.change(input, { target: { value: 'A에게 쓰던 글' } })
  expect(within(panel).getByRole('button', { name: '이재정님에게 보내기' })).toBeTruthy()
  fireEvent.keyDown(input, { key: 'Escape' })
  fireEvent.click(within(panel).getByRole('button', { name: /박새내/ }))
  await within(panel).findByText('박새내의 글')
  fireEvent.click(within(panel).getByRole('button', { name: '1:1' }))
  fireEvent.click(within(panel).getByRole('button', { name: /이재정/ }))
  await within(panel).findByText('이재정의 글')
  expect(within(panel).getByRole<HTMLTextAreaElement>('textbox', { name: '메시지' }).value).toBe(
    'A에게 쓰던 글',
  )
})

test('보낸 사람 이름과 /이름은 같은 API로 1:1을 열고 /는 메시지로 보내지 않는다', async () => {
  navigationWidth(1280)
  const api = serve()
  render(<Harness />)
  const names = await screen.findAllByRole('button', { name: '이재정님과 1:1 대화' })
  fireEvent.click(names[0]!)
  const panel = await screen.findByRole('complementary', { name: '1:1' })
  await within(panel).findByText('이재정의 글')
  fireEvent.click(within(panel).getByRole('button', { name: '1:1' }))
  const input = screen.getByRole<HTMLTextAreaElement>('textbox', { name: '메시지' })
  expect(input.getAttribute('placeholder')).toBe('메시지 입력 · @ 부르기 · / 1:1 대화')
  fireEvent.change(input, { target: { value: '/이' } })
  const people = await screen.findByRole('list', { name: '1:1 대화 상대' })
  expect(within(people).getByRole('button', { name: '이재정' })).toBeTruthy()
  fireEvent.submit(input.closest('form')!)
  expect(
    api.calls.filter(call => call.method === 'POST' && call.path.endsWith('/messages')),
  ).toHaveLength(0)
  fireEvent.keyDown(input, { key: 'Enter' })
  await within(panel).findByText('이재정의 글')
  await waitFor(() => expect(input.value).toBe(''))
  expect(api.calls.filter(call => call.path.endsWith('/direct')).map(call => call.body)).toEqual([
    { memberId: 'm2' },
    { memberId: 'm2' },
  ])
})

test('휴대폰 첫 화면은 마지막 1:1 탭에서 목록을 열고 방에서 돌아와도 그 탭을 기억한다', async () => {
  navigationWidth(390)
  serve()
  render(<Harness />)
  const tab = await screen.findByRole('tab', { name: /1:1/ })
  expect(screen.getAllByRole('tab').at(-1)).toBe(tab)
  fireEvent.click(tab)
  fireEvent.click(screen.getByRole('button', { name: /이재정/ }))
  expect(await screen.findByText('이재정의 글')).toBeTruthy()
  expect(screen.queryByText('모레 회의 있어요')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: '대화방 목록' }))
  expect(screen.getByRole('tab', { name: /1:1/ }).getAttribute('aria-selected')).toBe('true')
})

test('PC 머리 [+]로 목록에 아직 없는 1:1을 만들면 그 칸에서 즉시 입력한다', async () => {
  navigationWidth(1280)
  const api = serve()
  const fresh = room('fresh-direct', { type: 'direct', name: '박새내' })
  api.on('POST', `${chatBase}/direct`, () => json({ roomId: fresh.id }, 201))
  api.on('GET', `${chatBase}/rooms/${fresh.id}`, () => json(roomDetail(fresh)))
  api.on('GET', `${chatBase}/rooms/${fresh.id}/messages`, () => json(messagePage([])))
  render(<Harness />)
  const panel = await screen.findByRole('complementary', { name: '1:1' })
  fireEvent.click(await within(panel).findByRole('button', { name: '1:1 대화 시작' }))
  const dialog = await screen.findByRole('dialog')
  fireEvent.click(await within(dialog).findByRole('button', { name: '박새내' }))
  expect(await within(panel).findByRole('textbox', { name: '메시지' })).toBe(document.activeElement)
  expect(within(panel).getByRole('heading', { name: '박새내님과 1:1' })).toBeTruthy()
  expect(screen.getByText('모레 회의 있어요')).toBeTruthy()
})

test('/이름은 공백 없는 글만 막고 후보가 없거나 한글 조합 중이면 열지 않는다', async () => {
  navigationWidth(1280)
  const api = serve()
  render(<Harness />)
  const input = await screen.findByRole('textbox', { name: '메시지' })
  fireEvent.change(input, { target: { value: '/없는' } })
  expect(await screen.findByText('운영진 없음')).toBeTruthy()
  fireEvent.keyDown(input, { key: 'Enter' })
  expect(api.calls.some(call => call.path.endsWith('/direct'))).toBe(false)
  fireEvent.change(input, { target: { value: '/이' } })
  const people = await screen.findByRole('list', { name: '1:1 대화 상대' })
  fireEvent.keyDown(input, { key: 'Enter', isComposing: true })
  expect(api.calls.some(call => call.path.endsWith('/direct'))).toBe(false)
  fireEvent.click(within(people).getByRole('button', { name: '이재정' }))
  expect(await screen.findByRole('heading', { name: '이재정님과 1:1' })).toBeTruthy()
})

test('chat.direct가 없으면 / 안내·이름 동작이 없고 /로 시작한 글도 보통 글이다', async () => {
  navigationWidth(390)
  const api = serve()
  api.on('POST', `${chatBase}/rooms/r1/messages`, () => json({ error: 'X' }, 500))
  render(<Harness permissions={MEMBER_PERMISSIONS.filter(item => item !== 'chat.direct')} />)
  const input = await screen.findByRole('textbox', { name: '메시지' })
  expect(input.getAttribute('placeholder')).toBe('메시지 입력 · @ 부르기')
  expect(screen.queryByRole('button', { name: '이재정님과 1:1 대화' })).toBeNull()
  fireEvent.change(input, { target: { value: '/이' } })
  expect(screen.queryByRole('list', { name: '1:1 대화 상대' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: '공지방에 보내기' }))
  await waitFor(() =>
    expect(api.calls.some(call => call.method === 'POST' && call.path.endsWith('/messages'))).toBe(
      true,
    ),
  )
})
